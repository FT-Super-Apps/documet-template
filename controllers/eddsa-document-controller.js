// controllers/eddsa-document-controller.js
const { PrismaClient } = require('@prisma/client');
const { EdDSACrypto, MultiSignatureManager } = require('../utils/eddsa-crypto');
const { getSignatureRequirements, getSignatureRequirementsFromDB, isValidDocumentType } = require('../config/document-signature-config');
const generateDocumentUtil = require('../utils/generate-document');
const { generateQRCodeWithSignature } = require('../utils/generate-qrcode-enhanced');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

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

      // 1. Validate document type
      if (!isValidDocumentType(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid document type: ${type}. Supported types: kkp, kkplus, bimbingan`
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
      const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
      const verificationUrl = `${baseUrl}/verify/${documentId}`;

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
              algorithm: 'EdDSA'
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
          verificationUrl: `${req.protocol}://${req.get('host')}/api/eddsa/verify/${signedDoc.id}`
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

      res.json({
        success: true,
        data: {
          documents,
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

    // Get signature requirements for this document type
    const signatureConfig = await getSignatureRequirementsFromDB(document.document_type);
    const multiSigManager = new MultiSignatureManager();
    await multiSigManager.initialize(document.document_type);

    console.log(`🔍 Verifying document ${documentId} of type ${document.document_type}`);
    console.log(`📝 Required: ${signatureConfig.requiredSignatureCount} signatures from: ${signatureConfig.requiredRoles.join(', ')}`);

    // Verify each signature
    const verificationResults = [];
    for (const signature of document.document_signatures) {
      const isValid = this.crypto.verifySignature(
        {
          signature: signature.signature_data,
          algorithm: signature.algorithm
        },
        signature.signer.public_key
      );

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
}

module.exports = EdDSADocumentController;
