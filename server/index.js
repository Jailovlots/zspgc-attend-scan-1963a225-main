import express from 'express';
import cors from 'cors';
import db, { initDb } from './db.js';
import dotenv from 'dotenv';
import redisClient from './redis.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Serve static frontend files with CDN/Browser caching enabled
app.use(express.static(path.join(__dirname, '../dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // Don't cache index.html so frontend updates apply immediately
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      // Cache JS, CSS, and images for 1 year (CDN standard)
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Health check route - helps Render verify the service is up immediately
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});


// Initialize Database
const startServer = async () => {
  try {
    await initDb();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
    // We still continue to start the server so Render's health check passes
    // and we can see error logs.
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

// PostgreSQL lowercases all unquoted column names (firstName → firstname).
// This mapper converts the raw DB row back to the camelCase shape the frontend expects.
const mapUser = (row) => ({
  studentId: row.studentid ?? row.studentId,
  firstName: row.firstname ?? row.firstName,
  lastName: row.lastname ?? row.lastName,
  middleName: row.middlename ?? row.middleName ?? '',
  suffix: row.suffix ?? '',
  email: row.email ?? '',
  course: row.course ?? '',
  yearLevel: row.yearlevel ?? row.yearLevel ?? '',
  section: row.section ?? '',
  gender: row.gender ?? '',
  phone: row.phone ?? '',
  birthday: row.birthday ?? '',
  address: row.address ?? '',
  city: row.city ?? '',
  province: row.province ?? '',
  zipCode: row.zipcode ?? row.zipCode ?? '',
  semester: row.semester ?? '',
  schoolYear: row.schoolyear ?? row.schoolYear ?? '',
  guardianName: row.guardianname ?? row.guardianName ?? '',
  guardianPhone: row.guardianphone ?? row.guardianPhone ?? '',
  guardianRelation: row.guardianrelation ?? row.guardianRelation ?? '',
  role: row.role ?? 'student',
  password: row.password ?? '',
  profileImage: row.profileimage ?? row.profileImage ?? '',
  profileImageUpdates: row.profileimageupdates ?? row.profileImageUpdates ?? 0,
});

const mapAdmin = (row) => ({
  id: row.id,
  name: row.name ?? '',
  email: row.email ?? '',
  role: row.role ?? 'officer',
  password: row.password ?? '',
  createdAt: row.createdat ?? row.createdAt ?? '',
});

const mapAttendance = (row) => ({
  id: row.id,
  studentId: row.studentid ?? row.studentId,
  name: row.name ?? '',
  course: row.course ?? '',
  section: row.section ?? '',
  gender: row.gender ?? '',
  time: row.time ?? '',
  status: row.status ?? 'Present',
  eventId: row.eventid ?? row.eventId ?? '',
  eventName: row.eventname ?? row.eventName ?? '',
  timestamp: row.timestamp ? parseInt(row.timestamp, 10) : Date.now(),
});

const mapSettings = (row) => ({
  schoolName: row.schoolname ?? row.schoolName,
  academicYear: row.academicyear ?? row.academicYear,
  semester: row.semester,
  lateThreshold: row.latethreshold ?? row.lateThreshold,
});

// --- Auth Routes ---
app.post('/api/login', async (req, res) => {
  const { loginId, password, role } = req.body;

  try {
    if (role === 'admin') {
      // Check dedicated admins table first
      const adminResult = await db.query(
        'SELECT * FROM admins WHERE LOWER(email) = LOWER($1) AND password = $2',
        [loginId, password]
      );
      if (adminResult.rows.length > 0) {
        const admin = mapAdmin(adminResult.rows[0]);
        // Shape it so the frontend session works (role = 'admin')
        return res.json({
          studentId: `ADM-${admin.id}`,
          firstName: admin.name.split(' ')[0] || admin.name,
          lastName: admin.name.split(' ').slice(1).join(' ') || '',
          email: admin.email,
          role: 'admin',
          adminRole: admin.role,
          adminId: admin.id,
          course: 'N/A', yearLevel: 'N/A', section: 'N/A', gender: 'Male',
        });
      }
      // Fallback: check users table with role=admin (backward compat)
      const userResult = await db.query(
        'SELECT * FROM users WHERE email = $1 AND password = $2 AND role = $3',
        [loginId, password, 'admin']
      );
      if (userResult.rows.length > 0) return res.json(mapUser(userResult.rows[0]));
      return res.status(401).json({ error: 'Invalid admin credentials' });
    } else {
      const userResult = await db.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND password = $2 AND role = $3',
        [loginId, password, 'student']
      );
      if (userResult.rows.length > 0) return res.json(mapUser(userResult.rows[0]));
      return res.status(401).json({ error: 'Invalid credentials or role mismatch' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const u = req.body;
  try {
    // 3. Check if an account is already registered for this student ID to prevent multiple account creations
    const existingUser = await db.query(
      'SELECT 1 FROM users WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($1))',
      [u.studentId]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: `An account is already registered under Student ID "${u.studentId}".`
      });
    }

    await db.query(`
      INSERT INTO users (
        studentid, firstname, lastname, middlename, suffix, email, 
        course, yearlevel, section, gender, phone, birthday, 
        address, city, province, zipcode, semester, schoolyear, 
        guardianname, guardianphone, guardianrelation, 
        role, password
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    `, [
      u.studentId.trim().toUpperCase(), u.firstName, u.lastName, u.middleName || '', u.suffix || '', u.email || '',
      u.course, u.yearLevel, u.section, u.gender, u.phone || '', u.birthday || '',
      u.address || '', u.city || '', u.province || '', u.zipCode || '', u.semester || '', u.schoolYear || '',
      u.guardianName || '', u.guardianPhone || '', u.guardianRelation || '',
      u.role || 'student', u.password
    ]);
    studentsCache.data = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    // PostgreSQL unique violation error code is 23505
    if (err.code === '23505') {
      res.status(400).json({ error: 'User with this Student ID already exists.' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// --- Qualified Students API ---
app.get('/api/qualified-students', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM qualified_students ORDER BY studentid ASC');
    res.json(result.rows.map(row => ({
      studentId: row.studentid,
      name: row.name
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/qualified-students/import', async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Payload must be an array of student records.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const item of list) {
      if (!item.studentId || !item.name) {
        throw new Error(`Invalid record details: ${JSON.stringify(item)}. All fields (studentId, name) are required.`);
      }
      await client.query(`
        INSERT INTO qualified_students (studentid, name)
        VALUES ($1, $2)
        ON CONFLICT (studentid) DO UPDATE SET name = $2
      `, [item.studentId.trim().toUpperCase(), item.name.trim()]);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: list.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/qualified-students', async (req, res) => {
  try {
    await db.query('DELETE FROM qualified_students');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/qualified-students/:studentid', async (req, res) => {
  const { studentid } = req.params;
  try {
    await db.query('DELETE FROM qualified_students WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($1))', [studentid]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let studentsCache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 60 * 1000; // 1 minute

app.get('/api/students', async (req, res) => {
  try {
    const { page, limit } = req.query;
    let students = [];
    const now = Date.now();

    if (studentsCache.data && (now - studentsCache.timestamp < CACHE_TTL)) {
      students = studentsCache.data;
    } else {
      const studentsResult = await db.query('SELECT * FROM users WHERE role = $1', ['student']);
      students = studentsResult.rows.map(mapUser);
      studentsCache.data = students;
      studentsCache.timestamp = now;
    }

    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = pageNum * limitNum;
      students = students.slice(startIndex, endIndex);
    }

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const userResult = await db.query('SELECT * FROM users WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($1))', [id]);
    if (userResult.rows.length > 0) {
      res.json(mapUser(userResult.rows[0]));
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;   // original studentId
  const u = req.body;
  const newId = (u.studentId || id).trim().toUpperCase();
  const oldId = id.trim().toUpperCase();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // If the studentId is changing, handle FK constraints first
    if (newId !== oldId) {
      // Check the new ID isn't already taken by another student
      const conflict = await client.query('SELECT 1 FROM users WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($1))', [newId]);
      if (conflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Student ID "${newId}" is already in use.` });
      }
      // Reassign attendance records to the new ID before updating PK
      await client.query('UPDATE attendance SET studentid = $1 WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($2))', [newId, oldId]);
    }

    // Update the student record (including the PK if it changed)
    await client.query(`
      UPDATE users SET
        studentid = $1,
        firstname = $2, lastname = $3, middlename = $4, suffix = $5, email = $6,
        course = $7, yearlevel = $8, section = $9, gender = $10, phone = $11,
        birthday = $12, address = $13, city = $14, province = $15, zipcode = $16,
        semester = $17, schoolyear = $18, guardianname = $19,
        guardianphone = $20, guardianrelation = $21, password = $22
      WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($23))
    `, [
      newId,
      u.firstName, u.lastName, u.middleName || '', u.suffix || '', u.email || '',
      u.course, u.yearLevel, u.section, u.gender, u.phone || '',
      u.birthday || '', u.address || '', u.city || '', u.province || '', u.zipCode || '',
      u.semester || '', u.schoolYear || '', u.guardianName || '',
      u.guardianPhone || '', u.guardianRelation || '', u.password,
      oldId
    ]);

    await client.query('COMMIT');
    studentsCache.data = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/students/:id/avatar', async (req, res) => {
  const { id } = req.params;
  const { profileImage } = req.body;

  try {
    const userRes = await db.query('SELECT profileimageupdates, studentid FROM users WHERE LOWER(TRIM(studentid)) = LOWER(TRIM($1))', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const realId = userRes.rows[0].studentid; // use actual DB value for UPDATE
    const currentUpdates = userRes.rows[0].profileimageupdates || 0;
    if (currentUpdates >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum limit of 2 profile photo updates.' });
    }

    await db.query(
      'UPDATE users SET profileimage = $1, profileimageupdates = $2 WHERE studentid = $3',
      [profileImage, currentUpdates + 1, realId]
    );

    studentsCache.data = null; // Invalidate cache
    res.json({ success: true, profileImageUpdates: currentUpdates + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/students/:id', async (req, res) => {
  try {
    // The frontend specifies that attendance records should remain even if the student is deleted.
    // Drop the strict foreign key constraint so we can orphan the attendance records gracefully.
    try {
      await db.query('ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_studentid_fkey');
    } catch(e) { /* ignore if already dropped or wrong name */ }

    await db.query('DELETE FROM users WHERE studentid = $1', [req.params.id]);
    studentsCache.data = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin/Officer Account Routes ---
app.get('/api/admins', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM admins ORDER BY id ASC');
    res.json(result.rows.map(mapAdmin));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admins', async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  try {
    const result = await db.query(
      'INSERT INTO admins (name, email, role, password, createdat) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, role || 'officer', password, new Date().toISOString()]
    );
    res.json(mapAdmin(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'An account with this email already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admins/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body;
  try {
    const result = await db.query(
      'UPDATE admins SET name = $1, email = $2, role = $3, password = $4 WHERE id = $5 RETURNING *',
      [name, email, role || 'officer', password, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Officer not found.' });
    res.json(mapAdmin(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'An account with this email already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Sections Routes ---
app.get('/api/sections', async (req, res) => {
  try {
    const coursesResult = await db.query('SELECT name FROM courses');
    const sectionsResult = await db.query('SELECT * FROM sections');
    
    const grouped = {};
    // Initialize all courses even if they have no sections
    coursesResult.rows.forEach(c => {
      grouped[c.name] = {};
    });

    sectionsResult.rows.forEach(s => {
      if (!grouped[s.course]) grouped[s.course] = {};
      if (!grouped[s.course][s.year]) grouped[s.course][s.year] = [];
      grouped[s.course][s.year].push(s.section);
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sections', async (req, res) => {
  const { course, year, section } = req.body;
  try {
    await db.query('INSERT INTO courses (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [course]);
    await db.query('INSERT INTO sections (course, year, section) VALUES ($1, $2, $3)', [course, year, section]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sections/bulk', async (req, res) => {
  const sections = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // We don't wipe everything if we want to keep course names
    // but the frontend sends the whole state, so we update
    
    // 1. Get current courses and sections
    await client.query('DELETE FROM sections');
    
    // We only delete courses that are no longer in the provided 'sections' object
    const providedCourses = Object.keys(sections);
    if (providedCourses.length > 0) {
      await client.query('DELETE FROM courses WHERE name NOT IN (' + providedCourses.map((_, i) => `$${i+1}`).join(',') + ')', providedCourses);
    } else {
      await client.query('DELETE FROM courses');
    }

    for (const [course, years] of Object.entries(sections)) {
      // Ensure course exists
      await client.query('INSERT INTO courses (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [course]);
      
      for (const [year, sctns] of Object.entries(years)) {
        for (const s of sctns) {
          await client.query('INSERT INTO sections (course, year, section) VALUES ($1, $2, $3)', [course, year, s]);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/sections', async (req, res) => {
  const { course, year, section } = req.body;
  try {
    await db.query('DELETE FROM sections WHERE course = $1 AND year = $2 AND section = $3', [course, year, section]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sections/rename', async (req, res) => {
  const { oldName, newName, type, course, year } = req.body;
  try {
    if (type === 'course') {
      await db.query('UPDATE courses SET name = $1 WHERE name = $2', [newName, oldName]);
      await db.query('UPDATE sections SET course = $1 WHERE course = $2', [newName, oldName]);
    } else if (type === 'section') {
      await db.query('UPDATE sections SET section = $1 WHERE section = $2 AND course = $3 AND year = $4', [newName, oldName, course, year]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Events Routes ---
app.get('/api/events', async (req, res) => {
  try {
    const eventsResult = await db.query('SELECT * FROM events');
    eventsResult.rows.forEach(e => {
      e.targetCourses = JSON.parse(e.targetcourses || e.targetCourses || '[]');
    });
    res.json(eventsResult.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  const event = req.body;
  try {
    // PostgreSQL uses INSERT ... ON CONFLICT DO UPDATE instead of INSERT OR REPLACE
    await db.query(`
      INSERT INTO events (id, name, date, time, location, description, category, targetCourses, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        date = EXCLUDED.date,
        time = EXCLUDED.time,
        location = EXCLUDED.location,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        targetCourses = EXCLUDED.targetCourses,
        status = EXCLUDED.status
    `, [event.id, event.name, event.date, event.time, event.location, event.description, event.category, JSON.stringify(event.targetCourses), event.status]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Attendance Routes ---
app.get('/api/attendance', async (req, res) => {
  try {
    const recordsResult = await db.query('SELECT * FROM attendance ORDER BY timestamp DESC');
    res.json(recordsResult.rows.map(mapAttendance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  const r = req.body;
  // Normalize studentId to UPPERCASE so it always matches the users table PK
  const studentId = (r.studentId || r.id || '').trim().toUpperCase();
  console.log('[API] POST /api/attendance →', studentId, '| event:', r.eventId);
  try {
    // Use INSERT ... ON CONFLICT DO NOTHING to silently skip duplicate student+event pairs
    const result = await db.query(`
      INSERT INTO attendance (studentid, name, course, section, gender, time, status, eventid, eventname, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [studentId, r.name, r.course, r.section, r.gender, r.time, r.status, r.eventId, r.eventName, r.timestamp]);

    if (result.rows.length > 0) {
      console.log('[API] Attendance saved, db id:', result.rows[0].id);
      res.json({ ok: true, record: mapAttendance(result.rows[0]) });
    } else {
      // Row already existed (duplicate) — treat as success
      console.log('[API] Duplicate attendance record ignored for:', studentId, r.eventId);
      res.json({ ok: true, duplicate: true });
    }
  } catch (err) {
    console.error('[API] Error saving attendance to DB:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});


app.delete('/api/attendance/clear', async (req, res) => {
  try {
    await db.query('TRUNCATE attendance RESTART IDENTITY');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs must be a non-empty array' });
  }

  try {
    await db.query('DELETE FROM attendance WHERE id = ANY($1)', [ids]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Settings Routes ---
app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings WHERE id = 1');
    if (result.rows.length > 0) {
      res.json(mapSettings(result.rows[0]));
    } else {
      res.status(404).json({ error: 'Settings not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const s = req.body;
  try {
    await db.query(`
      INSERT INTO settings (id, schoolname, academicyear, semester, latethreshold)
      VALUES (1, $1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        schoolname = EXCLUDED.schoolname,
        academicyear = EXCLUDED.academicyear,
        semester = EXCLUDED.semester,
        latethreshold = EXCLUDED.latethreshold
    `, [s.schoolName, s.academicYear, s.semester, s.lateThreshold]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Migration Route ---
app.post('/api/migrate', async (req, res) => {
  const { users, sections, events, attendance } = req.body;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (users) {
      for (const u of users) {
        await client.query(`
          INSERT INTO users (
            studentid, firstname, lastname, middlename, suffix, email, 
            course, yearlevel, section, gender, phone, birthday, 
            address, city, province, zipcode, semester, schoolyear, 
            guardianname, guardianphone, guardianrelation, 
            role, password
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (studentid) DO NOTHING
        `, [
          u.studentId, u.firstName, u.lastName, u.middleName || '', u.suffix || '', u.email || '',
          u.course, u.yearLevel, u.section, u.gender, u.phone || '', u.birthday || '',
          u.address || '', u.city || '', u.province || '', u.zipCode || '', u.semester || '', u.schoolYear || '',
          u.guardianName || '', u.guardianPhone || '', u.guardianRelation || '',
          u.role || 'student', u.password
        ]);
      }
    }

    if (sections) {
      for (const [course, years] of Object.entries(sections)) {
        for (const [year, sctns] of Object.entries(years)) {
          for (const s of sctns) {
            // Postgres unique constraint
            await client.query(`
               INSERT INTO sections (course, year, section) 
               VALUES ($1, $2, $3)
               ON CONFLICT (course, year, section) DO NOTHING
            `, [course, year, s]);
          }
        }
      }
    }

    if (events) {
      for (const e of events) {
        await client.query(`
            INSERT INTO events (id, name, date, time, location, description, category, targetCourses, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        `, [e.id, e.name, e.date, e.time, e.location, e.description, e.category, JSON.stringify(e.targetCourses), e.status]);
      }
    }

    if (attendance) {
      for (const r of attendance) {
        // No unique constraint besides ID, so just insert
        await client.query(`
            INSERT INTO attendance (studentid, name, course, section, gender, time, status, eventid, eventname, timestamp) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         `, [r.id, r.name, r.course, r.section, r.gender, r.time, r.status, r.eventId, r.eventName, r.timestamp]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.use((req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));

// Remove the bottom app.listen as it's now inside startServer
