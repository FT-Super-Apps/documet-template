// services/eddsa-document-service.js
const { MultiSignatureManager } = require('../utils/eddsa-crypto');
const { generateQRCodeWithSignature } = require('../utils/generate-qrcode-enhanced');
const generateDocument = require('../utils/generate-document-enhanced');
const prisma = require('../prisma');
const crypto = require('crypto');

class EdDSADocumentService {
  constructor() {
    this.multiSigManager = new MultiSignatureManager();
  }

  /**
   * Inisialisasi penandatangan untuk prodi tertentu
   * @param {string} prodi 
   * @returns {Object}
   */
  async initializeSignersForProdi(prodi) {
    try {
      // Cek apakah signers sudah ada untuk prodi ini
      const existingSigners = await prisma.signers.findMany({
        where: {
          prodi: prodi,
          is_active: true
        }
      });

      if (existingSigners.length >= 3) {
        return {
          message: `Signers untuk prodi ${prodi} sudah ada`,
          signers: existingSigners.map(s => ({
            id: s.id,
            name: s.name,
            role: s.role,
            keyId: s.key_id
          }))
        };
      }

      // Generate signers baru jika belum ada
      const newSigners = this.multiSigManager.initializeSigners();
      const savedSigners = [];

      for (const [role, signerData] of Object.entries(newSigners)) {
        const signer = await prisma.signers.create({
          data: {
            name: this.getDefaultSignerName(role, prodi),
            role: role,
            prodi: prodi,
            public_key: signerData.publicKey,
            private_key: signerData.privateKey, // In production, encrypt this
            key_id: signerData.keyId,
            department: 'Fakultas Teknik'
          }
        });
        savedSigners.push(signer);
      }

      return {
        message: `Signers baru dibuat untuk prodi ${prodi}`,
        signers: savedSigners
      };
    } catch (error) {
      throw new Error(`Gagal inisialisasi signers: ${error.message}`);
    }
  }

  /**
   * Generate dokumen dengan multi-signature EdDSA
   * @param {Object} params 
   * @returns {Object}
   */
  async generateSignedDocument(params) {
    try {
      const { type, prodi, data, signerDetails } = params;

      // 1. Validasi input
      if (!type || !prodi || !data) {
        throw new Error('Parameter type, prodi, dan data wajib disediakan');
      }

      // 2. Ambil template dokumen
      const documentTemplate = await prisma.documents.findFirst({
        where: { type, prodi },
        include: { document_fields: true }
      });

      if (!documentTemplate) {
        throw new Error(`Template dokumen ${type} untuk prodi ${prodi} tidak ditemukan`);
      }

      // 3. Generate content dokumen
      const documentContent = await this.generateDocumentContent(documentTemplate, data);

      // 4. Ambil signers untuk prodi ini
      const signers = await this.getSignersForProdi(prodi);
      if (signers.length < 3) {
        throw new Error(`Tidak cukup signers aktif untuk prodi ${prodi}`);
      }

      // 5. Buat multi-signature
      const signersMap = this.transformSignersToMap(signers);
      const multiSignature = this.multiSigManager.createMultiSignature(
        documentContent,
        signersMap,
        signerDetails || this.getDefaultSignerDetails(signers)
      );

      // 6. Simpan signed document ke database
      const signedDoc = await this.saveSignedDocument({
        documentTemplate,
        documentContent,
        multiSignature,
        prodi,
        type,
        data
      });

      // 7. Generate QR Code
      const qrData = this.multiSigManager.generateQRData(multiSignature, {
        id: signedDoc.id,
        type: type,
        prodi: prodi
      });

      const qrCodePath = await generateQRCodeWithSignature(qrData.qrString);

      // 8. Update QR code path
      await prisma.signed_documents.update({
        where: { id: signedDoc.id },
        data: { qr_code_image: qrCodePath }
      });

      // 9. Generate dokumen fisik dengan QR code
      const documentPath = await generateDocument(type, prodi, {
        ...data,
        qr_code_data: qrData.qrString,
        signature_info: multiSignature,
        no_surat: signedDoc.no_surat
      });

      // 10. Update file path
      await prisma.signed_documents.update({
        where: { id: signedDoc.id },
        data: { file_path: documentPath }
      });

      return {
        success: true,
        data: {
          documentId: signedDoc.id,
          filePath: documentPath,
          qrCodePath: qrCodePath,
          noSurat: signedDoc.no_surat,
          multiSignature: multiSignature,
          qrData: qrData,
          message: `Dokumen ${type.toUpperCase()} dengan multi-signature EdDSA berhasil dibuat`
        }
      };

    } catch (error) {
      throw new Error(`Gagal membuat dokumen signed: ${error.message}`);
    }
  }

