require('dotenv').config();
const express = require('express');
const path = require('path');
const route = require('./routes/index');
const server = express();
const PORT = 8080;
const cors = require('cors');

// Static files
server.use('/templates', express.static(path.join(__dirname, 'templates')));
// Serve output documents for download
server.use('/download', express.static(path.join(__dirname, 'templates/output')));
// Frontend removed; no public static directory

server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cors());

// Main routes (including dashboard)
server.use('/', (req, res) => {
  res.json({ status: 'OK', message: 'Generate Document API (EdDSA) running' });
});
// API routes  
server.use('/api', route);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints at http://localhost:${PORT}/api`);
});
