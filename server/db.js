import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Assuming postgres is running locally on default port 5432
// We use the database name "scanner_db" as requested by the user
// Connection configuration
const poolConfig = process.env.DATABASE_URL
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: process.env.PGUSER || 'postgres',
      host: process.env.PGHOST || 'localhost',
      database: process.env.PGDATABASE || 'scanner_db',
      password: process.env.PGPASSWORD || 'hadzmie1918',
      port: process.env.PGPORT || 5432,
    };

if (process.env.DATABASE_URL) {
  console.log('Database connecting via DATABASE_URL');
} else if (process.env.PGHOST) {
  console.log(`Database connecting to ${process.env.PGHOST}`);
} else {
  console.warn('No database environment variables found. Falling back to localhost:5432');
}

const db = new Pool(poolConfig);

// Initialize database schema
export const initDb = async () => {
  try {
    // 1. Ensure users table exists first
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        studentid TEXT PRIMARY KEY,
        firstname TEXT NOT NULL,
        lastname TEXT NOT NULL,
        middlename TEXT,
        suffix TEXT,
        email TEXT,
        course TEXT NOT NULL,
        yearlevel TEXT NOT NULL,
        section TEXT NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT,
        birthday TEXT,
        address TEXT,
        city TEXT,
        province TEXT,
        zipcode TEXT,
        semester TEXT,
        schoolyear TEXT,
        guardianname TEXT,
        guardianphone TEXT,
        guardianrelation TEXT,
        role TEXT NOT NULL DEFAULT 'student',
        password TEXT NOT NULL
      );
    `);

    // 2. Aggressive Migration: Rename any PK that isn't lowercase "studentid"
    try {
      const pkCheck = await db.query(`
        SELECT a.attname as colname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'users'::regclass AND i.indisprimary
      `);
      
      if (pkCheck.rows.length > 0) {
        const currentPk = pkCheck.rows[0].colname;
        if (currentPk !== 'studentid') {
          console.log(`Detected non-standard PK "${currentPk}" in users table. Renaming to "studentid"...`);
          await db.query(`ALTER TABLE users RENAME COLUMN "${currentPk}" TO studentid`);
        }
      }
    } catch (e) {
      console.log('Skip PK migration (table might not exist yet or other error)');
    }

    // Drop enrollmentstatus column if it exists to clean up schema
    try {
      await db.query(`ALTER TABLE users DROP COLUMN IF EXISTS enrollmentstatus`);
      console.log('Successfully dropped enrollmentstatus column from users table');
    } catch (e) {
      console.log('Skip dropping enrollmentstatus column:', e.message);
    }

    // Ensure profile image columns exist
    try {
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profileimage TEXT`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profileimageupdates INTEGER DEFAULT 0`);
      console.log('Successfully verified profile image columns in users table');
    } catch (e) {
      console.log('Skip adding profile image columns:', e.message);
    }

    // 3. Normalize other columns if they exist in mixed case
    const columnsToFix = {
      'firstName': 'firstname', 'lastName': 'lastname', 'middleName': 'middlename',
      'yearLevel': 'yearlevel', 'zipCode': 'zipcode', 'schoolYear': 'schoolyear',
      'guardianName': 'guardianname',
      'guardianPhone': 'guardianphone', 'guardianRelation': 'guardianrelation'
    };

    for (const [oldName, newName] of Object.entries(columnsToFix)) {
      try {
        await db.query(`ALTER TABLE users RENAME COLUMN "${oldName}" TO ${newName}`);
        console.log(`Renamed users column "${oldName}" to "${newName}"`);
      } catch (e) { /* Column doesn't exist in that casing, ignore */ }
    }

    // 4. Create other tables one by one
    const otherTables = [
      `CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'officer',
        password TEXT NOT NULL,
        createdat TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        course TEXT NOT NULL,
        year TEXT NOT NULL,
        section TEXT NOT NULL,
        UNIQUE(course, year, section)
      )`,
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        targetcourses TEXT,
        status TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        studentid TEXT NOT NULL,
        name TEXT NOT NULL,
        course TEXT NOT NULL,
        section TEXT NOT NULL,
        gender TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL,
        eventid TEXT NOT NULL,
        eventname TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        FOREIGN KEY(studentid) REFERENCES users(studentid)
      )`,
      `CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_studentid ON attendance(studentid)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance(eventid)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        schoolname TEXT NOT NULL,
        academicyear TEXT NOT NULL,
        semester TEXT NOT NULL,
        latethreshold TEXT NOT NULL,
        CONSTRAINT one_row CHECK (id = 1)
      )`,
      `CREATE TABLE IF NOT EXISTS qualified_students (
        studentid TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`
    ];

    for (const query of otherTables) {
      await db.query(query);
    }

    // Migration for qualified_students table: firstname + lastname -> name
    const hasNameCol = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='qualified_students' AND column_name='name'
    `);
    if (hasNameCol.rows.length === 0) {
      console.log('Migrating qualified_students table to name format...');
      const cols = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='qualified_students' AND column_name IN ('firstname', 'lastname')
      `);
      if (cols.rows.length > 0) {
        await db.query(`ALTER TABLE qualified_students ADD COLUMN name TEXT`);
        await db.query(`UPDATE qualified_students SET name = TRIM(CONCAT(firstname, ' ', lastname))`);
        await db.query(`ALTER TABLE qualified_students ALTER COLUMN name SET NOT NULL`);
        await db.query(`ALTER TABLE qualified_students DROP COLUMN firstname`);
        await db.query(`ALTER TABLE qualified_students DROP COLUMN lastname`);
        console.log('Migration of qualified_students table completed successfully.');
      } else {
        await db.query(`ALTER TABLE qualified_students ADD COLUMN name TEXT NOT NULL`);
      }
    }

    // 5. Initialize default settings if missing
    const settingsCheck = await db.query('SELECT 1 FROM settings WHERE id = 1');
    if (settingsCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO settings (id, schoolname, academicyear, semester, latethreshold)
        VALUES (1, 'Zamboanga del Sur Provincial Government College', '2024-2025', '2nd', '08:30')
      `);
      console.log('Default system settings initialized');
    }

    // 6. Automated Admin Seeding — always upsert to keep password in sync with .env
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@zdspgc.edu.ph';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName     = process.env.ADMIN_NAME     || 'System Admin';
    const adminRole     = 'superadmin';

    console.log(`Upserting superadmin account (${adminEmail})...`);
    await db.query(`
      INSERT INTO admins (name, email, role, password, createdat)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET name = $1, password = $4
    `, [adminName, adminEmail, adminRole, adminPassword, new Date().toISOString()]);

    // Ensure admin also exists in users table for backward compatibility/unified login
    await db.query(`
      INSERT INTO users (
        studentid, firstname, lastname, email, course, yearlevel, section, gender, role, password
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (studentid) DO UPDATE SET password = $10, email = $4
    `, ['ADMIN-001', 'System', 'Admin', adminEmail, 'N/A', 'N/A', 'N/A', 'Male', 'admin', adminPassword]);
    console.log('Admin credentials synced to database successfully.');

    // 7. Seed initial courses if empty
    const courseCheck = await db.query('SELECT 1 FROM courses LIMIT 1');
    if (courseCheck.rows.length === 0) {
      const initialCourses = ['BSIS', 'ACT', 'BSCS', 'BSHM', 'BSED', 'BEED'];
      for (const course of initialCourses) {
        await db.query('INSERT INTO courses (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [course]);
      }
      console.log('Initial courses seeded.');
    }

    console.log('PostgreSQL Database schema initialized and migrated');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
};

export default db;