  /**
   * Verifikasi dokumen berdasarkan QR Code
   * @param {string} qrData 
   * @param {string} clientInfo 
   * @returns {Object}
   */
  async verifyDocumentFromQR(qrData, clientInfo = {}) {
    try {
      // 1. Parse QR data
      let parsedData;
      try {
        // Try JSON parse first
        parsedData = JSON.parse(qrData);
      } catch {
        // Try base64 decode then parse
        const decoded = Buffer.from(qrData, 'base64').toString('utf-8');
        parsedData = JSON.parse(decoded);
      }

      // 2. Ambil dokumen dari database
      const signedDoc = await prisma.signed_documents.findFirst({
        where: { id: parsedData.documentId },
        include: {
          document_signatures: {
            include: { signer: true }
          }
        }
      });

      if (!signedDoc) {
        throw new Error('Dokumen tidak ditemukan dalam sistem');
      }

      // 3. Rekonstruksi multi-signature object
      const multiSignature = {
        documentHash: signedDoc.document_hash,
        signatures: signedDoc.document_signatures.map(sig => ({
          signature: sig.signature_data,
          role: sig.signer.role,
          signerName: sig.signer.name,
          signerNip: sig.signer.nip,
          publicKey: sig.signer.public_key,
          timestamp: sig.timestamp.toISOString(),
          keyId: sig.signer.key_id,
          algorithm: sig.algorithm,
          signerInfo: JSON.parse(sig.signer_info)
        })),
        timestamp: signedDoc.created_at.toISOString(),
        algorithm: 'EdDSA-MultiSig',
        signerCount: signedDoc.document_signatures.length,
        isComplete: signedDoc.is_complete
      };

      // 4. Verifikasi multi-signature
      const verificationResult = this.multiSigManager.verifyMultiSignature(
        multiSignature,
        signedDoc.document_content
      );

      // 5. Log verifikasi
      await prisma.verification_logs.create({
        data: {
          signed_doc_id: signedDoc.id,
          verifier_ip: clientInfo.ip || 'unknown',
          verifier_agent: clientInfo.userAgent || 'unknown',
          verification_method: 'qr_scan',
          verification_result: verificationResult.isValid,
          verification_details: JSON.stringify(verificationResult)
        }
      });

      return {
        isValid: verificationResult.isValid,
        document: {
          id: signedDoc.id,
          type: signedDoc.document_type,
          prodi: signedDoc.prodi,
          noSurat: signedDoc.no_surat,
          createdAt: signedDoc.created_at,
          completedAt: signedDoc.completed_at
        },
        verification: verificationResult,
        signers: verificationResult.verificationResults,
        qrData: parsedData,
        message: verificationResult.isValid
          ? 'Dokumen valid dan tanda tangan terverifikasi'
          : 'Dokumen tidak valid atau tanda tangan tidak sah'
      };

    } catch (error) {
      // Log failed verification attempt
      if (clientInfo.documentId) {
        await prisma.verification_logs.create({
          data: {
            signed_doc_id: clientInfo.documentId,
            verifier_ip: clientInfo.ip || 'unknown',
            verifier_agent: clientInfo.userAgent || 'unknown',
            verification_method: 'qr_scan',
            verification_result: false,
            verification_details: JSON.stringify({ error: error.message })
          }
        }).catch(() => { }); // Ignore logging errors
      }

      throw new Error(`Verifikasi gagal: ${error.message}`);
    }
  }

  /**
   * Get dokumen yang sudah ditandatangani dengan pagination
   * @param {Object} filters 
   * @returns {Object}
   */
  async getSignedDocuments(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        prodi,
        isComplete,
        startDate,
        endDate
      } = filters;

