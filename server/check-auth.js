import db from './db.js';

async function checkAuth() {
  try {
    console.log('\n=== ADMINS TABLE ===');
    const admins = await db.query('SELECT id, name, email, role, password FROM admins');
    console.log(JSON.stringify(admins.rows, null, 2));

    console.log('\n=== USERS TABLE (admin role) ===');
    const adminUsers = await db.query("SELECT studentid, firstname, email, role, password FROM users WHERE role = 'admin'");
    console.log(JSON.stringify(adminUsers.rows, null, 2));

    console.log('\n=== USERS TABLE (student role - first 3) ===');
    const students = await db.query("SELECT studentid, firstname, email, role, password FROM users WHERE role = 'student' LIMIT 3");
    console.log(JSON.stringify(students.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAuth();
