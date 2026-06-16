import db from './db.js';

async function fixAdmin() {
  const adminEmail = 'admin@zdspgc.edu.ph';
  const adminPassword = 'admin123';
  const adminName = 'System Admin';

  try {
    console.log('=== Fixing Admin Credentials ===');

    // 1. Upsert into admins table
    const result = await db.query(
      `INSERT INTO admins (name, email, role, password, createdat)
       VALUES ($1, $2, 'superadmin', $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = $1, password = $3
       RETURNING *`,
      [adminName, adminEmail, adminPassword, new Date().toISOString()]
    );
    console.log('admins table:', result.rows[0]);

    // 2. Upsert into users table
    const result2 = await db.query(
      `INSERT INTO users (studentid, firstname, lastname, email, course, yearlevel, section, gender, role, password)
       VALUES ('ADMIN-001', 'System', 'Admin', $1, 'N/A', 'N/A', 'N/A', 'Male', 'admin', $2)
       ON CONFLICT (studentid) DO UPDATE SET password = $2, email = $1
       RETURNING studentid, email, role, password`,
      [adminEmail, adminPassword]
    );
    console.log('users table:', result2.rows[0]);

    console.log('\n✅ Admin credentials synced successfully!');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     admin`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixAdmin();
