// Test verification API endpoint directly
const fetch = require('node-fetch');

async function testVerificationAPI() {
  try {
    console.log('🧪 Testing verification API endpoint...\n');

    // Test with a known document ID (from previous test)
    const testDocumentId = '2ae7e939-ab0f-4b94-a0f1-4ac18fafde1d';
    const verificationUrl = `http://localhost:8080/verification/${testDocumentId}`;

    console.log(`📡 Testing API endpoint: ${verificationUrl}`);

    const response = await fetch(verificationUrl);
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Response:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testVerificationAPI();
}

module.exports = { testVerificationAPI };