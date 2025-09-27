// Test QR Code Enhancement
const { generateQRCodeWithSignature, parseQRData } = require('../utils/generate-qrcode-enhanced');
const crypto = require('crypto');
const fs = require('fs');

async function testQRCodeGeneration() {
  try {
    console.log('🧪 Testing Enhanced QR Code Generation...\n');

    // Simulate document data
    const documentId = crypto.randomUUID();
    const documentHash = crypto.createHash('sha256').update('test document content').digest('hex');

    const verificationData = {
      version: '1.0',
      algorithm: 'Basic-Document',
      document: {
        id: documentId,
        type: 'kkp',
        prodi: 'informatika',
        hash: documentHash,
        no_surat: '001/KKP/2024',
        timestamp: new Date().toISOString()
      },
      verification: {
        url: `${process.env.BASE_URL || 'http://localhost:8080'}/verify/${documentId}`,
        qr_generated: new Date().toISOString()
      }
    };

    console.log('1️⃣ Generated verification data:');
    console.log(JSON.stringify(verificationData, null, 2));
    console.log('');

    // Generate QR Code
    console.log('2️⃣ Generating QR Code...');
    const qrString = JSON.stringify(verificationData);
    const qrCodePath = await generateQRCodeWithSignature(qrString, {
      width: 300,
      margin: 3,
      errorCorrectionLevel: 'H'
    });

    console.log('✅ QR Code generated successfully!');
    console.log('QR Code saved to:', qrCodePath);
    console.log('QR Data size:', qrString.length, 'characters');
    console.log('');

    // Test parsing
    console.log('3️⃣ Testing QR Data parsing...');
    const parseResult = parseQRData(qrString);
    console.log('Parse result:', JSON.stringify(parseResult, null, 2));

    if (parseResult.isValid) {
      console.log('✅ QR Code parsing successful!');
      console.log('Document ID:', parseResult.data.document.id);
      console.log('Verification URL:', parseResult.data.verification.url);
    } else {
      console.log('❌ QR Code parsing failed:', parseResult.error);
    }

    // Verify file exists
    if (fs.existsSync(qrCodePath)) {
      const stats = fs.statSync(qrCodePath);
      console.log('✅ QR Code file exists, size:', stats.size, 'bytes');
    } else {
      console.log('❌ QR Code file not found!');
    }

    console.log('\n🎉 QR Code test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testQRCodeGeneration();
}

module.exports = { testQRCodeGeneration };
