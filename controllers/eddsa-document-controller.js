// controllers/eddsa-document-controller.js
const { PrismaClient } = require('@prisma/client');
const { EdDSACrypto, MultiSignatureManager } = require('../utils/eddsa-crypto');
const { getSignatureRequirements, getSignatureRequirementsFromDB, isValidDocumentTypeAsync } = require('../config/document-signature-config');
const generateDocumentUtil = require('../utils/generate-document');
const { generateQRCodeWithSignature } = require('../utils/generate-qrcode-enhanced');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const prisma = new PrismaClient();

function getVerifyAppBaseUrl() {
  const raw = process.env.VERIFY_APP_BASE_URL || 'http://localhost:3000';
  try {
    // Validate URL; if invalid, fallback
    const u = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
    // Remove trailing slash for clean concatenation
    const sanitized = `${u.origin}${u.pathname}`.replace(/\/+$/, '');
    return sanitized;
  } catch (e) {
    console.warn(`Invalid VERIFY_APP_BASE_URL '${raw}', falling back to http://localhost:3000`);
    return 'http://localhost:3000';
  }
}

class EdDSADocumentController {
  constructor() {
    this.crypto = new EdDSACrypto();
  }

  /**
   * Generate document with EdDSA multi-signature
   */
  generateSignedDocument = async (req, res) => {
    try {
      const { type, prodi } = req.params;
      const documentData = req.body;

      console.log(`🔐 Generating signed document: ${type} for ${prodi}`);

      // 1. Validate document type (DB-first, fallback to static)
      if (!(await isValidDocumentTypeAsync(type))) {
        return res.status(400).json({
          success: false,
          error: `Invalid document type: ${type}. Please configure signature requirements first.`
        });
      }

      // 2. Get signature requirements for this document type
      const signatureConfig = await getSignatureRequirementsFromDB(type);
      const multiSigManager = new MultiSignatureManager();
      await multiSigManager.initialize(type);

      console.log(`📝 Document type: ${type} requires ${signatureConfig.requiredSignatureCount} signatures from: ${signatureConfig.requiredRoles.join(', ')}`);

      // 3. Validate required parameters
      if (!type || !prodi) {
        return res.status(400).json({
          success: false,
          error: 'Document type and prodi are required'
        });
      }

      // 4. Get signers for this prodi with required roles
      const signers = await prisma.signers.findMany({
        where: {
          prodi: prodi,
          is_active: true,
          role: {
            in: signatureConfig.requiredRoles
          }
        },
        orderBy: { role: 'asc' }
      });

      if (signers.length < signatureConfig.requiredSignatureCount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient signers for ${prodi}. Document type '${type}' requires ${signatureConfig.requiredSignatureCount} signers with roles: ${signatureConfig.requiredRoles.join(', ')}. Found ${signers.length} signers.`
        });
      }

      // 5. Validate that all required roles are available
      const availableRoles = signers.map(s => s.role);
      const missingRoles = signatureConfig.requiredRoles.filter(role => !availableRoles.includes(role));

      if (missingRoles.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required signer roles for document type '${type}': ${missingRoles.join(', ')}`
        });
      }

      // 6. Generate document
      const documentContent = JSON.stringify(documentData);
      const documentHash = this.crypto.hashDocument(documentContent);

      // 7. Generate document number
      const noSurat = await this.generateDocumentNumber(type, prodi);

      // 8. Create multi-signature using dynamic requirements
      const signerDetails = {};
      const signersFormatted = {};

      signers.forEach(signer => {
        signerDetails[signer.role] = {
          nama: signer.name,
          nip: signer.nip
        };

        signersFormatted[signer.role] = {
          publicKey: signer.public_key,
          privateKey: signer.private_key,
          keyId: signer.key_id,
          required: true,
          hasSigned: false // Will be set to true during signing process
        };
      });

      const multiSig = multiSigManager.createMultiSignature(
        documentContent,
        signersFormatted,
        signerDetails
      );
      // 9. Create QR code data with verification URL
      const documentId = uuidv4();
      // Build QR link to external verification UI (not API)
      const verifyAppBase = getVerifyAppBaseUrl();
      const verificationUrl = `${verifyAppBase}/document/verifikasi/${documentId}`;

      const qrData = {
        documentId: documentId,
        verificationUrl: verificationUrl,
        hash: documentHash,
        type: type,
        prodi: prodi,
        noSurat: noSurat,
        signatures: multiSig.signatures.length,
        requiredSignatures: signatureConfig.requiredSignatureCount,
        signatureConfig: signatureConfig.description,
        timestamp: new Date().toISOString(),
        message: "Scan untuk verifikasi dokumen"
      };

