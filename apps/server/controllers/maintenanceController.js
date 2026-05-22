const pool = require('../config/db');
const path = require('path');
const { sendNotification, getAdminUserId } = require('./notificationsController');

const getRequests = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    let query, params = [];

    if (req.user.role === 'admin') {
      params.push(req.user.userId);
      query = `
        SELECT mr.*, u.first_name || ' ' || u.last_name AS tenant_name,
               un.unit_code,
               ARRAY_AGG(DISTINCT m.file_path) FILTER (WHERE m.file_path IS NOT NULL) AS photos
        FROM maintenance_requests mr
        JOIN tenants t ON mr.tenant_id = t.tenant_id
        JOIN users u ON t.user_id = u.user_id
        JOIN units un ON mr.unit_id = un.unit_id
        LEFT JOIN media m ON m.maintenance_request_id = mr.request_id
        WHERE un.admin_id = $1
      `;
    } else {
      const tenantResult = await pool.query(
        'SELECT tenant_id FROM tenants WHERE user_id = $1 AND is_archived = false LIMIT 1',
        [req.user.userId]
      );
      if (tenantResult.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const myTenantId = tenantResult.rows[0].tenant_id;
      query = `
        SELECT mr.*, un.unit_code,
               ARRAY_AGG(DISTINCT m.file_path) FILTER (WHERE m.file_path IS NOT NULL) AS photos
        FROM maintenance_requests mr
        JOIN units un ON mr.unit_id = un.unit_id
        LEFT JOIN media m ON m.maintenance_request_id = mr.request_id
        WHERE mr.tenant_id = $${params.length + 1}
      `;
      params.push(myTenantId);
    }

    if (status) { query += ` AND mr.status = $${params.length + 1}`; params.push(status); }
    if (priority) { query += ` AND mr.priority_level = $${params.length + 1}`; params.push(priority); }
    if (category) { query += ` AND mr.issue_category = $${params.length + 1}`; params.push(category); }

    query += ' GROUP BY mr.request_id';
    if (req.user.role === 'admin') query += ', u.first_name, u.last_name, un.unit_code';
    else query += ', un.unit_code';
    query += ' ORDER BY mr.report_date DESC';

    const result = await pool.query(query, params);
    const data = result.rows.map(row => ({
      ...row,
      photos: row.maintenance_images
        ? JSON.parse(row.maintenance_images)
        : (row.photos || []).filter(Boolean),
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getRequest = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT mr.*, u.first_name || ' ' || u.last_name AS tenant_name,
              u.email AS tenant_email, u.phone_number AS tenant_phone,
              un.unit_code, un.floor_plan, un.location,
              ARRAY_AGG(DISTINCT m.file_path) FILTER (WHERE m.file_path IS NOT NULL) AS photos
       FROM maintenance_requests mr
       JOIN tenants t ON mr.tenant_id = t.tenant_id
       JOIN users u ON t.user_id = u.user_id
       JOIN units un ON mr.unit_id = un.unit_id
       LEFT JOIN media m ON m.maintenance_request_id = mr.request_id
       WHERE mr.request_id = $1
       GROUP BY mr.request_id, u.first_name, u.last_name, u.email, u.phone_number, un.unit_code, un.floor_plan, un.location`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    const row = result.rows[0];
    const photos = row.maintenance_images
      ? JSON.parse(row.maintenance_images)
      : (row.photos || []).filter(Boolean);
    res.json({ success: true, data: { ...row, photos } });
  } catch (err) {
    console.error('Get request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createRequest = async (req, res) => {
  const { issueCategory, subject, description, priorityLevel } = req.body;
  if (!issueCategory || !subject) {
    return res.status(400).json({ success: false, message: 'Category and subject are required.' });
  }
  const fileCount = req.files?.length || 0;
  if (fileCount < 3) {
    const msg = fileCount === 0
      ? 'Please attach at least 3 photos to describe the issue.'
      : `Please attach at least 3 photos. You have ${fileCount} so far.`;
    return res.status(400).json({ success: false, message: msg });
  }
  try {
    const maintenanceImages = JSON.stringify(
      (req.files || []).map(f => `/uploads/maintenance/${path.basename(f.path)}`)
    );
    const tenantResult = await pool.query(
      `SELECT t.tenant_id, t.unit_id, u.first_name || ' ' || u.last_name AS tenant_name, un.unit_code
       FROM tenants t
       JOIN users u ON t.user_id = u.user_id
       JOIN units un ON t.unit_id = un.unit_id
       WHERE t.user_id = $1 AND t.is_archived = false LIMIT 1`,
      [req.user.userId]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active tenancy found.' });
    }
    const { tenant_id, unit_id, tenant_name, unit_code } = tenantResult.rows[0];
    const result = await pool.query(
      `INSERT INTO maintenance_requests (tenant_id, unit_id, issue_category, subject, description, priority_level, maintenance_images)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant_id, unit_id, issueCategory, subject, description || null, priorityLevel || 'low', maintenanceImages]
    );

    // Notify admin (non-blocking)
    try {
      const adminId = await getAdminUserId();
      await sendNotification(adminId, 'new_maintenance',
        `${tenant_name} submitted a maintenance request: "${subject}" (Unit ${unit_code}).`,
        result.rows[0].request_id
      );
    } catch {}

    res.status(201).json({ success: true, message: 'Request submitted.', data: result.rows[0] });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateRequest = async (req, res) => {
  const { id } = req.params;
  const { status, priorityLevel } = req.body;
  try {
    const ownerCheck = await pool.query(
      `SELECT mr.request_id FROM maintenance_requests mr
       JOIN units un ON mr.unit_id = un.unit_id
       WHERE mr.request_id = $1 AND un.admin_id = $2`,
      [id, req.user.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or access denied.' });
    }

    const result = await pool.query(
      `UPDATE maintenance_requests SET
         status = COALESCE($1, status),
         priority_level = COALESCE($2, priority_level),
         resolved_date = CASE WHEN $1 = 'completed' THEN NOW() ELSE resolved_date END,
         updated_at = NOW()
       WHERE request_id = $3 RETURNING *`,
      [status, priorityLevel, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // Notify the tenant (non-blocking)
    if (status) {
      try {
        const tenantUserResult = await pool.query(
          `SELECT u.user_id, mr.subject FROM maintenance_requests mr
           JOIN tenants t ON mr.tenant_id = t.tenant_id
           JOIN users u ON t.user_id = u.user_id
           WHERE mr.request_id = $1 LIMIT 1`,
          [id]
        );
        const tenantUserId = tenantUserResult.rows[0]?.user_id;
        const subject = tenantUserResult.rows[0]?.subject || 'your request';
        let statusMsg;
        if (status === 'in_progress')              statusMsg = `Your maintenance request "${subject}" is now being worked on.`;
        else if (status === 'resolved' || status === 'completed') statusMsg = `Your maintenance request "${subject}" has been resolved.`;
        else if (status === 'rejected')            statusMsg = `Your maintenance request "${subject}" was rejected.`;
        else statusMsg = `Your maintenance request "${subject}" has been updated to ${status}.`;
        await sendNotification(tenantUserId, 'maintenance_update', statusMsg, parseInt(id));
      } catch {}
    }

    res.json({ success: true, message: 'Request updated.', data: result.rows[0] });
  } catch (err) {
    console.error('Update request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const uploadRequestPhotos = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }
    const insertPromises = req.files.map(file => {
      const relativePath = `/uploads/maintenance/${path.basename(file.path)}`;
      return pool.query(
        'INSERT INTO media (maintenance_request_id, file_path) VALUES ($1, $2) ON CONFLICT (file_path) DO NOTHING RETURNING *',
        [id, relativePath]
      );
    });
    const results = await Promise.all(insertPromises);
    const photos = results.map(r => r.rows[0]).filter(Boolean);
    res.json({ success: true, message: 'Photos uploaded.', data: photos });
  } catch (err) {
    console.error('Upload maintenance photos error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getRequests, getRequest, createRequest, updateRequest, uploadRequestPhotos };
