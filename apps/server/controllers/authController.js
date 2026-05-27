const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const transporter = require('../utils/mailer');

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const login = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const user = result.rows[0];
    if (role && user.role !== role) {
      return res.status(403).json({ success: false, message: `This account is not registered as ${role}.` });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }
    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    let tenantInfo = null;
    if (user.role === 'tenant') {
      const tResult = await pool.query(
        `SELECT t.tenant_id, t.unit_id, t.lease_start_date, t.lease_end_date,
                u.unit_code, u.monthly_price, u.floor_plan, u.location
         FROM tenants t
         JOIN units u ON t.unit_id = u.unit_id
         WHERE t.user_id = $1 AND t.is_archived = false
         LIMIT 1`,
        [user.user_id]
      );
      if (tResult.rows.length > 0) {
        tenantInfo = tResult.rows[0];
      }
    }

    res.json({
      success: true,
      message: 'Login successful.',
      data: { user: userWithoutPassword, token, tenantInfo }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const register = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password, role } = req.body;
  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
  }
  if (!['admin', 'tenant'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role.' });
  }
  try {
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }
    const hashed = await bcrypt.hash(password, 10);

    // Insert user first — get back the row so we have user_id for the fallback
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *`,
      [firstName, lastName, email.toLowerCase(), phoneNumber || null, hashed, role]
    );
    const newUser = result.rows[0];

    // Try to send verification email — non-fatal if it errors
    try {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        'UPDATE users SET verification_token = $1 WHERE user_id = $2',
        [verificationToken, newUser.user_id]
      );
      const verifyUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${verificationToken}`;
      await transporter.sendMail({
        from: `"UPahan" <${process.env.EMAIL_USER}>`,
        to: email.toLowerCase(),
        subject: 'Verify your UPahan account',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#FAF8F5;border-radius:12px;">
            <h2 style="color:#277571;margin-bottom:8px;">Welcome to UPahan!</h2>
            <p style="color:#444;font-size:15px;margin-bottom:24px;">
              Hi ${firstName}, click the button below to verify your email address and activate your account.
            </p>
            <a href="${verifyUrl}" style="display:inline-block;background:#277571;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
              Verify Email
            </a>
            <p style="color:#888;font-size:12px;margin-top:24px;">
              This link expires in 24 hours. If you didn't sign up, ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Verification email failed (non-fatal):', emailErr.message);
      // Auto-verify so the user can still log in even if email delivery fails
      await pool.query('UPDATE users SET is_verified = TRUE WHERE user_id = $1', [newUser.user_id]);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account before logging in.',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<h2>Invalid verification link.</h2>');
  }
  try {
    const result = await pool.query('SELECT user_id FROM users WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) {
      return res.status(400).send('<h2>Invalid or expired verification link.</h2>');
    }
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE user_id = $1',
      [result.rows[0].user_id]
    );
    res.send(`
      <html><body style="font-family:Inter,sans-serif;text-align:center;padding:60px;background:#FAF8F5;">
        <div style="max-width:400px;margin:0 auto;">
          <h2 style="color:#277571;">Email Verified!</h2>
          <p style="color:#444;font-size:15px;">Your UPahan account is now active. You may close this window and log in.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).send('<h2>Server error. Please try again.</h2>');
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
  try {
    const result = await pool.query('SELECT user_id, first_name FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }
    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
      [resetToken, expires, user.user_id]
    );

    const webUrl = `${process.env.WEB_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: `"UPahan" <${process.env.EMAIL_USER}>`,
      to: email.toLowerCase(),
      subject: 'Reset your UPahan password',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#FAF8F5;border-radius:12px;">
          <h2 style="color:#277571;margin-bottom:8px;">Password Reset</h2>
          <p style="color:#444;font-size:15px;margin-bottom:24px;">
            Hi ${user.first_name}, click the button below to reset your password. This link expires in 1 hour.
          </p>
          <a href="${webUrl}" style="display:inline-block;background:#277571;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Reset Password
          </a>
          <p style="color:#666;font-size:13px;margin-top:24px;">
            Or copy this link: <a href="${webUrl}" style="color:#277571;">${webUrl}</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:16px;">
            If you didn't request a password reset, ignore this email.
          </p>
        </div>
      `,
    });

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });
  }
  try {
    const result = await pool.query(
      'SELECT user_id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
      [hashed, result.rows[0].user_id]
    );
    res.json({ success: true, message: 'Password reset successful. You may now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, first_name, last_name, email, phone_number, role, created_at FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, register, verifyEmail, forgotPassword, resetPassword, getProfile };
