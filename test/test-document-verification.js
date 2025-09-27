// Test Document Generation and Verification
const generateDocument = require('../utils/generate-document');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDocumentVerification() {
  try {
    console.log('🧪 Testing Document Generation and Verification...\n');

    // Test document generation
    const testData = {
      kepada: 'PT. Test Company',
      tempat_tujuan: 'Jakarta',
      nama_prodi: 'Informatika',
      nama_ttd: 'Dr. Test',
      tableData: [
        { nama_mahasiswa: 'Test Student', nim: '2019001' }
      ]
    };

    console.log('1️⃣ Generating test document...');
    const result = await generateDocument('kkp', 'informatika', testData);

    console.log('✅ Document generated successfully!');
    console.log('Document ID:', result.documentId);
    console.log('File name:', result.fileName);
    console.log('Download URL:', result.downloadUrl);
    console.log('');

    if (result.documentId) {
      // Verify the document exists in database
      console.log('2️⃣ Checking document in database...');
      const savedDoc = await prisma.signed_documents.findUnique({
        where: { id: result.documentId }
      });

      if (savedDoc) {
        console.log('✅ Document found in database!');
        console.log('Document Type:', savedDoc.document_type);
        console.log('Prodi:', savedDoc.prodi);
        console.log('No Surat:', savedDoc.no_surat);
        console.log('QR Code Data length:', savedDoc.qr_code_data.length);

        // Parse QR code data
        try {
          const qrData = JSON.parse(savedDoc.qr_code_data);
          console.log('✅ QR Code data parsed successfully!');
          console.log('QR Document ID:', qrData.document.id);
          console.log('Verification URL:', qrData.verification.url);
        } catch (error) {
          console.log('❌ Failed to parse QR Code data:', error.message);
        }
      } else {
        console.log('❌ Document not found in database!');
      }
    } else {
      console.log('❌ No document ID returned!');
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testDocumentVerification();
}

module.exports = { testDocumentVerification };
