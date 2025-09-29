require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const generateDocument = require('./utils/generate-document');
const { setDate } = require('./utils/generate-date');
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
    return { generated_documents: [], config: {} };
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

// API endpoints for dynamic forms
server.get('/api/document-templates', (req, res) => {
  try {
    const db = loadDatabase();
    const templates = {};

    db.document_templates.forEach(template => {
      if (!templates[template.type]) {
        templates[template.type] = [];
      }
      templates[template.type].push({
        name: template.name,
        description: template.description,
        template_path: template.template_path
      });
    });

    res.status(200).json({
      success: true,
      templates: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

server.get('/api/document-fields/:type', (req, res) => {
  try {
    const { type } = req.params;
    const db = loadDatabase();

    const template = db.document_templates.find(t => t.type === type);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found'
      });
    }

    res.status(200).json({
      success: true,
      fields: template.fields,
      template: {
        name: template.name,
        description: template.description
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Save custom template configuration
server.post('/api/save-custom-template', (req, res) => {
  try {
    const { document_type, template_name, custom_fields } = req.body;

    if (!document_type || !template_name || !custom_fields) {
      return res.status(400).json({
        success: false,
        message: 'Document type, template name, and custom fields are required'
      });
    }

    const db = loadDatabase();

    // Initialize custom_templates array if it doesn't exist
    if (!db.custom_templates) {
      db.custom_templates = [];
    }

    // Create new custom template
    const customTemplate = {
      id: `custom_${Date.now()}`,
      document_type: document_type,
      name: template_name,
      fields: custom_fields,
      created_at: new Date().toISOString(),
      created_by: 'system' // Could be user ID in the future
    };

    db.custom_templates.push(customTemplate);

    // Save to database
    if (saveDatabase(db)) {
      res.status(200).json({
        success: true,
        message: 'Custom template saved successfully',
        template_id: customTemplate.id
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to save custom template'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get custom templates
server.get('/api/custom-templates/:document_type?', (req, res) => {
  try {
    const { document_type } = req.params;
    const db = loadDatabase();

    let customTemplates = db.custom_templates || [];

    if (document_type) {
      customTemplates = customTemplates.filter(template => template.document_type === document_type);
    }

    res.status(200).json({
      success: true,
      custom_templates: customTemplates
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

server.post('/api/check-signer', async (req, res) => {
  try {
    const { nama_ttd, nip_nidn } = req.body;

    if (!nama_ttd || !nip_nidn) {
      return res.status(400).json({
        success: false,
        message: 'Nama penandatangan dan NIP/NIDN wajib diisi'
      });
    }

    const result = await signerService.registerSigner(nama_ttd, nip_nidn);

    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Generate document with custom fields support
server.post('/generate-document', async (req, res) => {
  try {
    const data = req.body;

    // Validate document type
    const db = loadDatabase();
    let documentTemplate = db.document_templates.find(template => template.type === data.document_type);

    if (!documentTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Jenis dokumen tidak valid'
      });
    }

    // Handle custom fields if provided
    let fieldsToProcess = documentTemplate.fields;
    if (data.custom_fields && Array.isArray(data.custom_fields) && data.custom_fields.length > 0) {
      // Use custom fields instead of template fields (except for KKP)
      if (data.document_type !== 'kkp') {
        fieldsToProcess = data.custom_fields;
        console.log('Using custom fields for document generation:', fieldsToProcess);
      } else {
        console.log('KKP document detected - using standard template fields');
      }
    }

    // Build processed data dynamically based on fields
    const processedData = {
      nama_prodi: 'Informatika',
      template_path: documentTemplate.template_path
    };

    // Process each field
    fieldsToProcess.forEach(field => {
      if (field.name === 'tableData') {
        // Handle table data
        if (data.tableData && Array.isArray(data.tableData)) {
          processedData.tableData = data.tableData.map((item, index) => ({
            no: index + 1,
            ...item,
          }));
        }
      } else {
        // Handle regular fields - use field variable name for mapping
        const fieldValue = data[field.name] || field.default_value || '';
        processedData[field.name] = fieldValue;

        // Log field mapping for debugging
        console.log(`Field mapping: ${field.label || field.name} -> ${field.name} = "${fieldValue}"`);
      }
    });

    // Process dates - use current date if not provided
    const { tanggalHijriah, tanggalMasehi } = setDate(data.tanggal_hijriyah, data.tanggal_masehi);
    processedData.tanggal_hijriyah = tanggalHijriah;
    processedData.tanggal_masehi = tanggalMasehi;

    // Generate secure document ID using UUID
    const dbData = loadDatabase();
    const docId = uuidv4();
    processedData.doc_id = docId;

    // Generate document
    const result = await generateDocument(data.document_type, 'informatika', processedData);

    // Create digital signature if signer info provided
    let digitalSignature = null;
    if (data.signer_info && data.signer_info.signer_id) {
      try {
        digitalSignature = signerService.signDocument(processedData, data.signer_info.signer_id);
      } catch (error) {
        console.warn('Failed to create digital signature:', error.message);
      }
    }

    // Save to database
    const newDoc = {
      id: docId,
      timestamp: new Date().toISOString(),
      document_type: data.document_type,
      document_name: documentTemplate.name,
      no_surat: result.no_surat,
      filename: path.basename(result.filePath),
      file_path: result.filePath,
      digital_signature: digitalSignature,
      signer_id: data.signer_info?.signer_id || null,
      ...processedData
    };

    dbData.generated_documents.push(newDoc);
    saveDatabase(dbData);

    // Generate QR code URL for verification
    const verificationUrl = `${BASE_URL}/verify?id=${newDoc.id}`;

    res.status(200).json({
      success: true,
      id: newDoc.id,
      no_surat: result.no_surat,
      filename: path.basename(result.filePath),
      verification_url: verificationUrl,
      signature: digitalSignature ? true : false,
      signer_id: data.signer_info?.signer_id || null,
      message: `${documentTemplate.name} berhasil dibuat`
    });

  } catch (error) {
    console.error('Error generating document:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Verify document
server.get('/verify-document/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = loadDatabase();

    const document = db.generated_documents.find(doc => doc.id === id);

    if (!document) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Dokumen tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      document: document,
      message: 'Dokumen valid'
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

// Download document
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

// Health check
server.get('/health', (req, res) => {
  const db = loadDatabase();
  res.status(200).json({
    success: true,
    message: 'KKP Generator is running',
    timestamp: new Date().toISOString(),
    version: db.config?.version || '3.0.0-simple',
    total_documents: db.generated_documents?.length || 0
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
  console.log(`🚀 KKP Generator Server running on http://localhost:${PORT}`);
  console.log(`📄 Form Generator: http://localhost:${PORT}`);
  console.log(`🔍 Verifikasi: http://localhost:${PORT}/verify?id=<document_id>`);
  console.log(`💡 Health Check: http://localhost:${PORT}/health`);
});
