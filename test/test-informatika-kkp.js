const axios = require('axios');

// Test data sesuai format yang diinginkan untuk informatika KKP
const testData = {
  "kepada": "Tempat Tujuan KKP",
  "tempat_tujuan": "PT Maju Mundur",
  "nama_prodi": "Informatika",
  "nama_ttd": "Bapak Dekan Terhormat",
  "tableData": [
    {
      "nama_mahasiswa": "Muhammad Ikhsan Nur",
      "nim": "105841100820"
    },
    {
      "nama_mahasiswa": "Lis Indriani",
      "nim": "105841108020"
    },
    {
      "nama_mahasiswa": "Rizka Adrianingsih",
      "nim": "105841108520"
    }
  ]
};

async function testInformatikaKKP() {
  try {
    console.log('🧪 Testing Informatika KKP Document Generation...\n');

    // 1. Test Get Fields Configuration
    console.log('1️⃣ Testing Get Fields Configuration');
    try {
      const fieldsResponse = await axios.get('http://localhost:8080/api/document-config/fields/kkp?prodi=informatika');
      console.log('✅ Fields Configuration:', JSON.stringify(fieldsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error getting fields:', error.response?.data || error.message);
    }

    // 2. Test Document Generation
    console.log('\n2️⃣ Testing Document Generation');
    try {
      const generateResponse = await axios.post('http://localhost:8080/api/generate-document/kkp/informatika', testData);
      console.log('✅ Document Generated Successfully:', JSON.stringify(generateResponse.data, null, 2));

      if (generateResponse.data.success) {
        console.log(`📄 Document created: ${generateResponse.data.data.fileName}`);
        console.log(`📁 File path: ${generateResponse.data.data.filePath}`);
        console.log(`🔗 Download URL: ${generateResponse.data.data.downloadUrl}`);
      }
    } catch (error) {
      console.log('❌ Error generating document:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testInformatikaKKP();
