const pool = require('../config/db');
const path = require('path');
const { sendNotification, getAdminUserId } = require('./notificationsController');

const getPayments = async (req, res) => {
  try {
    const { month, tenantId, status } = req.query;
    let query, params = [];

    if (req.user.role === 'admin') {
      params.push(req.user.userId);
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name AS tenant_name,
               un.unit_code, un.monthly_price
        FROM payments p
        JOIN tenants t ON p.tenant_id = t.tenant_id
        JOIN users u ON t.user_id = u.user_id
        JOIN units un ON p.unit_id = un.unit_id
        WHERE un.admin_id = $1
      `;
      if (month) { query += ` AND p.month_covered = $${params.length + 1}`; params.push(month); }
      if (tenantId) { query += ` AND p.tenant_id = $${params.length + 1}`; params.push(tenantId); }
      if (status) { query += ` AND p.payment_status = $${params.length + 1}`; params.push(status); }
      query += ' ORDER BY p.payment_date DESC';
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
        SELECT p.*, un.unit_code, un.monthly_price
        FROM payments p
        JOIN units un ON p.unit_id = un.unit_id
        WHERE p.tenant_id = $1
      `;
      params.push(myTenantId);
      if (month) { query += ` AND p.month_covered = $${params.length + 1}`; params.push(month); }
      query += ' ORDER BY p.payment_date DESC';
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    let tenantId;
    if (req.user.role === 'tenant') {
      const tenantResult = await pool.query(
        'SELECT tenant_id FROM tenants WHERE user_id = $1 AND is_archived = false LIMIT 1',
        [req.user.userId]
      );
      if (tenantResult.rows.length === 0) {
        return res.json({ success: true, data: { totalPaid: 0, totalPending: 0 } });
      }
      tenantId = tenantResult.rows[0].tenant_id;
    } else {
      tenantId = req.query.tenantId;
    }

    const paid = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE tenant_id = $1 AND payment_status = 'paid'",
      [tenantId]
    );
    const pending = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE tenant_id = $1 AND payment_status IN ('pending', 'unpaid')",
      [tenantId]
    );
    res.json({
      success: true,
      data: {
        totalPaid: parseFloat(paid.rows[0].total),
        totalPending: parseFloat(pending.rows[0].total)
      }
    });
  } catch (err) {
    console.error('Payment summary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createPayment = async (req, res) => {
  const { tenantId, unitId, amount, paymentDate, paymentStatus, monthCovered, paymentType, paymentMethod, notes } = req.body;
  if (!tenantId || !unitId || !amount || !monthCovered) {
    return res.status(400).json({ success: false, message: 'Tenant, unit, amount, and month are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, payment_method, notes, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [tenantId, unitId, parseFloat(amount), paymentDate || new Date(), paymentStatus || 'paid',
       monthCovered, paymentType || 'full', paymentMethod || null, notes || null, true]
    );
    res.status(201).json({ success: true, message: 'Payment recorded.', data: result.rows[0] });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updatePayment = async (req, res) => {
  const { id } = req.params;
  const { paymentStatus, verifiedByAdmin, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE payments SET
         payment_status = COALESCE($1, payment_status),
         verified_by_admin = COALESCE($2, verified_by_admin),
         notes = COALESCE($3, notes),
         updated_at = NOW()
       WHERE payment_id = $4 RETURNING *`,
      [paymentStatus, verifiedByAdmin, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    res.json({ success: true, message: 'Payment updated.', data: result.rows[0] });
  } catch (err) {
    console.error('Update payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getCurrentMonthStatus = async (req, res) => {
  try {
    const tenantResult = await pool.query(
      'SELECT tenant_id, unit_id FROM tenants WHERE user_id = $1 AND is_archived = false LIMIT 1',
      [req.user.userId]
    );
    if (tenantResult.rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    const { tenant_id, unit_id } = tenantResult.rows[0];
    const month = new Date().toISOString().substring(0, 7);
    const payResult = await pool.query(
      `SELECT payment_status, SUM(amount) AS total_paid
       FROM payments
       WHERE tenant_id = $1 AND month_covered = $2
       GROUP BY payment_status
       ORDER BY payment_status`,
      [tenant_id, month]
    );
    const nextDue = new Date();
    nextDue.setDate(1);
    nextDue.setMonth(nextDue.getMonth() + 1);
    res.json({
      success: true,
      data: {
        payments: payResult.rows,
        nextDue: nextDue.toISOString().substring(0, 10),
        month,
        tenantId: tenant_id,
        unitId: unit_id,
      }
    });
  } catch (err) {
    console.error('Current month status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Tenant declares a payment
const declarePayment = async (req, res) => {
  try {
    const { paymentMethod, amountPaid, referenceNumber, paymentDate, notes, paymentType, monthCovered: bodyMonthCovered } = req.body;
    const VALID_PAYMENT_TYPES = ['full', 'partial', 'advance'];
    const pType = VALID_PAYMENT_TYPES.includes(paymentType) ? paymentType : 'full';

    if (!paymentMethod || !amountPaid || !paymentDate) {
      return res.status(400).json({ success: false, message: 'Payment method, amount, and date are required.' });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(paymentDate) > today) {
      return res.status(400).json({ success: false, message: 'Payment date cannot be in the future.' });
    }

    const tenantResult = await pool.query(
      `SELECT t.tenant_id, t.unit_id, u.monthly_price, u.due_day,
              u2.first_name || ' ' || u2.last_name AS tenant_name, u.unit_code
       FROM tenants t
       JOIN units u ON t.unit_id = u.unit_id
       JOIN users u2 ON t.user_id = u2.user_id
       WHERE t.user_id = $1 AND t.is_archived = false LIMIT 1`,
      [req.user.userId]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No active tenancy found.' });
    }
    const { tenant_id, unit_id, monthly_price, due_day, tenant_name, unit_code } = tenantResult.rows[0];
    const dueDay = parseInt(due_day) || 5;
    const isLate = new Date().getDate() > dueDay;
    const monthCovered = bodyMonthCovered || paymentDate.substring(0, 7);

    if (parseFloat(amountPaid) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    }
    if (pType !== 'advance' && parseFloat(amountPaid) > parseFloat(monthly_price)) {
      return res.status(400).json({ success: false, message: `Amount cannot exceed the monthly rent of ₱${parseFloat(monthly_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.` });
    }
    if (pType === 'partial' && parseFloat(amountPaid) >= parseFloat(monthly_price)) {
      return res.status(400).json({ success: false, message: 'Partial payment must be less than the full monthly rent.' });
    }

    const dupCheck = await pool.query(
      `SELECT payment_id FROM payments WHERE tenant_id = $1 AND month_covered = $2 AND payment_status = 'pending_approval'`,
      [tenant_id, monthCovered]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'You already have a pending payment declaration for this month. Please wait for the landlord to review it.' });
    }

    if (pType === 'full') {
      const paidCheck = await pool.query(
        `SELECT payment_id FROM payments WHERE tenant_id = $1 AND month_covered = $2 AND payment_status = 'paid'`,
        [tenant_id, monthCovered]
      );
      if (paidCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'This month has already been fully paid.' });
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please attach at least one proof of payment.' });
    }
    const proofImages = JSON.stringify(req.files.map(f => `/uploads/payments/${path.basename(f.path)}`));

    const result = await pool.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered,
         payment_method, reference_number, proof_images, notes, declared_by_tenant, verified_by_admin, payment_type, is_late)
       VALUES ($1, $2, $3, $4, 'pending_approval', $5, $6, $7, $8, $9, true, false, $10, $11) RETURNING *`,
      [tenant_id, unit_id, parseFloat(amountPaid), paymentDate, monthCovered,
       paymentMethod, referenceNumber || null, proofImages, notes || null, pType, isLate]
    );

    // Notify admin (non-blocking)
    try {
      const adminId = await getAdminUserId();
      await sendNotification(adminId, 'new_payment_declaration',
        `${tenant_name} (Unit ${unit_code}) submitted a ${pType} payment of ₱${parseFloat(amountPaid).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${monthCovered}.`,
        result.rows[0].payment_id
      );
    } catch {}

    res.status(201).json({ success: true, message: 'Payment declaration submitted.', data: result.rows[0] });
  } catch (err) {
    console.error('PAYMENT SUBMIT ERROR:', err.message);
    console.error('STACK:', err.stack);
    console.error('BODY RECEIVED:', req.body);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// Admin: get all pending declarations
const getPendingDeclarations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             u.first_name || ' ' || u.last_name AS tenant_name,
             u.email AS tenant_email,
             un.unit_code, un.monthly_price
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.tenant_id
      JOIN users u ON t.user_id = u.user_id
      JOIN units un ON p.unit_id = un.unit_id
      WHERE p.payment_status = 'pending_approval' AND p.declared_by_tenant = true
        AND un.admin_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.userId]);
    const data = result.rows.map(row => ({
      ...row,
      proof_images: row.proof_images ? JSON.parse(row.proof_images) : [],
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get pending declarations error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Tenant: get own declarations
const getTenantDeclarations = async (req, res) => {
  try {
    const tenantResult = await pool.query(
      'SELECT tenant_id FROM tenants WHERE user_id = $1 AND is_archived = false LIMIT 1',
      [req.user.userId]
    );
    if (tenantResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const myTenantId = tenantResult.rows[0].tenant_id;
    const result = await pool.query(
      `SELECT p.*, un.unit_code, un.monthly_price
       FROM payments p
       JOIN units un ON p.unit_id = un.unit_id
       WHERE p.tenant_id = $1 AND p.declared_by_tenant = true
       ORDER BY p.created_at DESC`,
      [myTenantId]
    );
    const data = result.rows.map(row => ({
      ...row,
      proof_images: row.proof_images ? JSON.parse(row.proof_images) : [],
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get tenant declarations error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Admin: approve a payment declaration
const approvePayment = async (req, res) => {
  const { id } = req.params;
  try {
    const payResult = await pool.query(
      `SELECT p.*, un.monthly_price, u.user_id AS tenant_user_id, un.unit_code
       FROM payments p
       JOIN units un ON p.unit_id = un.unit_id
       JOIN tenants t ON p.tenant_id = t.tenant_id
       JOIN users u ON t.user_id = u.user_id
       WHERE p.payment_id = $1 AND un.admin_id = $2`,
      [id, req.user.userId]
    );
    if (payResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found or access denied.' });
    }
    const payment = payResult.rows[0];

    const prevPaidResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_prev
       FROM payments
       WHERE tenant_id = $1 AND month_covered = $2 AND payment_status IN ('paid','partial') AND payment_id != $3`,
      [payment.tenant_id, payment.month_covered, id]
    );
    const totalPrev = parseFloat(prevPaidResult.rows[0].total_prev);
    const totalPaid = totalPrev + parseFloat(payment.amount);
    const monthlyPrice = parseFloat(payment.monthly_price);
    const newStatus = totalPaid >= monthlyPrice ? 'paid' : 'partial';
    const remainingBalance = Math.max(0, monthlyPrice - totalPaid);

    const result = await pool.query(
      `UPDATE payments SET payment_status = $1, verified_by_admin = true,
         payment_type = $2, remaining_balance = $3, updated_at = NOW()
       WHERE payment_id = $4 RETURNING *`,
      [newStatus, payment.payment_type || (newStatus === 'paid' ? 'full' : 'partial'), remainingBalance, id]
    );

    // Notify tenant (non-blocking)
    try {
      await sendNotification(payment.tenant_user_id, 'payment_approved',
        `Your payment of ₱${parseFloat(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${payment.month_covered} has been approved.`,
        parseInt(id)
      );
    } catch {}

    res.json({ success: true, message: 'Payment approved and recorded.', data: result.rows[0] });
  } catch (err) {
    console.error('Approve payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Admin: reject a payment declaration
const rejectPayment = async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;
  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
  }
  try {
    // Verify ownership and get tenant info for notification
    const payResult = await pool.query(
      `SELECT p.month_covered, p.amount, u.user_id AS tenant_user_id
       FROM payments p
       JOIN tenants t ON p.tenant_id = t.tenant_id
       JOIN users u ON t.user_id = u.user_id
       JOIN units un ON p.unit_id = un.unit_id
       WHERE p.payment_id = $1 AND un.admin_id = $2`,
      [id, req.user.userId]
    );
    if (payResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found or access denied.' });
    }

    const result = await pool.query(
      `UPDATE payments SET payment_status = 'rejected', rejection_reason = $1, verified_by_admin = false, updated_at = NOW()
       WHERE payment_id = $2 RETURNING *`,
      [rejectionReason.trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Notify tenant (non-blocking)
    try {
      if (payResult.rows.length > 0) {
        const { tenant_user_id, amount, month_covered } = payResult.rows[0];
        await sendNotification(tenant_user_id, 'payment_rejected',
          `Your payment of ₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${month_covered} was rejected. Reason: ${rejectionReason.trim()}`,
          parseInt(id)
        );
      }
    } catch {}

    res.json({ success: true, message: 'Payment declaration rejected.', data: result.rows[0] });
  } catch (err) {
    console.error('Reject payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getPayments, getPaymentSummary, createPayment, updatePayment, getCurrentMonthStatus,
  declarePayment, getPendingDeclarations, getTenantDeclarations, approvePayment, rejectPayment,
};
