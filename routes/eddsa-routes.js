const express = require('express');
const router = express.Router();
const EdDSADocumentController = require('../controllers/eddsa-document-controller');

// Initialize controller
const eddsaController = new EdDSADocumentController();

// Document generation endpoints
router.post('/generate-document/:type/:prodi', eddsaController.generateSignedDocument);

// Verification endpoints
router.post('/verify-qr', eddsaController.verifyDocumentFromQR);
router.get('/verify/:documentId', eddsaController.verifyDocumentById);

// Signer management
router.post('/init-signers/:prodi', eddsaController.initializeSigners);

// Document management
router.get('/documents', eddsaController.getSignedDocuments);
router.get('/download/:documentId', eddsaController.downloadSignedDocument);

// Statistics and monitoring
router.get('/stats', eddsaController.getVerificationStats);

// Test endpoints for development
router.get('/test/crypto', async (req, res) => {
  try {
    const { EdDSACrypto } = require('../utils/eddsa-crypto');
    const crypto = new EdDSACrypto();

    // Test key generation
    const keyPair = crypto.generateKeyPair();

    // Test signing
    const testDoc = "Test document content";
    const docHash = crypto.hashDocument(testDoc);
    const signature = crypto.signDocument(docHash, keyPair.privateKey, "test:user");

    // Test verification
    const isValid = crypto.verifySignature(signature, keyPair.publicKey);

    res.json({
      success: true,
      test: 'EdDSA Crypto Test',
      keyGeneration: !!keyPair.publicKey,
      signing: !!signature.signature,
      verification: isValid,
      keyId: keyPair.keyId,
      algorithm: signature.algorithm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/test/multisig', async (req, res) => {
  try {
    const { MultiSignatureManager } = require('../utils/eddsa-crypto');
    const manager = new MultiSignatureManager();

    // Test multi-signature flow
    const signers = manager.initializeSigners();
    const testDoc = "Test document for multi-signature";

    const signerDetails = {
      dosen_pembimbing: { nama: "Dr. Test Pembimbing", nip: "123456" },
      ketua_prodi: { nama: "Dr. Test Kaprodi", nip: "654321" },
      dekan: { nama: "Prof. Test Dekan", nip: "111222" }
    };

    const multiSig = manager.createMultiSignature(testDoc, signers, signerDetails);
    const verification = manager.verifyMultiSignature(multiSig, testDoc);

    res.json({
      success: true,
      test: 'Multi-Signature Test',
      signersInitialized: Object.keys(signers).length,
      signaturesCreated: multiSig.signerCount,
      isComplete: multiSig.isComplete,
      verificationResult: verification.isValid,
      validSignatures: verification.validSignatures
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
