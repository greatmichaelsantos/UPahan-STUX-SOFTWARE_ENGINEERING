require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  try {
    // Bedrooms on units
    await pool.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS bedrooms VARCHAR(20)`);
    console.log('✓ units.bedrooms');

    // Payment declaration columns
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_of_payment VARCHAR(255)`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS declared_by_tenant BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2)`);
    console.log('✓ payments declaration columns');

    // Widen payment_status CHECK
    await pool.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check`);
    await pool.query(`
      ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check
        CHECK (payment_status IN (
          'paid','unpaid','partial','late','advance','pending',
          'pending_approval','rejected'
        ))
    `);
    console.log('✓ payments_payment_status_check updated');

    // Documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        document_id SERIAL PRIMARY KEY,
        tenant_user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
        document_type VARCHAR(50) NOT NULL,
        id_type VARCHAR(100),
        front_image VARCHAR(255),
        back_image VARCHAR(255),
        contract_file VARCHAR(255),
        contract_start_date DATE,
        contract_end_date DATE,
        notes TEXT,
        status VARCHAR(30) DEFAULT 'pending',
        rejection_reason TEXT,
        uploaded_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ documents table');

    // Profile photo on users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255)`);
    console.log('✓ users.profile_photo');

    // updated_at columns
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    console.log('✓ updated_at columns');

    // Media table (unified photo storage)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS media (
        media_id SERIAL PRIMARY KEY,
        file_path VARCHAR(255) NOT NULL UNIQUE,
        upload_date TIMESTAMP DEFAULT NOW(),
        unit_id INTEGER REFERENCES units(unit_id) ON DELETE CASCADE,
        maintenance_request_id INTEGER REFERENCES maintenance_requests(request_id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ media table');

    // Copy existing unit_photos → media (idempotent via ON CONFLICT)
    await pool.query(`
      INSERT INTO media (file_path, unit_id, upload_date)
      SELECT up.file_path, up.unit_id, up.upload_date FROM unit_photos up
      ON CONFLICT (file_path) DO NOTHING
    `);
    console.log('✓ unit_photos → media');

    // Copy existing maintenance_photos → media
    await pool.query(`
      INSERT INTO media (file_path, maintenance_request_id, upload_date)
      SELECT mp.file_path, mp.request_id, mp.upload_date FROM maintenance_photos mp
      ON CONFLICT (file_path) DO NOTHING
    `);
    console.log('✓ maintenance_photos → media');

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        reference_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ notifications table');

    // Widen month_covered to support range strings like '2026-06 to 2026-07'
    await pool.query(`ALTER TABLE payments ALTER COLUMN month_covered TYPE VARCHAR(50)`);
    console.log('✓ payments.month_covered widened to VARCHAR(50)');

    // Date of birth on users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`);
    console.log('✓ users.date_of_birth');

    // Email verification
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)`);
    console.log('✓ users.is_verified, users.verification_token');

    // Password reset
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    console.log('✓ users.reset_token, users.reset_token_expires');

    // Multi-image proof for payments
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_images TEXT`);
    console.log('✓ payments.proof_images');

    // Inline maintenance photos
    await pool.query(`ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS maintenance_images TEXT`);
    console.log('✓ maintenance_requests.maintenance_images');

    // Payment due day per unit
    await pool.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT 5`);
    console.log('✓ units.due_day');

    // Late payment flag
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE`);
    console.log('✓ payments.is_late');

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