      // 10. Save to database with dynamic requirements
      const signedDoc = await prisma.signed_documents.create({
        data: {
          id: documentId, // Use the documentId from qrData
          document_type: type,
          prodi: prodi,
          document_content: documentContent,
          document_hash: documentHash,
          no_surat: noSurat,
          qr_code_data: JSON.stringify(qrData),
          total_signatures_required: signatureConfig.requiredSignatureCount,
          total_signatures_received: multiSig.signatures.length,
          is_complete: multiSig.isComplete,
          completed_at: multiSig.isComplete ? new Date() : null
        }
      });

      // 11. Save individual signatures
      for (const [index, signature] of multiSig.signatures.entries()) {
        const signer = signers.find(s => s.role === signature.role);
        if (signer) {
          await prisma.document_signatures.create({
            data: {
              signed_doc_id: signedDoc.id,
              signer_id: signer.id,
              signature_data: signature.signature,
              signature_hash: this.crypto.hashDocument(signature.signature),
              signer_info: JSON.stringify({
                role: signer.role,
                name: signer.name,
                nip: signer.nip
              }),
              algorithm: 'EdDSA',
              timestamp: new Date(signature.timestamp) // Use the timestamp from signature
            }
          });
        }
      }

      // 12. Generate physical document
      const outputPath = await this.generatePhysicalDocument(type, prodi, documentData, qrData);

      // 13. Update document with file path
      await prisma.signed_documents.update({
        where: { id: signedDoc.id },
        data: { file_path: outputPath }
      });

      console.log(`✅ Document generated successfully: ${signedDoc.id} with ${multiSig.signatures.length}/${signatureConfig.requiredSignatureCount} signatures`);

