// controllers/eddsa-document-controller.js
const EdDSADocumentService = require('../services/eddsa-document-service');
const { parseQRData } = require('../utils/generate-qrcode-enhanced');
const { validateFields } = require('../auth');

class EdDSADocumentController {
  constructor() {
    this.documentService = new EdDSADocumentService();
  }

  /**
   * Generate dokumen dengan EdDSA multi-signature
   * POST /api/eddsa/generate-document/:type/:prodi
   */
  generateSignedDocument = async (req, res) => {
    try {
      const { type, prodi } = req.params;
      const data = req.body;

      // Validasi parameter wajib
      if (!type || !prodi) {
        return res.status(400).json({
          success: false,
          message: 'Parameter "type" dan "prodi" wajib disediakan'
        });
      }

      // Validasi basic fields
      const requiredFields = ['kepada', 'tempat_tujuan'];
      const validation = validateFields(data, requiredFields);

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Field yang diperlukan tidak lengkap',
          missingFields: validation.missingFields
        });
      }

      // Ekstrak signer details jika ada
      const signerDetails = data.signerDetails || null;
      delete data.signerDetails; // Remove dari data dokumen

      const result = await this.documentService.generateSignedDocument({
        type,
        prodi,
        data,
        signerDetails
      });

      res.json({
        success: true,
        data: result.data,
        message: result.data.message
      });

    } catch (error) {
      console.error('Error generating signed document:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'DOCUMENT_GENERATION_FAILED'
      });
    }
  };

  /**
   * Verifikasi dokumen dari QR Code
   * POST /api/eddsa/verify-qr
   */
  verifyDocumentFromQR = async (req, res) => {
    try {
      const { qrData } = req.body;
      const clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      if (!qrData) {
        return res.status(400).json({
          success: false,
          message: 'Data QR Code tidak disertakan'
        });
      }

      // Parse QR data first
      const parsedQR = parseQRData(qrData);
      if (!parsedQR.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Format QR Code tidak valid',
          error: parsedQR.error
        });
      }

      // Verify document
      const result = await this.documentService.verifyDocumentFromQR(qrData, clientInfo);

      res.json({
        success: true,
        data: {
          verification: result,
          qrType: parsedQR.type,
          parsedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error verifying document:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'VERIFICATION_FAILED'
      });
    }
  };

  /**
   * Verifikasi dokumen langsung via URL (dari QR compact)
   * GET /api/eddsa/verify/:documentId
   */
  verifyDocumentById = async (req, res) => {
    try {
      const { documentId } = req.params;
      const clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        documentId
      };

      // Create fake QR data for verification
      const qrData = JSON.stringify({
        documentId: documentId,
        version: '1.0',
        type: 'url_verification'
      });

      const result = await this.documentService.verifyDocumentFromQR(qrData, clientInfo);

      // Return HTML untuk display yang user-friendly
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        const html = this.generateVerificationHTML(result, documentId);
        res.send(html);
      } else {
        res.json({
          success: true,
          data: result
        });
      }

    } catch (error) {
      console.error('Error verifying document by ID:', error);

      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        const errorHtml = this.generateErrorHTML(error.message, req.params.documentId);
        res.status(500).send(errorHtml);
      } else {
        res.status(500).json({
          success: false,
          message: error.message,
          error: 'VERIFICATION_FAILED'
        });
      }
    }
  };

  /**
   * Inisialisasi signers untuk prodi
   * POST /api/eddsa/init-signers/:prodi
   */
  initializeSigners = async (req, res) => {
    try {
      const { prodi } = req.params;

      if (!prodi) {
        return res.status(400).json({
          success: false,
          message: 'Parameter "prodi" wajib disediakan'
        });
      }

      const result = await this.documentService.initializeSignersForProdi(prodi);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error initializing signers:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'SIGNER_INITIALIZATION_FAILED'
      });
    }
  };

  /**
   * Get daftar dokumen yang sudah ditandatangani
   * GET /api/eddsa/documents
   */
  getSignedDocuments = async (req, res) => {
    try {
      const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        type: req.query.type,
        prodi: req.query.prodi,
        isComplete: req.query.isComplete ? req.query.isComplete === 'true' : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const result = await this.documentService.getSignedDocuments(filters);

      res.json({
        success: true,
        data: result.documents,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('Error getting signed documents:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'GET_DOCUMENTS_FAILED'
      });
    }
  };

  /**
   * Get statistik verifikasi
   * GET /api/eddsa/stats
   */
  getVerificationStats = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        prodi: req.query.prodi
      };

      const stats = await this.documentService.getVerificationStats(filters);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error getting verification stats:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'GET_STATS_FAILED'
      });
    }
  };

  /**
   * Download dokumen yang sudah ditandatangani
   * GET /api/eddsa/download/:documentId
   */
  downloadSignedDocument = async (req, res) => {
    try {
      const { documentId } = req.params;
      const prisma = require('../prisma');

      const document = await prisma.signed_documents.findFirst({
        where: { id: documentId }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Dokumen tidak ditemukan'
        });
      }

      if (!document.file_path || !require('fs').existsSync(document.file_path)) {
        return res.status(404).json({
          success: false,
          message: 'File dokumen tidak ditemukan'
        });
      }

      // Set headers for download
      const filename = `${document.document_type}_${document.prodi}_${document.no_surat}.docx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      // Stream file
      const fs = require('fs');
      const fileStream = fs.createReadStream(document.file_path);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: 'DOWNLOAD_FAILED'
      });
    }
  };

  // Helper methods for HTML generation
  generateVerificationHTML(result, documentId) {
    const statusColor = result.isValid ? '#28a745' : '#dc3545';
    const statusText = result.isValid ? 'VALID' : 'INVALID';
    const statusIcon = result.isValid ? '✓' : '✗';

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifikasi Dokumen Digital - EdDSA Multi-Signature</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .status { text-align: center; padding: 30px; }
            .status-badge { display: inline-block; padding: 10px 30px; border-radius: 50px; font-size: 18px; font-weight: bold; color: white; background: ${statusColor}; }
            .content { padding: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
            .info-item { background: #f8f9fa; padding: 15px; border-radius: 5px; }
            .info-label { font-weight: bold; color: #495057; margin-bottom: 5px; }
            .signers { margin-top: 20px; }
            .signer-item { background: #e9ecef; padding: 10px; margin: 5px 0; border-radius: 5px; border-left: 4px solid ${statusColor}; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Verifikasi Dokumen Digital</h1>
                <p>Sistem Tanda Tangan Digital EdDSA Multi-Signature</p>
            </div>
            
            <div class="status">
                <div class="status-badge">${statusIcon} ${statusText}</div>
                <p style="margin-top: 10px; color: #6c757d;">${result.message}</p>
            </div>
            
            <div class="content">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">ID Dokumen</div>
                        <div>${result.document.id}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Jenis Dokumen</div>
                        <div>${result.document.type.toUpperCase()}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Program Studi</div>
                        <div>${result.document.prodi}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Nomor Surat</div>
                        <div>${result.document.noSurat || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Tanggal Dibuat</div>
                        <div>${new Date(result.document.createdAt).toLocaleDateString('id-ID')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Status Signature</div>
                        <div>${result.verification.validSignatures}/${result.verification.totalSignatures} Valid</div>
                    </div>
                </div>
                
                <div class="signers">
                    <h3>Detail Penandatangan</h3>
                    ${result.signers.map(signer => `
                        <div class="signer-item">
                            <strong>${signer.role.replace('_', ' ').toUpperCase()}</strong><br>
                            <span>${signer.signerName}</span>
                            <span style="float: right; color: ${signer.isValid ? '#28a745' : '#dc3545'};">
                                ${signer.isValid ? '✓ Valid' : '✗ Invalid'}
                            </span>
                        </div>
                    `).join('')}
                </div>
                
                ${result.isValid ? `
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <strong>Dokumen Terverifikasi</strong><br>
                        Dokumen ini telah diverifikasi menggunakan sistem EdDSA Multi-Signature dan dinyatakan authentic.
                    </div>
                ` : `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <strong>Dokumen Tidak Valid</strong><br>
                        ${result.verification.error || 'Tanda tangan digital tidak dapat diverifikasi atau dokumen telah dimodifikasi.'}
                    </div>
                `}
            </div>
            
            <div class="footer">
                Diverifikasi pada ${new Date().toLocaleString('id-ID')} | 
                Powered by EdDSA Multi-Signature System
            </div>
        </div>
    </body>
    </html>`;
  }

  generateErrorHTML(errorMessage, documentId) {
    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error Verifikasi - EdDSA Multi-Signature</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: #dc3545; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; text-align: center; }
            .error-icon { font-size: 48px; color: #dc3545; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Error Verifikasi</h1>
            </div>
            <div class="content">
                <div class="error-icon">⚠</div>
                <h2>Verifikasi Gagal</h2>
                <p>${errorMessage}</p>
                <p><strong>Document ID:</strong> ${documentId}</p>
                <p style="color: #6c757d; margin-top: 30px;">
                    Silakan periksa kembali QR Code atau hubungi administrator sistem.
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }
}

module.exports = EdDSADocumentController;
