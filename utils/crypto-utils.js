const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CryptoUtils {
  constructor() {
    this.algorithm = 'sha256';
    this.signatureAlgorithm = 'ed25519';
  }

  // Generate Ed25519 key pair for digital signature (more secure and faster than RSA)
  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  // Generate unique signer ID with enhanced entropy
  generateSignerId(nama_ttd, nip_nidn) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const data = `${nama_ttd}-${nip_nidn}-${timestamp}-${randomBytes}`;
    return crypto.createHash(this.algorithm).update(data).digest('hex').substring(0, 20);
  }

  // Create digital signature using Ed25519 (more secure than RSA+SHA256)
  createSignature(data, privateKey) {
    try {
      const dataString = JSON.stringify(data, Object.keys(data).sort()); // Deterministic serialization
      const dataBuffer = Buffer.from(dataString, 'utf8');

      // Ed25519 doesn't need separate hashing, it's built into the algorithm
      return crypto.sign(null, dataBuffer, privateKey).toString('hex');
    } catch (error) {
      throw new Error(`Signature creation failed: ${error.message}`);
    }
  }

  // Verify digital signature using Ed25519
  verifySignature(data, signature, publicKey) {
    try {
      const dataString = JSON.stringify(data, Object.keys(data).sort()); // Same deterministic serialization
      const dataBuffer = Buffer.from(dataString, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'hex');

      return crypto.verify(null, dataBuffer, publicKey, signatureBuffer);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Generate secure token for localStorage with enhanced security
  generateSecureToken(signerId) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(32).toString('hex'); // Increased entropy
    const data = `${signerId}-${timestamp}-${randomBytes}`;
    return crypto.createHash('sha512').update(data).digest('hex').substring(0, 64); // Use SHA-512 for tokens
  }

  // Hash sensitive data with salt
  hashData(data, salt = null) {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');
    return salt ? hash : `${actualSalt}:${hash}`; // Return salt:hash if no salt provided
  }

  // Verify hashed data
  verifyHashedData(data, hashedData) {
    try {
      const [salt, hash] = hashedData.split(':');
      const computedHash = this.hashData(data, salt);
      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }

  // Generate secure random string
  generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Create document fingerprint for integrity check
  createDocumentFingerprint(documentData) {
    const dataString = JSON.stringify(documentData, Object.keys(documentData).sort());
    return crypto.createHash('sha512').update(dataString).digest('hex');
  }

  // Key derivation function for additional security
  deriveKey(password, salt = null, iterations = 100000) {
    const actualSalt = salt || crypto.randomBytes(32);
    const derivedKey = crypto.pbkdf2Sync(password, actualSalt, iterations, 32, 'sha512');
    return {
      key: derivedKey.toString('hex'),
      salt: actualSalt.toString('hex'),
      iterations
    };
  }
}

module.exports = new CryptoUtils();