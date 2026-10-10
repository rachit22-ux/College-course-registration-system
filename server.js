const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const starterData = {
  courses: [
    { code: 'CS101', name: 'Introduction to Programming', department: 'Computer Science', credits: 4 },
    { code: 'CS102', name: 'Data Structures', department: 'Computer Science', credits: 4 },
    { code: 'CS201', name: 'Database Management System', department: 'Computer Science', credits: 3 },
    { code: 'CS202', name: 'Web Development', department: 'Information Technology', credits: 3 },
    { code: 'CS301', name: 'Operating Systems', department: 'Computer Science', credits: 4 },
    { code: 'CS302', name: 'Computer Networks', department: 'Information Technology', credits: 3 },
    { code: 'CS401', name: 'Artificial Intelligence', department: 'Computer Science', credits: 4 },
    { code: 'CS402', name: 'Machine Learning', department: 'Computer Science', credits: 4 }
  ],
  registrations: []
};

async function readDB() {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    await writeDB(starterData);
    return JSON.parse(JSON.stringify(starterData));
  }
}
async function writeDB(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Demo accounts for this college project. Replace with a database and secure authentication before production use.
const STUDENT = { id: 'STU001', name: 'Demo Student', password: 'student123' };
const ADMIN = { username: 'admin', password: 'admin123' };

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'EduCollege API is running' }));

app.post('/api/login/student', (req, res) => {
  const { studentId, password } = req.body || {};
  if (studentId !== STUDENT.id || password !== STUDENT.password) {
    return res.status(401).json({ error: 'Invalid Student ID or password.' });
  }
  res.json({ user: { id: STUDENT.id, name: STUDENT.name, role: 'student' } });
});

app.post('/api/login/admin', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN.username || password !== ADMIN.password) {
    return res.status(401).json({ error: 'Invalid admin username or password.' });
  }
  res.json({ user: { username: ADMIN.username, role: 'admin' } });
});

app.post('/api/logout', (req, res) => res.json({ message: 'Logged out' }));

app.get('/api/courses', asyncRoute(async (req, res) => {
  const db = await readDB();
  res.json({ courses: db.courses });
}));

app.post('/api/courses', asyncRoute(async (req, res) => {
  const { code, name, department, credits } = req.body || {};
  if (![code, name, department].every(v => typeof v === 'string' && v.trim()) ||
      !Number.isInteger(Number(credits)) || Number(credits) < 1 || Number(credits) > 30) {
    return res.status(400).json({ error: 'Enter a course code, name, department, and valid credits (1–30).' });
  }
  const db = await readDB();
  const cleanCode = code.trim().toUpperCase();
  if (db.courses.some(c => c.code.toUpperCase() === cleanCode)) {
    return res.status(409).json({ error: 'A course with that code already exists.' });
  }
  db.courses.push({ code: cleanCode, name: name.trim(), department: department.trim(), credits: Number(credits) });
  await writeDB(db);
  res.status(201).json({ message: 'Course created', course: db.courses[db.courses.length - 1] });
}));

app.delete('/api/courses/:code', asyncRoute(async (req, res) => {
  const db = await readDB();
  const code = req.params.code.toUpperCase();
  const before = db.courses.length;
  db.courses = db.courses.filter(c => c.code.toUpperCase() !== code);
  if (db.courses.length === before) return res.status(404).json({ error: 'Course not found.' });
  db.registrations = db.registrations.filter(r => r.courseCode.toUpperCase() !== code);
  await writeDB(db);
  res.json({ message: 'Course deleted' });
}));

app.get('/api/registrations', asyncRoute(async (req, res) => {
  const db = await readDB();
  const { studentId } = req.query;
  const registrations = studentId
    ? db.registrations.filter(r => r.studentId === studentId)
    : db.registrations;
  res.json({ registrations });
}));

app.post('/api/registrations', asyncRoute(async (req, res) => {
  const { studentId, courseCode } = req.body || {};
  if (studentId !== STUDENT.id || typeof courseCode !== 'string' || !courseCode.trim()) {
    return res.status(400).json({ error: 'A valid student and course are required.' });
  }
  const db = await readDB();
  const course = db.courses.find(c => c.code.toUpperCase() === courseCode.trim().toUpperCase());
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (db.registrations.some(r => r.studentId === studentId && r.courseCode === course.code)) {
    return res.status(409).json({ error: 'You have already registered for this course.' });
  }
  const registration = {
    id: Date.now().toString(),
    studentId: STUDENT.id,
    studentName: STUDENT.name,
    courseCode: course.code,
    courseName: course.name,
    department: course.department,
    credits: course.credits,
    status: 'Registered',
    createdAt: new Date().toISOString()
  };
  db.registrations.push(registration);
  await writeDB(db);
  res.status(201).json({ message: 'Registration successful', registration });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error. Check the server console.' });
});

app.listen(PORT, () => console.log(`EduCollege is running at http://localhost:${PORT}`));
