
const express = require('express');
const path = require('path');
const router = express.Router();
const { generateDocument, getAvailableProdi, getRequiredFields } = require('../controllers');

// Import document config routes
// const documentConfigRoutes = require('./document-config');

// Document config routes
// router.use('/document-config', documentConfigRoutes);

// Download endpoint with proper headers
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../templates/output', filename);

  // Set headers for download
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Send file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).json({
        success: false,
        message: 'File tidak ditemukan'
      });
    }
  });
});

// Generate document dengan prodi dinamis
router.post('/generate-document/:type/:prodi', generateDocument);

// Mendapatkan daftar prodi yang tersedia
router.get('/templates', getAvailableProdi);
router.get('/templates/:type', getAvailableProdi);

// Mendapatkan field yang diperlukan untuk template tertentu
router.get('/templates/:type/:prodi/fields', getRequiredFields);

// Backward compatibility - redirect ke endpoint lama (default ke informatika)
router.post('/generate-document/:type', (req, res, next) => {
  req.params.prodi = 'informatika'; // default prodi
  generateDocument(req, res, next);
});

module.exports = router;