      const where = {};
      if (type) where.document_type = type;
      if (prodi) where.prodi = prodi;
      if (isComplete !== undefined) where.is_complete = isComplete;
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      const [documents, total] = await Promise.all([
        prisma.signed_documents.findMany({
          where,
          include: {
            document_signatures: {
              include: { signer: true }
            },
            verification_logs: {
              take: 5,
              orderBy: { verified_at: 'desc' }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: parseInt(limit)
        }),
        prisma.signed_documents.count({ where })
      ]);

      return {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Gagal mengambil dokumen: ${error.message}`);
    }
  }

  /**
   * Get statistik verifikasi
   * @param {Object} filters 
   * @returns {Object}
   */
  async getVerificationStats(filters = {}) {
    try {
      const { startDate, endDate, prodi } = filters;

      const where = {};
      if (startDate || endDate) {
        where.verified_at = {};
        if (startDate) where.verified_at.gte = new Date(startDate);
        if (endDate) where.verified_at.lte = new Date(endDate);
      }

      if (prodi) {
        where.signed_document = { prodi };
      }

      const [
        totalVerifications,
        successfulVerifications,
        uniqueDocuments,
        verificationsByMethod
      ] = await Promise.all([
        prisma.verification_logs.count({ where }),
        prisma.verification_logs.count({
          where: { ...where, verification_result: true }
        }),
        prisma.verification_logs.groupBy({
          by: ['signed_doc_id'],
          where
        }),
        prisma.verification_logs.groupBy({
          by: ['verification_method'],
          where,
          _count: { verification_method: true }
        })
      ]);

      return {
        totalVerifications,
        successfulVerifications,
        failedVerifications: totalVerifications - successfulVerifications,
        successRate: totalVerifications > 0
          ? ((successfulVerifications / totalVerifications) * 100).toFixed(2)
          : 0,
        uniqueDocumentsVerified: uniqueDocuments.length,
        verificationsByMethod: verificationsByMethod.map(item => ({
          method: item.verification_method,
          count: item._count.verification_method
        }))
      };
    } catch (error) {
      throw new Error(`Gagal mengambil statistik: ${error.message}`);
    }
  }

  // Helper methods
  async generateDocumentContent(documentTemplate, data) {
    // Implementasi sesuai dengan generate-fields.js yang sudah ada
    const { generateFields } = require('../utils/generate-fields');
    return await generateFields(documentTemplate.type, documentTemplate.prodi, data);
  }

  async getSignersForProdi(prodi) {
    return await prisma.signers.findMany({
      where: {
        prodi: prodi,
        is_active: true
      },
      orderBy: { role: 'asc' }
    });
  }

  transformSignersToMap(signers) {
    const signersMap = {};
    signers.forEach(signer => {
      signersMap[signer.role] = {
        publicKey: signer.public_key,
        privateKey: signer.private_key,
        keyId: signer.key_id,
        required: true,
        hasSigned: false
      };
    });
    return signersMap;
  }

  getDefaultSignerDetails(signers) {
    const details = {};
    signers.forEach(signer => {
      details[signer.role] = {
        nama: signer.name,
        nip: signer.nip || 'N/A'
      };
    });
    return details;
  }

  async saveSignedDocument(params) {
    const { documentTemplate, documentContent, multiSignature, prodi, type, data } = params;

    // Generate nomor surat
    const { lastNumber } = require('../api');
    const no_surat = await lastNumber(type);

    const signedDoc = await prisma.signed_documents.create({
      data: {
        document_type: type,
        prodi: prodi,
        document_content: JSON.stringify(documentContent),
        document_hash: multiSignature.documentHash,
        no_surat: no_surat,
        qr_code_data: JSON.stringify(multiSignature),
        total_signatures_required: multiSignature.signatures.length,
        total_signatures_received: multiSignature.signatures.length,
        is_complete: multiSignature.isComplete,
        completed_at: multiSignature.isComplete ? new Date() : null,
        document_id: documentTemplate.id
      }
    });

    // Simpan individual signatures
    for (const signature of multiSignature.signatures) {
      const signer = await prisma.signers.findFirst({
        where: { key_id: signature.keyId }
      });

      if (signer) {
        await prisma.document_signatures.create({
          data: {
            signed_doc_id: signedDoc.id,
            signer_id: signer.id,
            signature_data: signature.signature,
            signature_hash: crypto.createHash('sha256').update(signature.signature).digest('hex'),
            signer_info: JSON.stringify(signature.signerInfo),
            algorithm: signature.algorithm,
            timestamp: new Date(signature.timestamp)
          }
        });
      }
    }

    return signedDoc;
  }

  /**
   * Mendapatkan document fields berdasarkan tipe dokumen dan prodi
   * @param {string} type - Tipe dokumen (kkp, kkplus, bimbingan, etc.)
   * @param {string} prodi - Nama prodi 
   * @returns {Object}
   */
  async getDocumentFields(type, prodi) {
    try {
      // Cari dokumen berdasarkan type dan prodi
      const document = await prisma.documents.findFirst({
        where: {
          type: type,
          prodi: prodi,
          is_active: true
        },
        include: {
          document_fields: {
            where: { is_active: true },
            orderBy: { display_order: 'asc' }
          },
          document_templates: {
            where: { is_default: true }
          }
        }
      });

      if (!document) {
        throw new Error(`Dokumen dengan tipe '${type}' untuk prodi '${prodi}' tidak ditemukan`);
      }

      // Format response dengan informasi field yang lebih detail
      const formattedFields = document.document_fields.map(field => {
        let validationRules = {};
        try {
          validationRules = field.validation_rules ? JSON.parse(field.validation_rules) : {};
        } catch (e) {
          validationRules = {};
        }

        return {
          id: field.id,
          field_name: field.field_name,
          field_type: field.field_type,
          is_required: field.is_required,
          default_value: field.default_value,
          validation_rules: validationRules,
          help_text: field.help_text,
          display_order: field.display_order
        };
      });

      return {
        success: true,
        data: {
          document: {
            id: document.id,
            type: document.type,
            prodi: document.prodi,
            description: document.description,
            version: document.version,
            template_path: document.template_path,
            max_filesize_mb: document.max_filesize_mb
          },
          fields: formattedFields,
          template: document.document_templates[0] || null,
          total_fields: formattedFields.length
        }
      };
    } catch (error) {
      throw new Error(`Gagal mendapatkan document fields: ${error.message}`);
    }
  }

  /**
   * Mendapatkan semua tipe dokumen yang tersedia
   * @param {string} prodi - Optional, filter berdasarkan prodi
   * @returns {Object}
   */
  async getAvailableDocumentTypes(prodi = null) {
    try {
      const where = { is_active: true };
      if (prodi) {
        where.prodi = prodi;
      }

      const documents = await prisma.documents.findMany({
        where,
        select: {
          id: true,
          type: true,
          prodi: true,
          description: true,
          version: true,
          _count: {
            select: { document_fields: true }
          }
        },
        orderBy: [
          { prodi: 'asc' },
          { type: 'asc' }
        ]
      });

      // Group by type untuk mendapatkan informasi unik per tipe
      const documentTypes = documents.reduce((acc, doc) => {
        if (!acc[doc.type]) {
          acc[doc.type] = {
            type: doc.type,
            description_template: doc.description.replace(doc.prodi, '{{prodi}}'),
            prodis: [],
            total_variants: 0
          };
        }

        acc[doc.type].prodis.push({
          id: doc.id,
          prodi: doc.prodi,
          description: doc.description,
          version: doc.version,
          field_count: doc._count.document_fields
        });
        acc[doc.type].total_variants++;

        return acc;
      }, {});

      return {
        success: true,
        data: {
          document_types: Object.values(documentTypes),
          total_types: Object.keys(documentTypes).length,
          total_variants: documents.length
        }
      };
    } catch (error) {
      throw new Error(`Gagal mendapatkan tipe dokumen: ${error.message}`);
    }
  }

  /**
   * Mendapatkan daftar prodi yang tersedia
   * @returns {Object}
   */
  async getAvailableProdis() {
    try {
      const prodis = await prisma.documents.findMany({
        where: { is_active: true },
        select: {
          prodi: true,
          _count: {
            select: { document_fields: true }
          }
        },
        distinct: ['prodi'],
        orderBy: { prodi: 'asc' }
      });

      // Get display names from document_fields
      const prodiDetails = await Promise.all(
        prodis.map(async (prodiItem) => {
          const sampleField = await prisma.document_fields.findFirst({
            where: {
              field_name: 'nama_prodi',
              documents: { prodi: prodiItem.prodi }
            },
            select: { default_value: true }
          });

          return {
            key: prodiItem.prodi,
            display_name: sampleField?.default_value || prodiItem.prodi,
            document_count: prodiItem._count?.document_fields || 0
          };
        })
      );

      return {
        success: true,
        data: {
          prodis: prodiDetails,
          total_prodis: prodiDetails.length
        }
      };
    } catch (error) {
      throw new Error(`Gagal mendapatkan daftar prodi: ${error.message}`);
    }
  }

  getDefaultSignerName(role, prodi) {
    const names = {
      dosen_pembimbing: `Dr. Pembimbing ${prodi}`,
      ketua_prodi: `Dr. Kaprodi ${prodi}`,
      dekan: `Prof. Dekan Fakultas Teknik`
    };
    return names[role] || `${role} ${prodi}`;
  }
}

module.exports = EdDSADocumentService;
