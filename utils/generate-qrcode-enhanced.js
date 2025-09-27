// utils/generate-qrcode-enhanced.js
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Enhanced QR Code Generator untuk EdDSA Multi-Signature System
 * Implementasi sesuai proposal: "QR Code dinamis yang menyimpan informasi penting 
 * seperti hash dokumen, hasil multi-signature, timestamp, dan metadata terkait"
 */
class EnhancedQRGenerator {
  constructor() {
    this.qrCodeDir = path.resolve(__dirname, '../templates/qr-code');
    this.ensureQRDirectory();
  }

  ensureQRDirectory() {
    if (!fs.existsSync(this.qrCodeDir)) {
      fs.mkdirSync(this.qrCodeDir, { recursive: true });
    }
  }

  /**
   * Generate QR Code dengan signature data dan metadata
   * @param {string} signatureData - JSON string dengan data signature
   * @param {Object} options - Opsi untuk QR Code
   * @returns {string} Path ke file QR Code
   */
  async generateQRCodeWithSignature(signatureData, options = {}) {
    try {
      const timestamp = new Date().getTime();
      const filename = `qr_signature_${timestamp}.png`;
      const qrOutputPath = path.join(this.qrCodeDir, filename);

      // Konfigurasi QR Code yang optimal untuk data signature
      const qrOptions = {
        width: options.width || 400,
        margin: options.margin || 2,
        color: {
          dark: options.darkColor || '#000000',
          light: options.lightColor || '#FFFFFF'
        },
        errorCorrectionLevel: 'H', // High error correction untuk data penting
        type: 'png',
        quality: 0.92,
        ...options.customOptions
      };

      // Compress data jika terlalu besar untuk QR Code
      let qrData = signatureData;
      if (signatureData.length > 2000) {
        // Untuk data besar, simpan hash dan URL ke verifikasi online
        const dataHash = crypto.createHash('sha256').update(signatureData).digest('hex');
        const baseUrl = process.env.BASE_URL || 'http://localhost:8080';

        qrData = JSON.stringify({
          type: 'signature_verification',
          hash: dataHash,
          verify_url: `${baseUrl}/api/verify/${dataHash}`,
          timestamp: new Date().toISOString(),
          compressed: true
        });
      }

      await QRCode.toFile(qrOutputPath, qrData, qrOptions);

      return {
        filePath: qrOutputPath,
        fileName: filename,
        dataSize: signatureData.length,
        qrDataSize: qrData.length,
        isCompressed: qrData !== signatureData
      };

    } catch (error) {
      console.error('Error generating QR Code with signature:', error);
      throw new Error(`Gagal menghasilkan QR Code: ${error.message}`);
    }
  }

  /**
   * Generate QR Code dengan embedded signature verification
   * @param {Object} multiSignatureData 
   * @param {Object} documentMetadata 
   * @returns {Object}
   */
  async generateVerificationQR(multiSignatureData, documentMetadata) {
    try {
      const verificationData = {
        version: '1.0',
        algorithm: 'EdDSA-MultiSig',
        document: {
          id: documentMetadata.id,
          type: documentMetadata.type,
          prodi: documentMetadata.prodi,
          hash: multiSignatureData.documentHash,
          timestamp: multiSignatureData.timestamp
        },
        signatures: {
          count: multiSignatureData.signerCount,
          algorithm: multiSignatureData.algorithm,
          signers: multiSignatureData.signatures.map(sig => ({
            role: sig.role,
            name: sig.signerName,
            keyId: sig.keyId,
            timestamp: sig.timestamp
          }))
        },
        verification: {
          url: `${process.env.BASE_URL || 'http://localhost:8080'}/verify/${documentMetadata.id}`,
          qr_generated: new Date().toISOString()
        }
      };

      const qrString = JSON.stringify(verificationData);
      const result = await this.generateQRCodeWithSignature(qrString, {
        width: 300,
        margin: 3,
        errorCorrectionLevel: 'H'
      });

      return {
        ...result,
        verificationData,
        qrString
      };

    } catch (error) {
      throw new Error(`Gagal membuat verification QR: ${error.message}`);
    }
  }

