// utils/eddsa-crypto.js
const crypto = require('crypto');
const { Buffer } = require('buffer');

/**
 * EdDSA (Ed25519) Implementation for Multi-Signature Digital Document System
 * Based on: "Integrasi Algoritma EdDSA dengan Multi-Signature pada Sistem Tanda Tangan Digital Berbasis QR Code"
 */
class EdDSACrypto {
  constructor() {
    // EdDSA menggunakan kurva Ed25519
    this.algorithm = 'ed25519';
  }

  /**
   * Generate key pair untuk setiap penandatangan
   * @returns {Object} { publicKey, privateKey }
   */
  generateKeyPair() {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync(this.algorithm, {
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      return {
        publicKey,
        privateKey,
        keyId: this.generateKeyId(publicKey)
      };
    } catch (error) {
      throw new Error(`Gagal membuat key pair EdDSA: ${error.message}`);
    }
  }

  /**
   * Generate unique key ID dari public key
   * @param {string} publicKey 
   * @returns {string}
   */
  generateKeyId(publicKey) {
    return crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Buat hash SHA-256 dari dokumen
   * @param {string} documentContent 
   * @returns {string}
   */
  hashDocument(documentContent) {
    return crypto
      .createHash('sha256')
      .update(documentContent)
      .digest('hex');
  }

  /**
   * Buat tanda tangan digital EdDSA
   * @param {string} documentHash 
   * @param {string} privateKey 
   * @param {string} signerInfo - informasi penandatangan
   * @returns {Object}
   */
  signDocument(documentHash, privateKey, signerInfo) {
    try {
      // EdDSA bersifat deterministik - tidak memerlukan nonce
      const timestamp = new Date().toISOString();
      const dataToSign = `${documentHash}|${signerInfo}|${timestamp}`;

      const signature = crypto.sign(null, Buffer.from(dataToSign), {
        key: privateKey,
        format: 'pem'
      });

      return {
        signature: signature.toString('base64'),
        signerInfo,
        timestamp,
        algorithm: this.algorithm,
        documentHash,
        keyId: this.generateKeyId(this.getPublicKeyFromPrivate(privateKey))
      };
    } catch (error) {
      throw new Error(`Gagal membuat tanda tangan EdDSA: ${error.message}`);
    }
  }

  /**
   * Verifikasi tanda tangan tunggal
   * @param {Object} signatureData 
   * @param {string} publicKey 
   * @returns {boolean}
   */
  verifySignature(signatureData, publicKey) {
    try {
      const { signature, signerInfo, timestamp, documentHash } = signatureData;
      const dataToVerify = `${documentHash}|${signerInfo}|${timestamp}`;

      return crypto.verify(
        null,
        Buffer.from(dataToVerify),
        {
          key: publicKey,
          format: 'pem'
        },
        Buffer.from(signature, 'base64')
      );
    } catch (error) {
      console.error('Error verifikasi signature:', error);
      return false;
    }
  }

  /**
   * Extract public key dari private key
   * @param {string} privateKey 
   * @returns {string}
   */
  getPublicKeyFromPrivate(privateKey) {
    try {
      const keyObject = crypto.createPrivateKey(privateKey);
      const publicKeyObject = crypto.createPublicKey(keyObject);
      return publicKeyObject.export({
        type: 'spki',
        format: 'pem'
      });
    } catch (error) {
      throw new Error(`Gagal extract public key: ${error.message}`);
    }
  }
}

/**
 * Multi-Signature Manager
 * Mengelola tanda tangan dari multiple parties (dosen, kaprodi, dekan)
 */
class MultiSignatureManager {
  constructor() {
    this.crypto = new EdDSACrypto();
    this.requiredSigners = [
      { role: 'dosen_pembimbing', required: true },
      { role: 'ketua_prodi', required: true },
      { role: 'dekan', required: true }
    ];
  }

  /**
   * Inisialisasi key pairs untuk semua penandatangan
   * @returns {Object}
   */
  initializeSigners() {
    const signers = {};

    this.requiredSigners.forEach(signer => {
      const keyPair = this.crypto.generateKeyPair();
      signers[signer.role] = {
        ...keyPair,
        role: signer.role,
        required: signer.required,
        hasSigned: false
      };
    });

    return signers;
  }

  /**
   * Buat multi-signature untuk dokumen
   * @param {string} documentContent 
   * @param {Object} signers 
   * @param {Object} signerDetails 
   * @returns {Object}
   */
  createMultiSignature(documentContent, signers, signerDetails) {
    try {
      const documentHash = this.crypto.hashDocument(documentContent);
      const signatures = [];
      const timestamp = new Date().toISOString();

      // Buat signature untuk setiap signer yang diperlukan
      for (const [role, signer] of Object.entries(signers)) {
        if (signer.required && signerDetails[role]) {
          const signerInfo = `${role}:${signerDetails[role].nama}:${signerDetails[role].nip || 'N/A'}`;

          const signature = this.crypto.signDocument(
            documentHash,
            signer.privateKey,
            signerInfo
          );

          signatures.push({
            ...signature,
            role,
            signerName: signerDetails[role].nama,
            signerNip: signerDetails[role].nip,
            publicKey: signer.publicKey
          });

          signer.hasSigned = true;
        }
      }

      // Validasi apakah semua required signers sudah menandatangani
      const missingSigners = this.requiredSigners
        .filter(req => req.required && !signers[req.role]?.hasSigned)
        .map(req => req.role);

      if (missingSigners.length > 0) {
        throw new Error(`Missing required signatures from: ${missingSigners.join(', ')}`);
      }

      return {
        documentHash,
        signatures,
        timestamp,
        algorithm: 'EdDSA-MultiSig',
        signerCount: signatures.length,
        isComplete: missingSigners.length === 0
      };
    } catch (error) {
      throw new Error(`Gagal membuat multi-signature: ${error.message}`);
    }
  }

  /**
   * Verifikasi multi-signature
   * @param {Object} multiSignature 
   * @param {string} documentContent 
   * @returns {Object}
   */
  verifyMultiSignature(multiSignature, documentContent) {
    try {
      const { signatures, documentHash } = multiSignature;
      const currentDocHash = this.crypto.hashDocument(documentContent);

      // Verifikasi integritas dokumen
      if (documentHash !== currentDocHash) {
        return {
          isValid: false,
          error: 'Dokumen telah dimodifikasi setelah ditandatangani',
          verificationResults: []
        };
      }

      const verificationResults = [];
      let validSignatures = 0;

      // Verifikasi setiap signature
      signatures.forEach(sig => {
        const isValid = this.crypto.verifySignature(sig, sig.publicKey);
        verificationResults.push({
          role: sig.role,
          signerName: sig.signerName,
          isValid,
          timestamp: sig.timestamp,
          keyId: sig.keyId
        });

        if (isValid) validSignatures++;
      });

      return {
        isValid: validSignatures === signatures.length && validSignatures >= this.requiredSigners.filter(r => r.required).length,
        validSignatures,
        totalSignatures: signatures.length,
        verificationResults,
        documentHash: currentDocHash
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Error verifikasi multi-signature: ${error.message}`,
        verificationResults: []
      };
    }
  }

  /**
   * Generate data untuk QR Code
   * @param {Object} multiSignature 
   * @param {Object} documentMetadata 
   * @returns {Object}
   */
  generateQRData(multiSignature, documentMetadata) {
    const qrData = {
      version: '1.0',
      algorithm: 'EdDSA-MultiSig',
      documentId: documentMetadata.id || crypto.randomUUID(),
      documentType: documentMetadata.type,
      documentHash: multiSignature.documentHash,
      timestamp: multiSignature.timestamp,
      signers: multiSignature.signatures.map(sig => ({
        role: sig.role,
        name: sig.signerName,
        keyId: sig.keyId,
        timestamp: sig.timestamp
      })),
      verification_url: `${process.env.BASE_URL || 'http://localhost:8080'}/verify/${documentMetadata.id}`
    };

    return {
      qrData,
      qrString: JSON.stringify(qrData),
      compactString: Buffer.from(JSON.stringify(qrData)).toString('base64')
    };
  }
}

module.exports = {
  EdDSACrypto,
  MultiSignatureManager
};
