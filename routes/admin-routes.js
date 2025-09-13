// routes/admin-routes.js
const express = require('express');
const AdminController = require('../controllers/admin-controller');

const router = express.Router();
const adminController = new AdminController();

// ================================
// SIGNATURE CONFIGURATION ROUTES
// ================================

// GET /api/admin/signature-configs - Get all signature configurations
router.get('/signature-configs', adminController.getSignatureConfigs);

// GET /api/admin/signature-configs/:type - Get specific signature configuration
router.get('/signature-configs/:type', adminController.getSignatureConfig);

// POST /api/admin/signature-configs - Create new signature configuration
router.post('/signature-configs', adminController.createSignatureConfig);

// PUT /api/admin/signature-configs/:type - Update signature configuration
router.put('/signature-configs/:type', adminController.updateSignatureConfig);

// DELETE /api/admin/signature-configs/:type - Delete signature configuration
router.delete('/signature-configs/:type', adminController.deleteSignatureConfig);

// ================================
// SIGNERS MANAGEMENT ROUTES
// ================================

// GET /api/admin/signers - Get all signers
router.get('/signers', adminController.getSigners);

// GET /api/admin/signers/:id - Get specific signer
router.get('/signers/:id', adminController.getSigner);

// POST /api/admin/signers - Create new signer
router.post('/signers', adminController.createSigner);

// PUT /api/admin/signers/:id - Update signer
router.put('/signers/:id', adminController.updateSigner);

// DELETE /api/admin/signers/:id - Delete signer
router.delete('/signers/:id', adminController.deleteSigner);

// ================================
// DOCUMENT CONFIGURATION ROUTES
// ================================

// GET /api/admin/documents - Get all document configurations
router.get('/documents', adminController.getDocuments);

// GET /api/admin/documents/:id - Get specific document configuration
router.get('/documents/:id', adminController.getDocument);

// POST /api/admin/documents - Create new document configuration
router.post('/documents', adminController.createDocument);

// PUT /api/admin/documents/:id - Update document configuration
router.put('/documents/:id', adminController.updateDocument);

// DELETE /api/admin/documents/:id - Delete document configuration
router.delete('/documents/:id', adminController.deleteDocument);

// ================================
// DOCUMENT FIELDS ROUTES
// ================================

// GET /api/admin/documents/:documentId/fields - Get fields for specific document
router.get('/documents/:documentId/fields', adminController.getDocumentFields);

// POST /api/admin/documents/:documentId/fields - Add field to document
router.post('/documents/:documentId/fields', adminController.createDocumentField);

// PUT /api/admin/fields/:fieldId - Update document field
router.put('/fields/:fieldId', adminController.updateDocumentField);

// DELETE /api/admin/fields/:fieldId - Delete document field
router.delete('/fields/:fieldId', adminController.deleteDocumentField);

// ================================
// DASHBOARD & STATISTICS ROUTES
// ================================

// GET /api/admin/dashboard - Get admin dashboard overview
router.get('/dashboard', adminController.getDashboardOverview);

module.exports = router;
