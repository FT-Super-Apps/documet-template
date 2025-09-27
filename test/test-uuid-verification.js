// Simple test to check if UUID verification works
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTestDocument() {
  try {
    console.log('🧪 Creating test document for verification...\n');

    const documentId = crypto.randomUUID();
    const testData = {
      kepada: 'PT. Test Company',
      tempat_tujuan: 'Jakarta',
      nama_prodi: 'Informatika',
      nama_ttd: 'Dr. Test',
      tableData: [
        { nama_mahasiswa: 'Test Student', nim: '2019001' }
      ]
    };

    const documentHash = crypto.createHash('sha256').update(JSON.stringify(testData)).digest('hex');

    const verificationData = {
      version: '1.0',
      algorithm: 'Basic-Document',
      document: {
        id: documentId,
        type: 'kkp',
        prodi: 'informatika',
        hash: documentHash,
        no_surat: '001/KKP/TEST/2024',
        timestamp: new Date().toISOString()
      },
      verification: {
        url: `${process.env.BASE_URL || 'http://localhost:8080'}/verify/${documentId}`,
        qr_generated: new Date().toISOString()
      }
    };

    // Save to database
    const savedDoc = await prisma.signed_documents.create({
      data: {
        id: documentId,
        document_type: 'kkp',
        prodi: 'informatika',
        document_content: JSON.stringify(testData),
        document_hash: documentHash,
        no_surat: '001/KKP/TEST/2024',
        qr_code_data: JSON.stringify(verificationData),
        total_signatures_required: 0,
        total_signatures_received: 0,
        is_complete: true
      }
    });

    console.log('✅ Test document created successfully!');
    console.log('Document ID:', documentId);
    console.log('No Surat:', savedDoc.no_surat);
    console.log('Verification URL:', verificationData.verification.url);
    console.log('');

    // Test retrieval
    const retrieved = await prisma.signed_documents.findUnique({
      where: { id: documentId }
    });

    if (retrieved) {
      console.log('✅ Document can be retrieved by UUID!');
      console.log('Retrieved ID:', retrieved.id);
      console.log('Retrieved Type:', retrieved.document_type);
    } else {
      console.log('❌ Document cannot be retrieved by UUID!');
    }

    console.log('\n🔗 Test this verification URL in browser:');
    console.log(`http://localhost:8080/verify/${documentId}`);
    console.log('\n🎉 Test completed!');

    return documentId;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  createTestDocument();
}

module.exports = { createTestDocument };
