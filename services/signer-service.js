const fs = require('fs');
const path = require('path');
const cryptoUtils = require('../utils/crypto-utils');

class SignerService {
  constructor() {
    this.dbPath = path.join(__dirname, '../db.json');
  }

  loadDatabase() {
    try {
      const rawData = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      throw new Error(`Failed to load database: ${error.message}`);
    }
  }

  saveDatabase(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      throw new Error(`Failed to save database: ${error.message}`);
    }
  }

  // Register new signer with EdDSA key generation
  async registerSigner(nama_ttd, nip_nidn) {
    try {
      const db = this.loadDatabase();

      // Create secure hash for lookup (using new hashing method)
      const nipNidnHash = cryptoUtils.hashData(nip_nidn);

      // Check if signer already exists by comparing hashes
      const existingSigner = db.authorized_signers.find(signer => {
        // For backward compatibility, check both old and new hash formats
        if (signer.nip_nidn_hash && signer.nip_nidn_hash.includes(':')) {
          return cryptoUtils.verifyHashedData(nip_nidn, signer.nip_nidn_hash);
        } else {
          // Legacy simple hash check
          return signer.nip_nidn_hash === cryptoUtils.hashData(nip_nidn, 'legacy');
        }
      });

      if (existingSigner) {
        // Generate new secure token for existing signer
        const token = cryptoUtils.generateSecureToken(existingSigner.signer_id);

        return {
          exists: true,
          signer_id: existingSigner.signer_id,
          public_key: existingSigner.public_key,
          token: token,
          algorithm: 'Ed25519',
          message: 'Penandatangan sudah terdaftar'
        };
      }

      // Generate new Ed25519 key pair
      const { publicKey, privateKey } = cryptoUtils.generateKeyPair();
      const signerId = cryptoUtils.generateSignerId(nama_ttd, nip_nidn);

      // Create document fingerprint for integrity
      const signerData = { nama_ttd, nip_nidn, timestamp: new Date().toISOString() };
      const fingerprint = cryptoUtils.createDocumentFingerprint(signerData);

      const newSigner = {
        signer_id: signerId,
        nama_ttd: nama_ttd,
        nip_nidn_hash: nipNidnHash, // Secure salted hash
        public_key: publicKey,
        private_key: privateKey, // In production, encrypt this with master key
        algorithm: 'Ed25519',
        key_fingerprint: fingerprint,
        created_at: new Date().toISOString(),
        status: 'active',
        last_used: null,
        usage_count: 0
      };

      db.authorized_signers.push(newSigner);
      this.saveDatabase(db);

      // Generate secure token for localStorage
      const token = cryptoUtils.generateSecureToken(signerId);

      return {
        exists: false,
        signer_id: signerId,
        public_key: publicKey,
        token: token,
        algorithm: 'Ed25519',
        fingerprint: fingerprint,
        message: 'Penandatangan berhasil didaftarkan dengan EdDSA'
      };

    } catch (error) {
      throw new Error(`Failed to register signer: ${error.message}`);
    }
  }

  // Verify signer authorization
  verifySigner(signerId, token) {
    try {
      const db = this.loadDatabase();
      const signer = db.authorized_signers.find(s => s.signer_id === signerId);

      if (!signer) {
        return { valid: false, message: 'Penandatangan tidak ditemukan' };
      }

      if (signer.status !== 'active') {
        return { valid: false, message: 'Penandatangan tidak aktif' };
      }

      // In production, you should also verify the token properly
      return {
        valid: true,
        signer: {
          signer_id: signer.signer_id,
          nama_ttd: signer.nama_ttd,
          public_key: signer.public_key
        }
      };

    } catch (error) {
      return { valid: false, message: 'Error verifying signer' };
    }
  }

  // Get signer by NIP/NIDN with enhanced security
  getSignerByNipNidn(nip_nidn) {
    try {
      const db = this.loadDatabase();

      // Find signer using secure hash verification
      const signer = db.authorized_signers.find(s => {
        if (s.nip_nidn_hash && s.nip_nidn_hash.includes(':')) {
          return cryptoUtils.verifyHashedData(nip_nidn, s.nip_nidn_hash);
        } else {
          // Legacy compatibility
          return s.nip_nidn_hash === cryptoUtils.hashData(nip_nidn, 'legacy');
        }
      });

      if (!signer) {
        return { found: false };
      }

      return {
        found: true,
        signer: {
          signer_id: signer.signer_id,
          nama_ttd: signer.nama_ttd,
          public_key: signer.public_key,
          algorithm: signer.algorithm || 'Ed25519',
          status: signer.status,
          created_at: signer.created_at,
          usage_count: signer.usage_count || 0
        }
      };

    } catch (error) {
      return { found: false, error: error.message };
    }
  }

  // Create digital signature for document using EdDSA
  signDocument(documentData, signerId) {
    try {
      const db = this.loadDatabase();
      const signer = db.authorized_signers.find(s => s.signer_id === signerId);

      if (!signer) {
        throw new Error('Signer not found');
      }

      if (signer.status !== 'active') {
        throw new Error('Signer is not active');
      }

      // Create document fingerprint for integrity
      const documentFingerprint = cryptoUtils.createDocumentFingerprint(documentData);

      // Create signature using EdDSA
      const signature = cryptoUtils.createSignature(documentData, signer.private_key);

      // Update signer usage statistics
      signer.last_used = new Date().toISOString();
      signer.usage_count = (signer.usage_count || 0) + 1;
      this.saveDatabase(db);

      return {
        signature: signature,
        signer_id: signerId,
        algorithm: signer.algorithm || 'Ed25519',
        document_fingerprint: documentFingerprint,
        key_fingerprint: signer.key_fingerprint,
        signed_at: new Date().toISOString(),
        usage_count: signer.usage_count
      };

    } catch (error) {
      throw new Error(`Failed to sign document: ${error.message}`);
    }
  }

  // Verify document signature using EdDSA
  verifyDocumentSignature(documentData, signatureInfo, signerId) {
    try {
      const db = this.loadDatabase();
      const signer = db.authorized_signers.find(s => s.signer_id === signerId);

      if (!signer) {
        return {
          valid: false,
          message: 'Signer not found',
          algorithm: 'unknown'
        };
      }

      // Verify signature
      const signature = signatureInfo.signature || signatureInfo;
      const isValid = cryptoUtils.verifySignature(documentData, signature, signer.public_key);

      // Verify document fingerprint if available
      let fingerprintValid = true;
      if (signatureInfo.document_fingerprint) {
        const currentFingerprint = cryptoUtils.createDocumentFingerprint(documentData);
        fingerprintValid = currentFingerprint === signatureInfo.document_fingerprint;
      }

      return {
        valid: isValid && fingerprintValid,
        signer_name: signer.nama_ttd,
        algorithm: signer.algorithm || 'Ed25519',
        key_fingerprint: signer.key_fingerprint,
        document_integrity: fingerprintValid,
        signature_integrity: isValid,
        verified_at: new Date().toISOString(),
        signer_created: signer.created_at,
        signer_usage_count: signer.usage_count || 0
      };

    } catch (error) {
      return {
        valid: false,
        message: error.message,
        algorithm: 'unknown'
      };
    }
  }

  // Additional security methods

  // Revoke signer (for security purposes)
  revokeSigner(signerId, reason = 'Manual revocation') {
    try {
      const db = this.loadDatabase();
      const signer = db.authorized_signers.find(s => s.signer_id === signerId);

      if (!signer) {
        throw new Error('Signer not found');
      }

      signer.status = 'revoked';
      signer.revoked_at = new Date().toISOString();
      signer.revocation_reason = reason;

      this.saveDatabase(db);

      return {
        success: true,
        message: `Signer ${signerId} has been revoked`,
        revoked_at: signer.revoked_at
      };

    } catch (error) {
      throw new Error(`Failed to revoke signer: ${error.message}`);
    }
  }

  // Get signing statistics
  getSigningStats() {
    try {
      const db = this.loadDatabase();
      const signers = db.authorized_signers || [];

      const stats = {
        total_signers: signers.length,
        active_signers: signers.filter(s => s.status === 'active').length,
        revoked_signers: signers.filter(s => s.status === 'revoked').length,
        total_signatures: signers.reduce((sum, s) => sum + (s.usage_count || 0), 0),
        algorithms: {
          'Ed25519': signers.filter(s => s.algorithm === 'Ed25519').length,
          'RSA': signers.filter(s => !s.algorithm || s.algorithm === 'RSA').length
        },
        last_activity: signers
          .filter(s => s.last_used)
          .sort((a, b) => new Date(b.last_used) - new Date(a.last_used))[0]?.last_used
      };

      return stats;

    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }
}

module.exports = new SignerService();