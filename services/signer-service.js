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

  // Generate unique keypair for each document signature
  async generateDocumentSignature(nama_ttd, documentId) {
    try {
      // Generate new Ed25519 key pair for THIS document only
      const { publicKey, privateKey } = cryptoUtils.generateKeyPair();

      // Create signature from signer name only
      const signatureData = { nama_ttd };
      const signature = cryptoUtils.createSignature(signatureData, privateKey);

      // Create document fingerprint for integrity
      const signerData = { nama_ttd, documentId, timestamp: new Date().toISOString() };
      const fingerprint = cryptoUtils.createDocumentFingerprint(signerData);

      return {
        signature,
        public_key: publicKey,
        private_key: privateKey,
        algorithm: 'Ed25519',
        fingerprint,
        signed_at: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to generate signature: ${error.message}`);
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

  // Verify document signature using public key from document
  verifyDocumentWithPublicKey(nama_ttd, signature, publicKey) {
    try {
      // Verify signature with signer name only
      const signatureData = { nama_ttd };
      const isValid = cryptoUtils.verifySignature(signatureData, signature, publicKey);

      return {
        valid: isValid,
        algorithm: 'Ed25519',
        verified_at: new Date().toISOString()
      };

    } catch (error) {
      return {
        valid: false,
        message: error.message,
        algorithm: 'Ed25519'
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