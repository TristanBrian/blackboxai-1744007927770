const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const SECRET_KEY = 'kindergarten-secret-key-2024';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize JSON files if they don't exist
const initFile = (filePath, initialData = []) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData));
  }
};

initFile(path.join(dataDir, 'users.json'), [
  {
    id: 1,
    email: 'admin@kindergarten.com',
    password: bcrypt.hashSync('admin123', 8),
    role: 'admin'
  }
]);

initFile(path.join(dataDir, 'students.json'));
initFile(path.join(dataDir, 'teachers.json'));
initFile(path.join(dataDir, 'classes.json'));

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(403).send({ message: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'Unauthorized' });
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

// Authentication routes
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json')));
  const user = users.find(u => u.email === email);

  if (!user) return res.status(404).send({ message: 'User not found' });
  
  const passwordIsValid = bcrypt.compareSync(password, user.password);
  if (!passwordIsValid) return res.status(401).send({ message: 'Invalid password' });

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
    expiresIn: 86400 // 24 hours
  });

  res.status(200).send({
    id: user.id,
    email: user.email,
    role: user.role,
    accessToken: token
  });
});

// Dashboard routes
app.get('/api/dashboard/stats', authenticateJWT, (req, res) => {
  try {
    const students = JSON.parse(fs.readFileSync(path.join(dataDir, 'students.json')));
    const teachers = JSON.parse(fs.readFileSync(path.join(dataDir, 'teachers.json')));
    const classes = JSON.parse(fs.readFileSync(path.join(dataDir, 'classes.json')));
    
    res.status(200).send({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalClasses: classes.length,
      recentActivities: [
        {
          icon: 'fas fa-child',
          color: 'text-blue-500',
          text: `${students.slice(-5).length} new students enrolled`
        },
        {
          icon: 'fas fa-chalkboard-teacher',
          color: 'text-purple-500',
          text: `${teachers.slice(-2).length} new teachers added`
        }
      ]
    });
  } catch (err) {
    res.status(500).send({ message: 'Error fetching dashboard data' });
  }
});

// Student routes
app.get('/api/students', authenticateJWT, (req, res) => {
  try {
    const students = JSON.parse(fs.readFileSync(path.join(dataDir, 'students.json')));
    res.status(200).send(students);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching students' });
  }
});

app.post('/api/students', authenticateJWT, (req, res) => {
  try {
    const students = JSON.parse(fs.readFileSync(path.join(dataDir, 'students.json')));
    const newStudent = { id: Date.now().toString(), ...req.body };
    students.push(newStudent);
    fs.writeFileSync(path.join(dataDir, 'students.json'), JSON.stringify(students));
    res.status(201).send(newStudent);
  } catch (err) {
    res.status(500).send({ message: 'Error creating student' });
  }
});

// Teacher routes
app.get('/api/teachers', authenticateJWT, (req, res) => {
  try {
    const teachers = JSON.parse(fs.readFileSync(path.join(dataDir, 'teachers.json')));
    res.status(200).send(teachers);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching teachers' });
  }
});

// Class routes
app.get('/api/classes', authenticateJWT, (req, res) => {
  try {
    const classes = JSON.parse(fs.readFileSync(path.join(dataDir, 'classes.json')));
    res.status(200).send(classes);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching classes' });
  }
});

// Attendance routes
app.get('/api/attendance', authenticateJWT, (req, res) => {
  try {
    const { date, class: classFilter, status } = req.query;
    let attendance = JSON.parse(fs.readFileSync(path.join(dataDir, 'attendance.json')));
    
    if (date) attendance = attendance.filter(a => a.date === date);
    if (classFilter) attendance = attendance.filter(a => a.class === classFilter);
    if (status) attendance = attendance.filter(a => a.status === status.toLowerCase());
    
    res.status(200).send(attendance);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching attendance' });
  }
});

app.post('/api/attendance', authenticateJWT, (req, res) => {
  try {
    const { date, class: classLevel, records } = req.body;
    let attendance = JSON.parse(fs.readFileSync(path.join(dataDir, 'attendance.json')));
    
    // Remove existing records for this date and class
    attendance = attendance.filter(a => !(a.date === date && a.class === classLevel));
    
    // Add new records
    const newRecords = records.map(record => ({
      ...record,
      date,
      class: classLevel
    }));
    
    attendance.push(...newRecords);
    fs.writeFileSync(path.join(dataDir, 'attendance.json'), JSON.stringify(attendance));
    
    res.status(201).send({ message: 'Attendance saved successfully' });
  } catch (err) {
    res.status(500).send({ message: 'Error saving attendance' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});