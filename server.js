require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const route = require('./routes/index');
const server = express();
const PORT = 8080;
const cors = require('cors');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { prodi } = req.params;
    const uploadPath = path.join(__dirname, 'templates', prodi);
    require('fs-extra').ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const { type } = req.params;
    cb(null, `${type}.docx`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Make upload middleware available to routes
server.set('upload', upload);

// Static files
server.use('/templates', express.static(path.join(__dirname, 'templates')));
// Serve output documents for download
server.use('/download', express.static(path.join(__dirname, 'templates/output')));
// Frontend removed; no public static directory

server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cors());

// API routes - Must come before root route
server.use('/api', route);

// Main root route - This should come AFTER /api routes
server.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Generate Document API (EdDSA) running' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints at http://localhost:${PORT}/api`);
});
