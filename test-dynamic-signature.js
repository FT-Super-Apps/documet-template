// test-dynamic-signature.js
const axios = require('axios');

async function testDynamicSignature() {
  const baseUrl = 'http://localhost:8080';

  try {
    console.log('🧪 Testing Dynamic Signature System');
    console.log('=====================================\n');

    // Test data for different document types
    const testCases = [
      {
        name: 'KKP Document (1 signature required)',
        type: 'kkp',
        prodi: 'informatika',
        data: {
          kepada: 'PT. Testing Indonesia',
          tempat_tujuan: 'Jakarta',
          nama_prodi: 'Teknik Informatika',
          tanggal_hijriyah: '15 Rajab 1446 H',
          tanggal_masehi: '15 Januari 2025',
          tableData: [{
            nama: 'John Doe KKP',
            nim: '12345678',
            semester: '7'
          }]
        }
      },
      {
        name: 'Bimbingan Document (2 signatures required)',
        type: 'bimbingan',
        prodi: 'informatika',
        data: {
          kepada: 'Dosen Pembimbing',
          tempat_tujuan: 'Kampus UNSIKA',
          nama_prodi: 'Teknik Informatika',
          tanggal_hijriyah: '15 Rajab 1446 H',
          tanggal_masehi: '15 Januari 2025',
          tableData: [{
            nama: 'Jane Doe Bimbingan',
            nim: '87654321',
            semester: '6'
          }]
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📝 Testing: ${testCase.name}`);
      console.log(`Document Type: ${testCase.type}`);
      console.log(`Prodi: ${testCase.prodi}`);

      try {
        const response = await axios.post(
          `${baseUrl}/api/eddsa-document/${testCase.prodi}/${testCase.type}`,
          testCase.data,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );

        if (response.data.success) {
          console.log('✅ Success:', response.data.message);
          console.log(`📄 Document ID: ${response.data.data.documentId}`);
          console.log(`🔐 Signatures: ${response.data.data.totalSignatures}/${response.data.data.requiredSignatures}`);
          console.log(`📋 File: ${response.data.data.filePath}`);

          // Test verification
          const verificationResponse = await axios.get(
            `${baseUrl}/api/eddsa-document/verify/${response.data.data.documentId}`,
            { timeout: 10000 }
          );

          if (verificationResponse.data.success) {
            console.log('✅ Verification successful');
            console.log(`🔍 Valid signatures: ${verificationResponse.data.data.validSignatures}/${verificationResponse.data.data.totalSignatures}`);
            console.log(`📝 Document Type: ${verificationResponse.data.data.documentType}`);
            console.log(`🔐 Required Roles: ${verificationResponse.data.data.requiredRoles?.join(', ')}`);
            console.log(`✔️ Missing Roles: ${verificationResponse.data.data.missingRoles?.join(', ') || 'None'}`);
            console.log(`🎯 Overall Valid: ${verificationResponse.data.data.isValid ? 'YES' : 'NO'}`);
          }
        } else {
          console.log('❌ Failed:', response.data.error);
        }

      } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        if (error.response?.data) {
          console.log('📄 Full error response:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.code === 'ECONNREFUSED') {
          console.log('🔌 Connection refused - server might not be running');
        }
      }

      console.log('\n' + '─'.repeat(50));
    }

    // Test invalid document type
    console.log('\n🚫 Testing Invalid Document Type');
    try {
      await axios.post(
        `${baseUrl}/api/eddsa-document/informatika/invalid-type`,
        testCases[0].data,
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Expected error for invalid document type:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.message);
        if (error.response?.data) {
          console.log('📄 Full error response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testDynamicSignature();
}

module.exports = { testDynamicSignature };
