require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM maintenance_photos');
    await client.query('DELETE FROM maintenance_requests');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM tenants');
    await client.query('DELETE FROM unit_photos');
    await client.query('DELETE FROM units');
    await client.query('DELETE FROM users');

    // Reset sequences
    await client.query('ALTER SEQUENCE users_user_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE units_unit_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE tenants_tenant_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE payments_payment_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE maintenance_requests_request_id_seq RESTART WITH 1');

    // Hash passwords
    const adminPass = await bcrypt.hash('admin123', 10);
    const tenantPass = await bcrypt.hash('tenant123', 10);

    // Admin user
    const adminResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING user_id`,
      ['John', 'Doe', 'admin@upahan.com', '+639171234567', adminPass, 'admin']
    );
    const adminId = adminResult.rows[0].user_id;

    // Tenant users
    const tenant1 = await client.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING user_id`,
      ['Maria', 'Santos', 'maria@tenant.com', '+639181234567', tenantPass, 'tenant']
    );
    const tenant2 = await client.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING user_id`,
      ['Jose', 'Reyes', 'jose@tenant.com', '+639191234567', tenantPass, 'tenant']
    );
    const tenant3 = await client.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING user_id`,
      ['Ana', 'Cruz', 'ana@tenant.com', '+639201234567', tenantPass, 'tenant']
    );

    const t1Id = tenant1.rows[0].user_id;
    const t2Id = tenant2.rows[0].user_id;
    const t3Id = tenant3.rows[0].user_id;

    // Units
    const unit1A = await client.query(
      `INSERT INTO units (unit_code, monthly_price, vacancy_status, floor_plan, location, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unit_id`,
      ['1A', 12000.00, 'occupied', 'Studio, 24sqm Open Plan', 'Olongapo City, Zambales', 'Cozy studio unit on the ground floor with modern amenities.', adminId]
    );
    const unit1B = await client.query(
      `INSERT INTO units (unit_code, monthly_price, vacancy_status, floor_plan, location, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unit_id`,
      ['1B', 15000.00, 'occupied', '1 Bedroom, 36sqm', 'Olongapo City, Zambales', 'Spacious 1-bedroom unit with fully furnished interior.', adminId]
    );
    const unit2A = await client.query(
      `INSERT INTO units (unit_code, monthly_price, vacancy_status, floor_plan, location, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unit_id`,
      ['2A', 18000.00, 'occupied', '1 Bedroom Loft, 50sqm', 'Olongapo City, Zambales', 'Modern loft-style 1-bedroom unit on the second floor.', adminId]
    );
    const unit2B = await client.query(
      `INSERT INTO units (unit_code, monthly_price, vacancy_status, floor_plan, location, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unit_id`,
      ['2B', 20000.00, 'vacant', '2 Bedroom, 60sqm', 'Olongapo City, Zambales', 'Large 2-bedroom unit ideal for families. Currently vacant.', adminId]
    );

    const u1A = unit1A.rows[0].unit_id;
    const u1B = unit1B.rows[0].unit_id;
    const u2A = unit2A.rows[0].unit_id;
    const u2B = unit2B.rows[0].unit_id;

    // Tenant assignments
    const tenantRec1 = await client.query(
      `INSERT INTO tenants (user_id, unit_id, lease_start_date, lease_end_date)
       VALUES ($1, $2, $3, $4) RETURNING tenant_id`,
      [t1Id, u1A, '2025-01-01', '2025-12-31']
    );
    const tenantRec2 = await client.query(
      `INSERT INTO tenants (user_id, unit_id, lease_start_date, lease_end_date)
       VALUES ($1, $2, $3, $4) RETURNING tenant_id`,
      [t2Id, u1B, '2025-06-01', '2026-05-31']
    );
    const tenantRec3 = await client.query(
      `INSERT INTO tenants (user_id, unit_id, lease_start_date, lease_end_date)
       VALUES ($1, $2, $3, $4) RETURNING tenant_id`,
      [t3Id, u2A, '2025-09-01', '2026-08-31']
    );

    const tr1 = tenantRec1.rows[0].tenant_id;
    const tr2 = tenantRec2.rows[0].tenant_id;
    const tr3 = tenantRec3.rows[0].tenant_id;

    // Payments for tenant 1 (unit 1A - ₱12,000/mo)
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr1, u1A, 12000.00, '2026-02-01', 'paid', '2026-02', 'full', true]
    );
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr1, u1A, 12000.00, '2026-01-12', 'late', '2026-01', 'full', true]
    );
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr1, u1A, 6000.00, '2025-12-29', 'partial', '2025-12', 'partial', true]
    );
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr1, u1A, 6000.00, '2025-12-05', 'partial', '2025-12', 'partial', true]
    );

    // Payments for tenant 2 (unit 1B - ₱15,000/mo)
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr2, u1B, 15000.00, '2026-02-03', 'paid', '2026-02', 'full', true]
    );
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr2, u1B, 15000.00, '2026-01-02', 'paid', '2026-01', 'full', true]
    );

    // Payments for tenant 3 (unit 2A - ₱18,000/mo) - unpaid for current month
    await client.query(
      `INSERT INTO payments (tenant_id, unit_id, amount, payment_date, payment_status, month_covered, payment_type, verified_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr3, u2A, 18000.00, '2026-01-05', 'paid', '2026-01', 'full', true]
    );

    // Maintenance requests
    await client.query(
      `INSERT INTO maintenance_requests (tenant_id, unit_id, issue_category, subject, description, priority_level, status, report_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr1, u1A, 'plumbing', 'Leaking Faucet', 'The kitchen faucet has been leaking continuously for two days. Water is dripping even when the faucet is fully closed. This is causing water waste and damage to the cabinet below.', 'high', 'pending', new Date(Date.now() - 2 * 60 * 60 * 1000)]
    );
    await client.query(
      `INSERT INTO maintenance_requests (tenant_id, unit_id, issue_category, subject, description, priority_level, status, report_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tr2, u1B, 'electrical', 'Flickering Lights in Bedroom', 'The bedroom ceiling light has been flickering for the past week. It gets worse at night and sometimes goes completely out.', 'medium', 'in_progress', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)]
    );
    await client.query(
      `INSERT INTO maintenance_requests (tenant_id, unit_id, issue_category, subject, description, priority_level, status, report_date, resolved_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tr3, u2A, 'structural', 'Cracked Wall near Window', 'There is a visible crack developing near the main bedroom window. The crack appears to be growing.', 'low', 'completed', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)]
    );

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
    console.log('\nDemo Accounts:');
    console.log('Admin   - admin@upahan.com   / admin123');
    console.log('Tenant1 - maria@tenant.com   / tenant123  (Unit 1A)');
    console.log('Tenant2 - jose@tenant.com    / tenant123  (Unit 1B)');
    console.log('Tenant3 - ana@tenant.com     / tenant123  (Unit 2A)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
