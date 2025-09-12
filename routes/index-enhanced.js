// routes/index-enhanced.js - Update existing routes file
const express = require('express');
const router = express.Router();

// Existing routes
const { generateDocument, getAvailableProdi, getRequiredFields } = require('../controllers');
const documentConfigRoutes = require('./document-config');

// NEW: EdDSA Multi-Signature routes
const eddsaRoutes = require('./eddsa-routes');

// Mount EdDSA routes with prefix
router.use('/eddsa', eddsaRoutes);

// Mount document config routes
router.use('/document-config', documentConfigRoutes);

// Existing document generation routes (maintain backward compatibility)
router.post('/generate-document/:type/:prodi', generateDocument);
router.get('/templates', getAvailableProdi);
router.get('/templates/:type', getAvailableProdi);
router.get('/templates/:type/:prodi/fields', getRequiredFields);

// Backward compatibility - redirect ke endpoint lama (default ke informatika)
router.post('/generate-document/:type', (req, res, next) => {
  req.params.prodi = 'informatika'; // default prodi
  generateDocument(req, res, next);
});

// Quick verification endpoint (short URL for QR codes)
router.get('/v/:documentId', async (req, res) => {
  // Redirect to full verification
  res.redirect(`/api/eddsa/verify/${req.params.documentId}`);
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      eddsa: 'enabled',
      multisignature: 'enabled',
      qr_generation: 'enabled'
    }
  });
});

module.exports = router;