      res.json({
        success: true,
        message: `Document generated and signed successfully with ${multiSig.signatures.length}/${signatureConfig.requiredSignatureCount} signatures`,
        data: {
          documentId: signedDoc.id,
          documentType: type,
          prodi: prodi,
          noSurat: noSurat,
          signatures: multiSig.signatures.length,
          isComplete: multiSig.isComplete,
          filePath: outputPath,
          qrData: qrData,
          verificationUrl: qrData.verificationUrl
        }
      });

    } catch (error) {
      console.error('❌ Error generating signed document:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Verify document from QR code scan
   */
  verifyDocumentFromQR = async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({
          success: false,
          error: 'QR data is required'
        });
      }

      const parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
      const verificationResult = await this.verifyDocument(parsedData.documentId, req);

      res.json(verificationResult);

    } catch (error) {
      console.error('❌ Error verifying QR document:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Verify document by ID
   */
  verifyDocumentById = async (req, res) => {
    try {
      const { documentId } = req.params;
      const verificationResult = await this.verifyDocument(documentId, req);

      res.json(verificationResult);

    } catch (error) {
      console.error('❌ Error verifying document by ID:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Initialize signers for a prodi
   */
  initializeSigners = async (req, res) => {
    try {
      const { prodi } = req.params;

      // Check if signers already exist
      const existingSigners = await prisma.signers.count({
        where: { prodi: prodi, is_active: true }
      });

      if (existingSigners >= 3) {
        return res.status(400).json({
          success: false,
          error: `Signers for ${prodi} already exist (${existingSigners} found)`
        });
      }

      // Generate new signers
      const signers = this.multiSigManager.initializeSigners();
      const createdSigners = [];

      for (const [role, signerData] of Object.entries(signers)) {
        const signerName = this.getSignerName(role, prodi);
        const signerNip = this.generateNIP(role);

        const newSigner = await prisma.signers.create({
          data: {
            name: signerName,
            nip: signerNip,
            role: role,
            department: 'Fakultas Teknik',
            prodi: prodi,
            public_key: signerData.publicKey,
            private_key: signerData.privateKey,
            key_id: signerData.keyId,
            is_active: true
          }
        });

        createdSigners.push({
          id: newSigner.id,
          name: newSigner.name,
          nip: newSigner.nip,
          role: newSigner.role
        });
      }

      res.json({
        success: true,
        message: `Signers initialized for ${prodi}`,
        data: {
          prodi: prodi,
          signersCreated: createdSigners.length,
          signers: createdSigners
        }
      });

    } catch (error) {
      console.error('❌ Error initializing signers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get all signed documents
   */
  getSignedDocuments = async (req, res) => {
    try {
      const { page = 1, limit = 10, prodi, type } = req.query;

      const where = {};
      if (prodi) where.prodi = prodi;
      if (type) where.document_type = type;

      const documents = await prisma.signed_documents.findMany({
        where,
        include: {
          document_signatures: {
            include: {
              signer: {
                select: {
                  name: true,
                  role: true,
                  nip: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      });

      const total = await prisma.signed_documents.count({ where });

      // Transform documents for frontend compatibility
      const transformedDocuments = documents.map(doc => {
        // Parse document content to extract student info if available
        let parsedContent = {};
        try {
          if (doc.document_content) {
            parsedContent = JSON.parse(doc.document_content);
          }
        } catch (e) {
          console.warn('Failed to parse document content:', e);
        }

        // Extract student data from parsed content or tableData
        let nama_mahasiswa = 'N/A';
        let nim = 'N/A';
        let judul = 'N/A';

        if (parsedContent.nama_mahasiswa) {
          nama_mahasiswa = parsedContent.nama_mahasiswa;
        } else if (parsedContent.tableData && parsedContent.tableData.length > 0) {
          nama_mahasiswa = parsedContent.tableData[0].nama || 'N/A';
        }

        if (parsedContent.nim) {
          nim = parsedContent.nim;
        } else if (parsedContent.tableData && parsedContent.tableData.length > 0) {
          nim = parsedContent.tableData[0].nim || 'N/A';
        }

        if (parsedContent.judul) {
          judul = parsedContent.judul;
        }

        return {
          ...doc,
          type: doc.document_type, // Map document_type to type for frontend
          // Keep the original document_type for backward compatibility
          document_type: doc.document_type,
          // Map signed_at from completed_at if available
          signed_at: doc.completed_at,
          // Add status based on completion
          status: doc.is_complete ? 'signed' : 'pending',
          // Transform signatures
          signatures: doc.document_signatures.map(sig => ({
            id: sig.id.toString(),
            signer_id: sig.signer_id.toString(),
            signer_name: sig.signer.name,
            role: sig.signer.role,
            signed_at: sig.timestamp,
            signature_data: sig.signature_data
          })),
          // Add missing frontend expected fields
          documentId: doc.id,
          nama_mahasiswa,
          nim,
          judul,
          updated_at: doc.created_at, // Use created_at as fallback for updated_at
          qr_code: doc.qr_code_data,
          download_url: `/api/documents/${doc.id}/download`
        };
      });

      res.json({
        success: true,
        data: {
          data: transformedDocuments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting signed documents:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  getSignedDocument = async (req, res) => {
    try {
      const { documentId } = req.params;

      console.log(`📄 Getting document details for ID: ${documentId}`);

      const document = await prisma.signed_documents.findUnique({
        where: { id: documentId },
        include: {
          document_signatures: {
            include: {
              signer: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  nip: true
                }
              }
            }
          }
        }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Parse document content
      let parsedContent = {};
      try {
        if (document.document_content) {
          parsedContent = JSON.parse(document.document_content);
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse document content:', error.message);
      }

      // Extract student data from parsed content
      let nama_mahasiswa = 'N/A';
      let nim = 'N/A';
      let judul = 'N/A';

      if (parsedContent.nama_mahasiswa) {
        nama_mahasiswa = parsedContent.nama_mahasiswa;
      } else if (parsedContent.tableData && parsedContent.tableData.length > 0) {
        nama_mahasiswa = parsedContent.tableData[0].nama || 'N/A';
      }

      if (parsedContent.nim) {
        nim = parsedContent.nim;
      } else if (parsedContent.tableData && parsedContent.tableData.length > 0) {
        nim = parsedContent.tableData[0].nim || 'N/A';
      }

      if (parsedContent.judul) {
        judul = parsedContent.judul;
      }

      // Transform document for frontend
      const transformedDocument = {
        ...document,
        type: document.document_type,
        document_type: document.document_type,
        signed_at: document.completed_at,
        status: document.completed_at ? 'signed' : 'pending',
        documentId: document.id,
        nama_mahasiswa,
        nim,
        judul,
        updated_at: document.created_at,
        qr_code: document.qr_code_data,
        download_url: `/api/documents/${document.id}/download`,
        // Include signature details
        signatures: document.document_signatures.map(sig => ({
          id: sig.id,
          signer: sig.signer,
          signature_data: sig.signature_data,
          signed_at: sig.signed_at,
          signature_metadata: sig.signature_metadata ? JSON.parse(sig.signature_metadata) : null
        }))
      };

      res.json({
        success: true,
        data: transformedDocument
      });

    } catch (error) {
      console.error('❌ Error getting document details:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Analyze uploaded document to extract document ID
   */
  analyzeDocument = async (req, res) => {
    try {
      console.log('📋 Analyzing uploaded document...');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No document file uploaded'
        });
      }

      const file = req.file;
      console.log(`📄 Processing file: ${file.originalname} (${file.mimetype})`);

      // For now, this is a placeholder implementation
      // In a real implementation, this would:
      // 1. Extract metadata from the document using libraries like:
      //    - mammoth (for .docx files)
      //    - pdf-parse (for .pdf files)
      // 2. Search for document ID patterns in the content
      // 3. Look for embedded metadata or watermarks
      // 4. Return the found document ID

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For demonstration, we'll return a simulated response
      // In reality, you would implement actual document analysis
      console.log('📋 Document analysis not yet implemented');

      res.json({
        success: false,
        error: 'Fitur analisis dokumen belum tersedia. Silakan gunakan Document ID manual atau QR Code untuk verifikasi.',
        data: {
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          message: 'Document uploaded successfully but analysis feature is not yet implemented'
        }
      });

      // Clean up uploaded file
      if (file.path) {
        const fs = require('fs');
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup uploaded file:', cleanupError.message);
        }
      }

    } catch (error) {
      console.error('❌ Error analyzing document:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Download signed document
   */
  downloadSignedDocument = async (req, res) => {
    try {
      const { documentId } = req.params;

      const document = await prisma.signed_documents.findUnique({
        where: { id: documentId }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (!document.file_path || !fs.existsSync(document.file_path)) {
        return res.status(404).json({
          success: false,
          error: 'Document file not found'
        });
      }

      const fileName = `${document.prodi}_${document.document_type}_${document.id}.docx`;

      // Set proper headers for DOCX download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache');

      res.download(document.file_path, fileName);

    } catch (error) {
      console.error('❌ Error downloading document:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get verification statistics
   */
  getVerificationStats = async (req, res) => {
    try {
      const stats = await prisma.$transaction(async (tx) => {
        const totalDocuments = await tx.signed_documents.count();
        const completedDocuments = await tx.signed_documents.count({
          where: { is_complete: true }
        });
        const totalVerifications = await tx.verification_logs.count();
        const todayVerifications = await tx.verification_logs.count({
          where: {
            verified_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        });

        const prodiStats = await tx.signed_documents.groupBy({
          by: ['prodi'],
          _count: true
        });

        return {
          totalDocuments,
          completedDocuments,
          totalVerifications,
          todayVerifications,
          prodiStats
        };
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  // Helper methods
  async verifyDocument(documentId, req) {
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
      throw new Error('Document not found');
    }

    // Check if this is a basic document (no signature verification needed)
    const isBasicDocument = document.total_signatures_required === 0;

    if (isBasicDocument) {
      console.log(`🔍 Verifying basic document ${documentId} of type ${document.document_type}`);

      // For basic documents, just verify document integrity
      let documentHash = '';
      try {
        // Parse QR data to get hash if available
        const qrData = JSON.parse(document.qr_code_data);
        documentHash = qrData.document?.hash || '';
      } catch (error) {
        console.warn('Could not parse QR data for hash verification');
      }

      // Log verification attempt
      await prisma.verification_logs.create({
        data: {
          signed_doc_id: documentId,
          verifier_ip: req.ip || 'unknown',
          verifier_agent: req.get('User-Agent') || 'unknown',
          verification_method: 'api_call',
          verification_result: true,
          verification_details: JSON.stringify({
            documentType: 'Basic Document',
            verificationMethod: 'Document Integrity Check',
            hash: documentHash
          })
        }
      });

      return {
        success: true,
        data: {
          documentId: document.id,
          documentType: document.document_type,
          prodi: document.prodi,
          noSurat: document.no_surat,
          isComplete: true, // Basic documents are always complete
          totalSignatures: 0,
          requiredSignatures: 0,
          signatureConfig: 'Basic Document - No signatures required',
          requiredRoles: [],
          createdAt: document.created_at,
          completedAt: document.created_at, // Use created_at as completed_at for basic docs
          verificationResults: [],
          requiredRolesSigned: [],
          missingRoles: [],
          isValid: true, // Basic documents are always valid if they exist
          documentHash: documentHash
        }
      };
    }

    // For EdDSA documents, proceed with signature verification
    const signatureConfig = await getSignatureRequirementsFromDB(document.document_type);
    const multiSigManager = new MultiSignatureManager();
    await multiSigManager.initialize(document.document_type);

    console.log(`🔍 Verifying EdDSA document ${documentId} of type ${document.document_type}`);
    console.log(`📝 Required: ${signatureConfig.requiredSignatureCount} signatures from: ${signatureConfig.requiredRoles.join(', ')}`);

    // Verify each signature
    const verificationResults = [];
    for (const signature of document.document_signatures) {
      let isValid = false;

      try {
        // Parse signer_info from database
        const signerInfo = JSON.parse(signature.signer_info);

        // Create the complete signature data object that verifySignature expects
        const signatureData = {
          signature: signature.signature_data,
          signerInfo: `${signerInfo.role}:${signerInfo.name}:${signerInfo.nip || 'N/A'}`,
          timestamp: signature.timestamp.toISOString(),
          documentHash: document.document_hash,
          algorithm: signature.algorithm
        };

        isValid = this.crypto.verifySignature(signatureData, signature.signer.public_key);

        console.log(`🔍 Verifying signature for ${signerInfo.name} (${signerInfo.role}): ${isValid ? '✅ VALID' : '❌ INVALID'}`);

      } catch (verifyError) {
        console.error(`❌ Error verifying signature for ${signature.signer.name}:`, verifyError.message);
        isValid = false;
      }

      verificationResults.push({
        signer: signature.signer.name,
        role: signature.signer.role,
        isValid,
        required: signatureConfig.requiredRoles.includes(signature.signer.role)
      });
    }

    // Check if all required roles are present and valid
    const requiredRolesSigned = signatureConfig.requiredRoles.filter(role =>
      verificationResults.some(result => result.role === role && result.isValid)
    );

    const isFullyValid = requiredRolesSigned.length === signatureConfig.requiredSignatureCount &&
      verificationResults.every(r => r.isValid);

    // Log verification attempt
    await prisma.verification_logs.create({
      data: {
        signed_doc_id: documentId,
        verifier_ip: req.ip,
        verifier_agent: req.get('User-Agent'),
        verification_method: 'api_call',
        verification_result: isFullyValid,
        verification_details: JSON.stringify({
          verificationResults,
          signatureConfig: signatureConfig.description,
          requiredRolesSigned,
          missingRoles: signatureConfig.requiredRoles.filter(role => !requiredRolesSigned.includes(role))
        })
      }
    });

    return {
      success: true,
      data: {
        documentId: document.id,
        documentType: document.document_type,
        prodi: document.prodi,
        noSurat: document.no_surat,
        isComplete: document.is_complete,
        totalSignatures: document.total_signatures_received,
        requiredSignatures: document.total_signatures_required,
        signatureConfig: signatureConfig.description,
        requiredRoles: signatureConfig.requiredRoles,
        createdAt: document.created_at,
        completedAt: document.completed_at,
        verificationResults,
        requiredRolesSigned,
        missingRoles: signatureConfig.requiredRoles.filter(role => !requiredRolesSigned.includes(role)),
        isValid: isFullyValid
      }
    };
  }

  async generateDocumentNumber(type, prodi) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const count = await prisma.signed_documents.count({
      where: {
        document_type: type,
        prodi: prodi,
        created_at: {
          gte: new Date(year, today.getMonth(), 1),
          lt: new Date(year, today.getMonth() + 1, 1)
        }
      }
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${sequence}/${type.toUpperCase()}/${prodi.toUpperCase()}/${month}/${year}`;
  }

  async generatePhysicalDocument(type, prodi, data, qrData) {
    try {
      // Generate QR code with verification URL (simple URL for easy scanning)
      const qrCodePath = await generateQRCodeWithSignature(qrData.verificationUrl, {
        filename: `qr_${qrData.documentId}.png`,
        width: 300,
        margin: 2
      });

      // Generate document with QR code
      const documentData = {
        ...data,
        no_surat: qrData.noSurat,
        qr_code_path: qrCodePath
      };

      const result = await generateDocumentUtil(type, prodi, documentData);
      return result.filePath;

    } catch (error) {
      console.error('Error generating physical document:', error);
      throw error;
    }
  }

  convertSignersFormat(signers) {
    const converted = {};
    signers.forEach(signer => {
      converted[signer.role] = {
        publicKey: signer.public_key,
        privateKey: signer.private_key,
        keyId: signer.key_id
      };
    });
    return converted;
  }

  getSignerName(role, prodi) {
    const names = {
      dosen_pembimbing: `Dr. Pembimbing ${prodi.charAt(0).toUpperCase() + prodi.slice(1)}`,
      ketua_prodi: `Dr. Kaprodi ${prodi.charAt(0).toUpperCase() + prodi.slice(1)}`,
      dekan: `Prof. Dekan Fakultas Teknik`
    };
    return names[role] || `${role} ${prodi}`;
  }

  generateNIP(role) {
    const base = {
      dosen_pembimbing: '198501',
      ketua_prodi: '197501',
      dekan: '196501'
    };
    const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return (base[role] || '199001') + randomSuffix;
  }

  /**
   * Get verification statistics
   */
  getVerificationStats = async (req, res) => {
    try {
      const totalDocuments = await prisma.signed_documents.count();
      const signedDocuments = await prisma.signed_documents.count({
        where: { is_complete: true }
      });
      const pendingDocuments = totalDocuments - signedDocuments;
      const activeSigners = await prisma.signers.count({
        where: { is_active: true }
      });
      const totalSigners = await prisma.signers.count();

      const documentTypes = await prisma.signed_documents.groupBy({
        by: ['document_type'],
        _count: { document_type: true }
      });

      const recentDocuments = await prisma.signed_documents.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          document_type: true,
          prodi: true,
          document_content: true,
          no_surat: true,
          created_at: true,
          is_complete: true,
          total_signatures_required: true,
          total_signatures_received: true
        }
      });

      res.json({
        success: true,
        data: {
          total_documents: totalDocuments,
          signed_documents: signedDocuments,
          pending_documents: pendingDocuments,
          active_signers: activeSigners,
          total_signers: totalSigners,
          document_types: documentTypes.map(dt => ({
            type: dt.document_type,
            count: dt._count.document_type
          })),
          recent_documents: recentDocuments.map(doc => {
            // Parse document content to extract judul and nama_mahasiswa
            let parsedContent = {};
            try {
              parsedContent = JSON.parse(doc.document_content);
            } catch (error) {
              parsedContent = { judul: 'Unknown Document', nama_mahasiswa: 'Unknown Student' };
            }

            return {
              id: doc.id,
              judul: parsedContent.judul || parsedContent.title || doc.no_surat || 'Dokumen Tanpa Judul',
              nama_mahasiswa: parsedContent.nama_mahasiswa || parsedContent.nama || parsedContent.student_name || 'Mahasiswa Tidak Diketahui',
              type: doc.document_type,
              prodi: doc.prodi,
              created_at: doc.created_at,
              status: doc.is_complete ? 'completed' : 'pending',
              signatures_progress: `${doc.total_signatures_received}/${doc.total_signatures_required}`
            };
          })
        }
      });
    } catch (error) {
      console.error('Error getting verification stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get verification statistics'
      });
    }
  };

  /**
   * Upload document template with signature configuration
   */
  uploadTemplate = async (req, res) => {
    try {
      const { type, prodi } = req.params;
      const { config } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No template file uploaded'
        });
      }

      // Parse configuration if provided
      let signatureConfig = null;
      if (config) {
        try {
          signatureConfig = JSON.parse(config);
        } catch (parseError) {
          console.warn('Invalid config format:', parseError);
        }
      }

      // Save template info to database (mock implementation)
      const templateData = {
        id: `tpl_${Date.now()}`,
        type,
        prodi,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        signature_config: signatureConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Template uploaded:', templateData);

      res.json({
        success: true,
        message: `Template for ${type} document (${prodi}) uploaded successfully`,
        data: templateData
      });
    } catch (error) {
      console.error('Error uploading template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload template'
      });
    }
  };

  /**
   * Get signers for template configuration
   */
  getSigners = async (req, res) => {
    try {
      const { prodi } = req.query;

      // Get all signers from database
      const signers = await prisma.signers.findMany({
        where: prodi ? { prodi } : {},
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: signers.map(signer => ({
          id: signer.id,
          name: signer.name,
          nip: signer.nip,
          role: signer.role,
          department: signer.department,
          prodi: signer.prodi,
          is_active: signer.is_active,
          created_at: signer.created_at,
          updated_at: signer.updated_at
        }))
      });
    } catch (error) {
      console.error('Error getting signers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get signers'
      });
    }
  };

  /**
   * Get available templates
   */
  getTemplates = async (req, res) => {
    try {
      const templatesDir = path.join(__dirname, '../templates');
      const templates = [];

      // Read all prodi directories
      const prodiDirs = await fs.readdir(templatesDir, { withFileTypes: true });

      for (const prodiDir of prodiDirs) {
        if (prodiDir.isDirectory() && prodiDir.name !== 'output' && prodiDir.name !== 'qr-code') {
          const prodiPath = path.join(templatesDir, prodiDir.name);
          const templateFiles = await fs.readdir(prodiPath);

          for (const file of templateFiles) {
            if (file.endsWith('.docx')) {
              const type = path.parse(file).name;
              const stats = await fs.stat(path.join(prodiPath, file));

              templates.push({
                type,
                prodi: prodiDir.name,
                filename: file,
                size: stats.size,
                modified: stats.mtime
              });
            }
          }
        }
      }

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get templates'
      });
    }
  };

  /**
   * Delete document template
   */
  deleteTemplate = async (req, res) => {
    try {
      const { type, prodi } = req.params;
      const templatePath = path.join(__dirname, '../templates', prodi, `${type}.docx`);

      // Check if template exists
      if (!(await fs.pathExists(templatePath))) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Delete template file
      await fs.remove(templatePath);

      res.json({
        success: true,
        message: `Template for ${type} document (${prodi}) deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template'
      });
    }
  };

  /**
   * Get document fields based on document type and prodi
   */
  getDocumentFields = async (req, res) => {
    try {
      const { type, prodi } = req.params;

      console.log(`📋 Getting document fields for: ${type} - ${prodi}`);

      // Import service (lazy loading to avoid circular dependency)
      const EdDSADocumentService = require('../services/eddsa-document-service');
      const documentService = new EdDSADocumentService();

      const result = await documentService.getDocumentFields(type, prodi);

      res.json(result);
    } catch (error) {
      console.error('Error getting document fields:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get all available document types
   */
  getDocumentTypes = async (req, res) => {
    try {
      const { prodi } = req.query;

      console.log(`📋 Getting available document types${prodi ? ` for ${prodi}` : ''}`);

      const EdDSADocumentService = require('../services/eddsa-document-service');
      const documentService = new EdDSADocumentService();

      const result = await documentService.getAvailableDocumentTypes(prodi);

      res.json(result);
    } catch (error) {
      console.error('Error getting document types:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get all available prodis
   */
  getAvailableProdis = async (req, res) => {
    try {
      console.log('🏫 Getting available prodis');

      const EdDSADocumentService = require('../services/eddsa-document-service');
      const documentService = new EdDSADocumentService();

      const result = await documentService.getAvailableProdis();

      res.json(result);
    } catch (error) {
      console.error('Error getting available prodis:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Generate document with dynamic fields
   */
  generateDynamicDocument = async (req, res) => {
    try {
      const { type, prodi } = req.params;
      const formData = req.body;

      console.log(`📄 Generating dynamic document: ${type} for ${prodi}`);
      console.log('Form data received:', Object.keys(formData));

      // 1. Validate document type
      if (!(await isValidDocumentTypeAsync(type))) {
        return res.status(400).json({
          success: false,
          error: `Invalid document type: ${type}`
        });
      }

      // 2. Get document fields configuration
      const EdDSADocumentService = require('../services/eddsa-document-service');
      const documentService = new EdDSADocumentService();

      const fieldsResult = await documentService.getDocumentFields(type, prodi);
      if (!fieldsResult.success) {
        return res.status(400).json(fieldsResult);
      }

      const fields = fieldsResult.data.fields;

      // 3. Validate form data against field requirements
      const validationErrors = [];
      const processedData = {};

      for (const field of fields) {
        const fieldName = field.field_name;
        const fieldValue = formData[fieldName];

        // Check required fields
        if (field.is_required && (!fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
          validationErrors.push(`Field '${fieldName}' is required`);
          continue;
        }

        // Validate field types and rules
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          const rules = field.validation_rules || {};

          // String validation
          if (typeof fieldValue === 'string') {
            if (rules.minLength && fieldValue.length < rules.minLength) {
              validationErrors.push(`Field '${fieldName}' must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && fieldValue.length > rules.maxLength) {
              validationErrors.push(`Field '${fieldName}' must not exceed ${rules.maxLength} characters`);
            }
            if (rules.pattern && !new RegExp(rules.pattern).test(fieldValue)) {
              validationErrors.push(`Field '${fieldName}' format is invalid`);
            }
            if (rules.allowed_values && !rules.allowed_values.includes(fieldValue)) {
              validationErrors.push(`Field '${fieldName}' must be one of: ${rules.allowed_values.join(', ')}`);
            }
          }

          // Number validation
          if (field.field_type === 'number') {
            const numValue = Number(fieldValue);
            if (isNaN(numValue)) {
              validationErrors.push(`Field '${fieldName}' must be a number`);
            } else {
              if (rules.min !== undefined && numValue < rules.min) {
                validationErrors.push(`Field '${fieldName}' must be at least ${rules.min}`);
              }
              if (rules.max !== undefined && numValue > rules.max) {
                validationErrors.push(`Field '${fieldName}' must not exceed ${rules.max}`);
              }
            }
          }

          // Table/Array validation
          if ((field.field_type === 'table' || field.field_type === 'array') && Array.isArray(fieldValue)) {
            if (rules.min_rows && fieldValue.length < rules.min_rows) {
              validationErrors.push(`Field '${fieldName}' must have at least ${rules.min_rows} rows`);
            }
            if (rules.max_rows && fieldValue.length > rules.max_rows) {
              validationErrors.push(`Field '${fieldName}' must not exceed ${rules.max_rows} rows`);
            }
          }
        }

        processedData[fieldName] = fieldValue;
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
      }

      // 4. Generate unique document ID
      const documentId = uuidv4();

      // 5. Get signature requirements
      const signatureRequirements = await getSignatureRequirementsFromDB(type);

      // 6. Prepare data for document generation
      const documentMetadata = {
        id: documentId,
        type: type,
        prodi: prodi,
        created_at: new Date().toISOString(),
        fields: processedData
      };

      // 7. Generate document using existing utility
      const templatePath = path.join(__dirname, '..', 'templates', prodi, `${type}.docx`);
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({
          success: false,
          error: `Template not found: ${templatePath}`
        });
      }

      const outputFileName = `${prodi}_${type}_${Date.now()}.docx`;
      const outputPath = path.join(__dirname, '..', 'templates', 'output', outputFileName);

      // Generate document with processed data
      await generateDocumentUtil(templatePath, outputPath, processedData);

      // 8. Create multi-signature manager
      const multiSigManager = new MultiSignatureManager();

      // 9. Generate signatures for each required role
      const signatures = {};
      const signatureData = {
        documentId,
        documentType: type,
        prodi: prodi,
        timestamp: Date.now(),
        fields: processedData
      };

      for (const requirement of signatureRequirements.requirements) {
        const keyPair = this.crypto.generateKeyPair();
        const signature = await this.crypto.sign(JSON.stringify(signatureData), keyPair.privateKey);

        signatures[requirement.role] = {
          signature: signature,
          publicKey: keyPair.publicKey,
          role: requirement.role,
          timestamp: Date.now()
        };

        multiSigManager.addSignature(requirement.role, signature, keyPair.publicKey);
      }

      // 10. Verify multi-signature
      const verificationResult = multiSigManager.verifyAllSignatures(JSON.stringify(signatureData));

      if (!verificationResult.isValid) {
        return res.status(500).json({
          success: false,
          error: 'Multi-signature verification failed',
          details: verificationResult
        });
      }

      // 11. Generate enhanced QR code
      const verifyAppBaseUrl = getVerifyAppBaseUrl();
      const verificationUrl = `${verifyAppBaseUrl}/verify/${documentId}`;

      const qrCodePath = await generateQRCodeWithSignature(
        documentId,
        verificationUrl,
        signatures,
        processedData
      );

      // 12. Store document metadata in database
      const savedDocument = await prisma.signed_document.create({
        data: {
          id: documentId,
          document_type: type,
          prodi: prodi,
          file_path: outputPath,
          qr_code_path: qrCodePath,
          verification_url: verificationUrl,
          signatures: JSON.stringify(signatures),
          multi_signature_hash: verificationResult.combinedHash,
          verification_data: JSON.stringify(signatureData),
          is_verified: verificationResult.isValid,
          created_at: new Date(),
          metadata: JSON.stringify(documentMetadata)
        }
      });

      // 13. Store individual signatures
      for (const [role, sigData] of Object.entries(signatures)) {
        await prisma.document_signature.create({
          data: {
            document_id: documentId,
            role: role,
            signature: sigData.signature,
            public_key: sigData.publicKey,
            timestamp: new Date(sigData.timestamp),
            is_verified: true
          }
        });
      }

      console.log(`✅ Dynamic document created successfully: ${documentId}`);

      res.json({
        success: true,
        message: 'Dynamic document generated and signed successfully',
        data: {
          signedDocument: {
            id: documentId,
            document_type: type,
            prodi: prodi,
            file_path: outputPath,
            qr_code_path: qrCodePath,
            verification_url: verificationUrl,
            multi_signature_hash: verificationResult.combinedHash,
            is_verified: verificationResult.isValid,
            created_at: savedDocument.created_at,
            metadata: documentMetadata
          },
          signatures: signatures,
          verification: {
            isValid: verificationResult.isValid,
            totalSignatures: Object.keys(signatures).length,
            requiredSignatures: signatureRequirements.requirements.length,
            combinedHash: verificationResult.combinedHash
          }
        }
      });

    } catch (error) {
      console.error('Error generating dynamic document:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  };
}

module.exports = EdDSADocumentController;
