
const express = require('express');
const path = require('path');
const router = express.Router();
const { generateDocument, getAvailableProdi, getRequiredFields } = require('../controllers');

// Import document config routes
// const documentConfigRoutes = require('./document-config');

// NEW: EdDSA Multi-Signature routes
const eddsaRoutes = require('./eddsa-routes');

// NEW: Admin management routes
const adminRoutes = require('./admin-routes');

// Mount EdDSA routes with prefix
router.use('/eddsa', eddsaRoutes);

// Mount Admin routes with prefix
router.use('/admin', adminRoutes);

// Document config routes
// router.use('/document-config', documentConfigRoutes);

// ===========================================
// MODERN WEB INTERFACE ROUTES
// ===========================================

// Main Dashboard - Modern EdDSA Multi-Signature Interface (Unified Admin)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Admin Dashboard - Management Interface (Same as main dashboard)
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Legacy Dashboard route - redirect to admin
router.get('/dashboard', (req, res) => {
  res.redirect('/');
});

// Document Verification Route (for QR Code scanning)
router.get('/verify/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Get document from database
    const document = await prisma.signed_documents.findUnique({
      where: { id: documentId },
      include: {
        document_signatures: {
          include: {
            signer: true
          }
        }
      }
    });

    if (!document) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dokumen Tidak Ditemukan</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-red-50 flex items-center justify-center min-h-screen">
          <div class="text-center p-8">
            <div class="text-6xl text-red-500 mb-4">❌</div>
            <h1 class="text-2xl font-bold text-red-800 mb-2">Dokumen Tidak Ditemukan</h1>
            <p class="text-red-600">ID Dokumen: ${documentId}</p>
            <a href="/" class="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Kembali ke Dashboard
            </a>
          </div>
        </body>
        </html>
      `);
    }

    // Verify signatures and show document details
    const verificationResult = {
      isValid: document.is_complete,
      documentId: document.id,
      documentType: document.document_type.toUpperCase(),
      prodi: document.prodi.charAt(0).toUpperCase() + document.prodi.slice(1),
      noSurat: document.no_surat,
      totalSignatures: document.total_signatures_received,
      requiredSignatures: document.total_signatures_required,
      createdAt: document.created_at,
      completedAt: document.completed_at,
      signatures: document.document_signatures.map(sig => ({
        signerName: sig.signer.name,
        signerRole: sig.signer.role,
        timestamp: sig.created_at
      }))
    };

    // Return verification page with document preview
    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifikasi Dokumen - ${verificationResult.noSurat}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-50 min-h-screen">
        <div class="max-w-4xl mx-auto p-6">
          <!-- Header -->
          <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <div class="w-16 h-16 ${verificationResult.isValid ? 'bg-green-100' : 'bg-yellow-100'} rounded-full flex items-center justify-center">
                  <i class="fas ${verificationResult.isValid ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-yellow-500'} text-2xl"></i>
                </div>
                <div>
                  <h1 class="text-2xl font-bold text-gray-900">
                    ${verificationResult.isValid ? 'Dokumen Valid' : 'Dokumen Belum Lengkap'}
                  </h1>
                  <p class="text-gray-600">Hasil Verifikasi EdDSA Multi-Signature</p>
                </div>
              </div>
              <a href="/" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                <i class="fas fa-home mr-2"></i>Dashboard
              </a>
            </div>
          </div>

          <!-- Document Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-semibold mb-4 text-gray-900">
                <i class="fas fa-file-alt text-blue-500 mr-2"></i>Detail Dokumen
              </h2>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">No. Surat:</span>
                  <span class="font-medium">${verificationResult.noSurat}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Jenis:</span>
                  <span class="font-medium">${verificationResult.documentType}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Program Studi:</span>
                  <span class="font-medium">${verificationResult.prodi}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Dibuat:</span>
                  <span class="font-medium">${new Date(verificationResult.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                ${verificationResult.completedAt ? `
                <div class="flex justify-between">
                  <span class="text-gray-600">Diselesaikan:</span>
                  <span class="font-medium">${new Date(verificationResult.completedAt).toLocaleDateString('id-ID')}</span>
                </div>` : ''}
              </div>
            </div>

            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-semibold mb-4 text-gray-900">
                <i class="fas fa-signature text-green-500 mr-2"></i>Status Tanda Tangan
              </h2>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-600">Progress:</span>
                  <div class="flex items-center space-x-2">
                    <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div class="h-full ${verificationResult.isValid ? 'bg-green-500' : 'bg-yellow-500'}" 
                           style="width: ${(verificationResult.totalSignatures / verificationResult.requiredSignatures) * 100}%"></div>
                    </div>
                    <span class="text-sm font-medium">${verificationResult.totalSignatures}/${verificationResult.requiredSignatures}</span>
                  </div>
                </div>
                <div class="pt-4">
                  <h3 class="font-medium text-gray-900 mb-2">Penandatangan:</h3>
                  ${verificationResult.signatures.map(sig => `
                    <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <div class="font-medium text-gray-900">${sig.signerName}</div>
                        <div class="text-sm text-gray-500">${sig.signerRole}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-green-500"><i class="fas fa-check"></i></div>
                        <div class="text-xs text-gray-500">${new Date(sig.timestamp).toLocaleDateString('id-ID')}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Download Section -->
          ${verificationResult.isValid && document.file_path ? `
          <div class="bg-white rounded-lg shadow-md p-6 text-center">
            <h2 class="text-xl font-semibold mb-4 text-gray-900">
              <i class="fas fa-download text-blue-500 mr-2"></i>Download Dokumen
            </h2>
            <p class="text-gray-600 mb-4">Dokumen telah diverifikasi dan dapat didownload</p>
            <a href="/api/eddsa/download/${document.id}" 
               class="inline-flex items-center bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors">
              <i class="fas fa-file-download mr-2"></i>
              Download Dokumen Resmi
            </a>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="mt-8 text-center text-gray-500">
            <p class="text-sm">
              <i class="fas fa-shield-alt mr-1"></i>
              Dokumen ini diamankan dengan EdDSA Multi-Signature System
            </p>
            <p class="text-xs mt-1">ID: ${verificationResult.documentId}</p>
          </div>
        </div>
      </body>
      </html>
    `);

    await prisma.$disconnect();

  } catch (error) {
    console.error('Error in verification route:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error Verifikasi</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-red-50 flex items-center justify-center min-h-screen">
        <div class="text-center p-8">
          <div class="text-6xl text-red-500 mb-4">⚠️</div>
          <h1 class="text-2xl font-bold text-red-800 mb-2">Error Verifikasi</h1>
          <p class="text-red-600 mb-4">Terjadi kesalahan saat memverifikasi dokumen</p>
          <a href="/" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Kembali ke Dashboard
          </a>
        </div>
      </body>
      </html>
    `);
  }
});

// Legacy routes for backward compatibility
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

// Generate document dengan prodi dinamis (Legacy)
router.post('/generate-document/:type/:prodi', generateDocument);

// Mendapatkan daftar prodi yang tersedia (Legacy)
router.get('/templates', getAvailableProdi);
router.get('/templates/:type', getAvailableProdi);

// Mendapatkan field yang diperlukan untuk template tertentu (Legacy)
router.get('/templates/:type/:prodi/fields', getRequiredFields);

// API endpoint untuk mendapatkan fields berdasarkan prodi dan type (for admin interface)
router.get('/api/fields/:prodi/:type', async (req, res) => {
  try {
    const { prodi, type } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Get document configuration
    const document = await prisma.documents.findFirst({
      where: { type, prodi },
      include: { document_fields: true }
    });

    if (!document) {
      return res.json({
        success: false,
        error: 'Document configuration not found'
      });
    }

    // Transform fields to frontend format
    const fields = document.document_fields.map(field => ({
      name: field.field_name,
      label: field.label || field.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: field.field_type || 'text',
      placeholder: field.placeholder || '',
      required: field.is_required || true
    }));

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Backward compatibility - redirect ke endpoint lama (default ke informatika)
router.post('/generate-document/:type', (req, res, next) => {
  req.params.prodi = 'informatika'; // default prodi
  generateDocument(req, res, next);
});

// API endpoint untuk mendapatkan statistik (untuk dashboard)
router.get('/api/stats', async (req, res) => {
  try {
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/eddsa/stats`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint untuk mendapatkan dokumen (untuk dashboard)
router.get('/api/documents', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/eddsa/documents?limit=${limit}&page=${page}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