  /**
   * Generate QR Code untuk quick verification (standalone)
   * @param {Object} params 
   * @returns {Object}
   */
  async generateStandaloneVerificationQR(params) {
    try {
      const { documentHash, signatures, documentId, metadata } = params;

      // Data minimal untuk verifikasi offline
      const standaloneData = {
        v: '1.0', // version
        t: 'standalone', // type
        id: documentId,
        h: documentHash, // document hash
        s: signatures.map(sig => ({
          r: sig.role,
          k: sig.keyId,
          s: sig.signature.substring(0, 32), // truncated signature for size
          t: sig.timestamp
        })),
        m: {
          type: metadata.type,
          prodi: metadata.prodi,
          created: metadata.timestamp
        }
      };

      const compactString = JSON.stringify(standaloneData);
      const base64Data = Buffer.from(compactString).toString('base64');

      const result = await this.generateQRCodeWithSignature(base64Data, {
        width: 250,
        margin: 2,
        errorCorrectionLevel: 'M'
      });

      return {
        ...result,
        standaloneData,
        base64Data,
        isStandalone: true
      };

    } catch (error) {
      throw new Error(`Gagal membuat standalone QR: ${error.message}`);
    }
  }

  /**
   * Validate dan parse QR Code data
   * @param {string} qrData 
   * @returns {Object}
   */
  parseQRData(qrData) {
    try {
      let parsedData;

      // Try direct JSON parse
      try {
        parsedData = JSON.parse(qrData);
      } catch {
        // Try base64 decode
        try {
          const decoded = Buffer.from(qrData, 'base64').toString('utf-8');
          parsedData = JSON.parse(decoded);
        } catch {
          throw new Error('Format QR Code tidak valid');
        }
      }

      // Validate structure
      if (!parsedData.version && !parsedData.v) {
        throw new Error('QR Code tidak memiliki informasi versi');
      }

      const dataType = parsedData.type || parsedData.t || 'unknown';

      return {
        isValid: true,
        type: dataType,
        data: parsedData,
        version: parsedData.version || parsedData.v
      };

    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Generate multiple QR formats untuk fleksibilitas
   * @param {Object} signatureData 
   * @param {Object} metadata 
   * @returns {Object}
   */
  async generateMultiFormatQR(signatureData, metadata) {
    try {
      const results = {};

      // 1. Full verification QR (untuk verifikasi online)
      results.full = await this.generateVerificationQR(signatureData, metadata);

      // 2. Standalone QR (untuk verifikasi offline)
      results.standalone = await this.generateStandaloneVerificationQR({
        documentHash: signatureData.documentHash,
        signatures: signatureData.signatures,
        documentId: metadata.id,
        metadata: metadata
      });

      // 3. Compact QR (URL only untuk space-constrained situations)
      const compactUrl = `${process.env.BASE_URL || 'http://localhost:8080'}/v/${metadata.id}`;
      results.compact = await this.generateQRCodeWithSignature(compactUrl, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'L'
      });

      return {
        success: true,
        formats: results,
        recommendation: this.recommendQRFormat(signatureData, metadata)
      };

    } catch (error) {
      throw new Error(`Gagal generate multi-format QR: ${error.message}`);
    }
  }

  /**
   * Recommend QR format berdasarkan use case
   * @param {Object} signatureData 
   * @param {Object} metadata 
   * @returns {string}
   */
  recommendQRFormat(signatureData, metadata) {
    const dataSize = JSON.stringify(signatureData).length;

    if (dataSize > 2000) {
      return 'compact'; // Untuk dokumen dengan banyak signature
    } else if (metadata.requiresOfflineVerification) {
      return 'standalone'; // Untuk verifikasi tanpa internet
    } else {
      return 'full'; // Default untuk verifikasi online lengkap
    }
  }

  /**
   * Clean up old QR files
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async cleanupOldQRFiles(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    try {
      const files = fs.readdirSync(this.qrCodeDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.qrCodeDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up QR files:', error);
    }
  }
}

// Export functions untuk backward compatibility
const qrGenerator = new EnhancedQRGenerator();

const generateQRCodeWithSignature = async (signatureData, options = {}) => {
  const result = await qrGenerator.generateQRCodeWithSignature(signatureData, options);
  return result.filePath;
};

const generateVerificationQR = async (multiSignatureData, documentMetadata) => {
  return await qrGenerator.generateVerificationQR(multiSignatureData, documentMetadata);
};

const parseQRData = (qrData) => {
  return qrGenerator.parseQRData(qrData);
};

module.exports = {
  EnhancedQRGenerator,
  generateQRCodeWithSignature,
  generateVerificationQR,
  parseQRData,
  qrGenerator
};
