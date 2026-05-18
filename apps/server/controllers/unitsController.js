const pool = require('../config/db');
const path = require('path');

const getAllUnits = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT u.*,
             ARRAY_AGG(DISTINCT m.file_path) FILTER (WHERE m.file_path IS NOT NULL) AS photos,
             t.tenant_id,
             usr.first_name || ' ' || usr.last_name AS tenant_name,
             COALESCE(
               (SELECT p.payment_status FROM payments p
                WHERE p.tenant_id = t.tenant_id
                  AND p.month_covered = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
                ORDER BY p.created_at DESC LIMIT 1),
               'unpaid'
             ) AS payment_status
      FROM units u
      LEFT JOIN media m ON m.unit_id = u.unit_id AND m.maintenance_request_id IS NULL
      LEFT JOIN tenants t ON u.unit_id = t.unit_id AND t.is_archived = false
      LEFT JOIN users usr ON t.user_id = usr.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      query += ` AND (u.unit_code ILIKE $${idx} OR u.location ILIKE $${idx} OR u.floor_plan ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      query += ` AND u.vacancy_status = $${idx}`;
      params.push(status);
      idx++;
    }
    if (req.user && req.user.role === 'admin') {
      query += ` AND u.admin_id = $${idx}`;
      params.push(req.user.userId);
      idx++;
    }
    if (!req.user || req.user.role === 'guest') {
      query += ` AND u.vacancy_status = 'vacant'`;
    }

    query += ' GROUP BY u.unit_id, t.tenant_id, usr.first_name, usr.last_name ORDER BY u.unit_code';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get units error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user && req.user.role === 'admin';
    const queryStr = `
      SELECT u.*,
             ARRAY_AGG(DISTINCT m.file_path) FILTER (WHERE m.file_path IS NOT NULL) AS photos,
             t.tenant_id, t.lease_start_date, t.lease_end_date,
             usr.user_id AS tenant_user_id,
             usr.first_name, usr.last_name,
             usr.first_name || ' ' || usr.last_name AS tenant_name,
             usr.email AS tenant_email, usr.phone_number AS tenant_phone
      FROM units u
      LEFT JOIN media m ON m.unit_id = u.unit_id AND m.maintenance_request_id IS NULL
      LEFT JOIN tenants t ON u.unit_id = t.unit_id AND t.is_archived = false
      LEFT JOIN users usr ON t.user_id = usr.user_id
      WHERE u.unit_id = $1${isAdmin ? ' AND u.admin_id = $2' : ''}
      GROUP BY u.unit_id, t.tenant_id, t.lease_start_date, t.lease_end_date,
               usr.user_id, usr.first_name, usr.last_name, usr.email, usr.phone_number`;
    const queryParams = isAdmin ? [id, req.user.userId] : [id];
    const result = await pool.query(queryStr, queryParams);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get unit error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createUnit = async (req, res) => {
  const { unitCode, monthlyPrice, vacancyStatus, floorPlan, location, description, bedrooms, due_day, dueDay } = req.body;
  if (!unitCode || !monthlyPrice) {
    return res.status(400).json({ success: false, message: 'Unit code and monthly price are required.' });
  }
  const parsedDueDay = parseInt(due_day || dueDay || 5);
  const validDueDay = (!isNaN(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31) ? parsedDueDay : 5;
  try {
    const existing = await pool.query('SELECT unit_id FROM units WHERE unit_code = $1', [unitCode.toUpperCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Unit code already exists.' });
    }
    const result = await pool.query(
      `INSERT INTO units (unit_code, monthly_price, vacancy_status, floor_plan, location, description, bedrooms, due_day, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [unitCode.toUpperCase(), parseFloat(monthlyPrice), vacancyStatus || 'vacant', floorPlan || null, location || null, description || null, bedrooms || null, validDueDay, req.user.userId]
    );
    res.status(201).json({ success: true, message: 'Unit created successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('Create unit error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateUnit = async (req, res) => {
  const { id } = req.params;
  const { unitCode, monthlyPrice, vacancyStatus, floorPlan, location, description, bedrooms, due_day, dueDay } = req.body;
  const rawDueDay = due_day ?? dueDay;
  const parsedDueDay = rawDueDay !== undefined ? parseInt(rawDueDay) : null;
  const validDueDay = (parsedDueDay !== null && !isNaN(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31) ? parsedDueDay : null;
  try {
    const result = await pool.query(
      `UPDATE units SET unit_code = COALESCE($1, unit_code), monthly_price = COALESCE($2, monthly_price),
       vacancy_status = COALESCE($3, vacancy_status), floor_plan = COALESCE($4, floor_plan),
       location = COALESCE($5, location), description = COALESCE($6, description),
       bedrooms = COALESCE($7, bedrooms), due_day = COALESCE($8, due_day), updated_at = NOW()
       WHERE unit_id = $9 AND admin_id = $10 RETURNING *`,
      [unitCode, monthlyPrice ? parseFloat(monthlyPrice) : null, vacancyStatus, floorPlan, location, description, bedrooms || null, validDueDay, id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found or access denied.' });
    }
    res.json({ success: true, message: 'Unit updated.', data: result.rows[0] });
  } catch (err) {
    console.error('Update unit error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteUnit = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify unit exists and belongs to this admin
    const unitCheck = await client.query(
      'SELECT unit_id, unit_code, vacancy_status FROM units WHERE unit_id = $1 AND admin_id = $2',
      [id, req.user.userId]
    );
    if (unitCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Unit not found or access denied.' });
    }
    const { unit_code, vacancy_status } = unitCheck.rows[0];

    // Refuse to delete occupied units
    if (vacancy_status === 'occupied') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot delete an occupied unit. Please remove the tenant first.' });
    }

    // Delete media attached to maintenance requests for this unit
    await client.query(
      `DELETE FROM media WHERE maintenance_request_id IN (
         SELECT request_id FROM maintenance_requests WHERE unit_id = $1
       )`,
      [id]
    );

    // Delete unit photos
    await client.query('DELETE FROM media WHERE unit_id = $1', [id]);

    // Delete documents
    await client.query('DELETE FROM documents WHERE unit_id = $1', [id]);

    // Delete payments
    await client.query('DELETE FROM payments WHERE unit_id = $1', [id]);

    // Delete maintenance requests
    await client.query('DELETE FROM maintenance_requests WHERE unit_id = $1', [id]);

    // Delete archived tenant records
    await client.query('DELETE FROM tenants WHERE unit_id = $1', [id]);

    // Delete the unit
    await client.query('DELETE FROM units WHERE unit_id = $1', [id]);

    await client.query('COMMIT');

    res.json({ success: true, message: `Unit ${unit_code} has been deleted successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete unit error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
};

const uploadUnitPhotos = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }
    const insertPromises = req.files.map(file => {
      const relativePath = `/uploads/units/${path.basename(file.path)}`;
      return pool.query(
        'INSERT INTO media (unit_id, file_path) VALUES ($1, $2) ON CONFLICT (file_path) DO NOTHING RETURNING *',
        [id, relativePath]
      );
    });
    const results = await Promise.all(insertPromises);
    const photos = results.map(r => r.rows[0]).filter(Boolean);
    res.json({ success: true, message: 'Photos uploaded.', data: photos });
  } catch (err) {
    console.error('Upload photos error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getCollectionSummary = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().substring(0, 7);
    const totalOccupied = await pool.query(
      "SELECT COUNT(*) FROM units WHERE vacancy_status = 'occupied' AND admin_id = $1",
      [req.user.userId]
    );
    const totalPaid = await pool.query(
      `SELECT COUNT(DISTINCT p.tenant_id) FROM payments p
       JOIN tenants t ON p.tenant_id = t.tenant_id
       JOIN units u ON t.unit_id = u.unit_id
       WHERE p.month_covered = $1 AND p.payment_status = 'paid' AND p.verified_by_admin = true
         AND u.admin_id = $2`,
      [month, req.user.userId]
    );
    const occupied = parseInt(totalOccupied.rows[0].count) || 0;
    const paid = parseInt(totalPaid.rows[0].count) || 0;
    const percentage = occupied > 0 ? Math.round((paid / occupied) * 100) : 0;
    res.json({
      success: true,
      data: { occupied, paid, percentage, month }
    });
  } catch (err) {
    console.error('Collection summary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllUnits, getUnit, createUnit, updateUnit, deleteUnit, uploadUnitPhotos, getCollectionSummary };
