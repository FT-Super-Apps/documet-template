require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const { generateQRCodeWithImage } = require('./utils/generate-qrcode');
const signerService = require('./services/signer-service');

const server = express();
const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `${process.env.PROTOCOL || 'http'}://${process.env.DOMAIN || 'localhost'}:${PORT}`;

// Load database
function loadDatabase() {
  try {
    const rawData = fs.readFileSync('./db.json', 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error loading database:', error);
    return {
      signed_documents: [],
      authorized_signers: [],
      config: {}
    };
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync('./db.json', JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, `${nameWithoutExt}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (path.extname(file.originalname).toLowerCase() === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
server.use('/templates', express.static(path.join(__dirname, 'templates')));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cors());

// Routes
server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// API: Sign document
server.post('/api/sign-document', upload.single('document'), async (req, res) => {
  try {
    const { signer_name, signer_nip, document_title, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File dokumen (.docx) wajib diupload'
      });
    }

    if (!signer_name || !signer_nip) {
      return res.status(400).json({
        success: false,
        message: 'Nama penandatangan dan NIP/NIDN wajib diisi'
      });
    }

    // Generate unique document ID
    const docId = uuidv4();

    // Generate unique keypair and signature for THIS document only
    const signatureInfo = await signerService.generateDocumentSignature(signer_name, docId);

    // Read uploaded document
    const uploadedFilePath = req.file.path;
    const templateContent = fs.readFileSync(uploadedFilePath, 'binary');
    const zip = new PizZip(templateContent);

    // Generate QR Code for verification
    const verificationUrl = `${BASE_URL}/verify?id=${docId}`;
    const qrCodePath = await generateQRCodeWithImage(verificationUrl);

    // Setup image module for QR Code
    const imageModuleOpts = {
      centered: true,
      fileType: 'docx',
      getImage: (tagValue) => {
        if (tagValue === 'qrCode') {
          return fs.readFileSync(qrCodePath);
        }
        throw new Error(`Tag ${tagValue} tidak dikenal`);
      },
      getSize: () => {
        return [100, 100];
      },
    };

    const imageModule = new ImageModule(imageModuleOpts);
    const doc = new Docxtemplater()
      .attachModule(imageModule)
      .loadZip(zip);

    // Render document with QR Code
    doc.setData({
      qrCode: 'qrCode'
    });

    doc.render();

    // Save signed document
    const outputDir = path.resolve(__dirname, 'templates', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const originalName = path.basename(req.file.originalname, '.docx');
    const outputFilename = `signed_${originalName}_${timestamp}.docx`;
    const outputPath = path.join(outputDir, outputFilename);

    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buffer);

    // Clean up uploaded file
    fs.unlinkSync(uploadedFilePath);

    // Save to database
    const db = loadDatabase();
    const signedDoc = {
      id: docId,
      filename: outputFilename,
      file_path: outputPath,
      document_title: document_title || 'Untitled Document',
      original_filename: req.file.originalname,
      signer_name,
      signer_nip,
      digital_signature: {
        signature: signatureInfo.signature,
        public_key: signatureInfo.public_key,
        algorithm: signatureInfo.algorithm,
        fingerprint: signatureInfo.fingerprint,
        signed_at: signatureInfo.signed_at
      },
      notes: notes || '',
      timestamp: new Date().toISOString(),
      verification_url: verificationUrl
    };

    db.signed_documents.push(signedDoc);
    saveDatabase(db);

    res.status(200).json({
      success: true,
      id: docId,
      filename: outputFilename,
      signer_name,
      public_key: signatureInfo.public_key,
      verification_url: verificationUrl,
      message: 'Dokumen berhasil ditandatangani dengan keypair unik EdDSA'
    });

  } catch (error) {
    console.error('Error signing document:', error);

    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat menandatangani dokumen'
    });
  }
});

// API: Verify document (with multiple signatures support)
server.get('/verify-document/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = loadDatabase();

    const document = db.signed_documents.find(doc => doc.id === id);

    if (!document) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Dokumen tidak ditemukan'
      });
    }

    // Check if document has multiple signatures (new format) or single signature (old format)
    const signatures = document.signatures || [];
    const validatedSignatures = [];

    if (signatures.length > 0) {
      // New format: multiple signatures
      signatures.forEach(sig => {
        try {
          const verificationResult = signerService.verifyDocumentWithPublicKey(
            sig.signer_name,
            sig.signature,
            sig.public_key
          );

          validatedSignatures.push({
            signer_name: sig.signer_name,
            signer_nip: sig.signer_nip,
            valid: verificationResult.valid,
            algorithm: sig.algorithm,
            public_key: sig.public_key,
            signed_at: sig.signed_at,
            fingerprint: sig.fingerprint
          });
        } catch (error) {
          console.warn(`Signature verification failed for ${sig.signer_name}:`, error.message);
          validatedSignatures.push({
            signer_name: sig.signer_name,
            signer_nip: sig.signer_nip,
            valid: false,
            algorithm: sig.algorithm,
            public_key: sig.public_key,
            signed_at: sig.signed_at,
            error: error.message
          });
        }
      });
    } else if (document.digital_signature) {
      // Old format: single signature (backward compatibility)
      try {
        const verificationResult = signerService.verifyDocumentWithPublicKey(
          document.signer_name,
          document.digital_signature.signature,
          document.digital_signature.public_key
        );

        validatedSignatures.push({
          signer_name: document.signer_name,
          signer_nip: document.signer_nip,
          valid: verificationResult.valid,
          algorithm: document.digital_signature.algorithm,
          public_key: document.digital_signature.public_key,
          signed_at: document.digital_signature.signed_at,
          fingerprint: document.digital_signature.fingerprint
        });
      } catch (error) {
        console.warn('Signature verification failed:', error.message);
      }
    }

    const allValid = validatedSignatures.every(s => s.valid);

    res.status(200).json({
      success: true,
      valid: allValid,
      document: {
        id: document.id,
        filename: document.filename,
        document_type: document.document_type,
        document_name: document.document_name || document.document_title,
        document_title: document.document_title,
        original_filename: document.original_filename,
        timestamp: document.timestamp,
        notes: document.notes
      },
      signatures: validatedSignatures,
      total_signatures: validatedSignatures.length,
      message: allValid
        ? `Semua ${validatedSignatures.length} tanda tangan digital valid`
        : 'Ada tanda tangan yang tidak valid'
    });

  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Terjadi kesalahan saat verifikasi'
    });
  }
});

// API: Download document
server.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'templates', 'output', filename);

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({
        success: false,
        message: 'File tidak ditemukan'
      });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat download'
    });
  }
});

// API: Get all signed documents
server.get('/api/documents', (req, res) => {
  try {
    const db = loadDatabase();
    res.status(200).json({
      success: true,
      documents: db.signed_documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        document_title: doc.document_title,
        signer_name: doc.signer_name,
        timestamp: doc.timestamp
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: Get document types
server.get('/api/document-types', (req, res) => {
  try {
    const db = loadDatabase();
    res.status(200).json({
      success: true,
      document_types: db.document_types || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: Generate document with multiple signatures
server.post('/api/generate-document', async (req, res) => {
  try {
    const { document_type, signers, notes } = req.body;

    if (!document_type || !signers || signers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Jenis dokumen dan data penandatangan wajib diisi'
      });
    }

    const db = loadDatabase();
    const docTypeConfig = db.document_types.find(dt => dt.id === document_type);

    if (!docTypeConfig) {
      return res.status(404).json({
        success: false,
        message: 'Jenis dokumen tidak ditemukan'
      });
    }

    // Generate unique document ID
    const docId = uuidv4();

    // Generate signatures for each signer
    const signaturesData = [];
    const qrCodes = {};

    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      const signatureInfo = await signerService.generateDocumentSignature(signer.name, `${docId}_${i}`);
      
      // Generate QR Code for this signer
      const verificationUrl = `${BASE_URL}/verify?id=${docId}&signer=${i}`;
      const qrCodePath = await generateQRCodeWithImage(verificationUrl);
      
      signaturesData.push({
        signer_name: signer.name,
        signer_nip: signer.nip,
        signature: signatureInfo.signature,
        public_key: signatureInfo.public_key,
        algorithm: signatureInfo.algorithm,
        fingerprint: signatureInfo.fingerprint,
        signed_at: signatureInfo.signed_at,
        qr_code_path: qrCodePath
      });

      // Map QR code tag
      const qrTag = signers.length === 1 ? 'qrCode' : `qrCode${i + 1}`;
      qrCodes[qrTag] = qrCodePath;
    }

    // Read template
    const templatePath = path.resolve(__dirname, docTypeConfig.template_path);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: `Template tidak ditemukan: ${templatePath}`
      });
    }

    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);

    // Setup image module for multiple QR Codes
    const imageModuleOpts = {
      centered: true,
      fileType: 'docx',
      getImage: (tagValue) => {
        if (qrCodes[tagValue]) {
          return fs.readFileSync(qrCodes[tagValue]);
        }
        throw new Error(`QR Code tag ${tagValue} tidak ditemukan`);
      },
      getSize: () => {
        return [100, 100];
      },
    };

    const imageModule = new ImageModule(imageModuleOpts);
    const doc = new Docxtemplater()
      .attachModule(imageModule)
      .loadZip(zip);

    // Prepare data for rendering
    const renderData = {};
    Object.keys(qrCodes).forEach(tag => {
      renderData[tag] = tag;
    });

    doc.setData(renderData);
    doc.render();

    // Save signed document
    const outputDir = path.resolve(__dirname, 'templates', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputFilename = `${document_type}_${timestamp}.docx`;
    const outputPath = path.join(outputDir, outputFilename);

    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buffer);

    // Save to database
    const signedDoc = {
      id: docId,
      filename: outputFilename,
      file_path: outputPath,
      document_type,
      document_name: docTypeConfig.name,
      signatures: signaturesData,
      notes: notes || '',
      timestamp: new Date().toISOString(),
      verification_url: `${BASE_URL}/verify?id=${docId}`
    };

    db.signed_documents.push(signedDoc);
    saveDatabase(db);

    res.status(200).json({
      success: true,
      id: docId,
      filename: outputFilename,
      document_type: docTypeConfig.name,
      signers: signers,
      total_signatures: signers.length,
      message: `Dokumen ${docTypeConfig.name} berhasil ditandatangani dengan ${signers.length} tanda tangan digital`
    });

  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat membuat dokumen'
    });
  }
});

// Health check
server.get('/health', (req, res) => {
  const db = loadDatabase();
  res.status(200).json({
    success: true,
    message: 'Digital Document Signature is running',
    timestamp: new Date().toISOString(),
    version: db.config?.version || '2.0.0',
    total_documents: db.signed_documents?.length || 0
  });
});

// 404 handler
server.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Digital Document Signature Server running on http://localhost:${PORT}`);
  console.log(`📝 Sign Document: http://localhost:${PORT}`);
  console.log(`🔍 Verify Document: http://localhost:${PORT}/verify?id=<document_id>`);
  console.log(`💡 Health Check: http://localhost:${PORT}/health`);
});
