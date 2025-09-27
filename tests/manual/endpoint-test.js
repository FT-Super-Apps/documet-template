// tests/manual/endpoint-test.js
/**
 * Manual Endpoint Testing Script
 * Run this script to test all endpoints manually
 * 
 * Usage: node tests/manual/endpoint-test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

class EndpointTester {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async testEndpoint(method, endpoint, data = null, description = '') {
    console.log(`\n🔍 Testing ${method.toUpperCase()} ${endpoint}`);
    console.log(`📝 ${description}`);

    try {
      const config = {
        method: method.toLowerCase(),
        url: `${this.baseUrl}${endpoint}`,
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status code
      };

      if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
        config.data = data;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = await axios(config);

      const result = {
        endpoint,
        method,
        status: response.status,
        success: response.status < 400,
        data: response.data,
        description
      };

      this.results.push(result);

      if (response.status < 400) {
        console.log(`✅ SUCCESS: ${response.status}`);
        if (response.data && typeof response.data === 'object') {
          console.log(`📊 Response:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        }
      } else {
        console.log(`❌ ERROR: ${response.status}`);
        console.log(`📊 Error:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }

    } catch (error) {
      console.log(`💥 EXCEPTION: ${error.message}`);
      this.results.push({
        endpoint,
        method,
        status: 'ERROR',
        success: false,
        error: error.message,
        description
      });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive endpoint testing...');
    console.log(`🎯 Base URL: ${this.baseUrl}`);

    // Health Check Endpoints
    console.log('\n' + '='.repeat(50));
    console.log('🏥 HEALTH CHECK ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/', null, 'Root health check');
    await this.testEndpoint('GET', '/api/', null, 'API root health check');
    await this.testEndpoint('GET', '/api/health', null, 'Detailed health check');

    // Admin Management Endpoints
    console.log('\n' + '='.repeat(50));
    console.log('🔧 SIGNATURE CONFIGURATION ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/signature-configs', null, 'Get all signature configurations');
    await this.testEndpoint('GET', '/api/signature-configs?active_only=true', null, 'Get active signature configurations');
    await this.testEndpoint('GET', '/api/signature-configs/kkp', null, 'Get specific signature config');

    const testSignatureConfig = {
      document_type: 'test_manual',
      required_signature_count: 2,
      required_roles: ['dosen_pembimbing', 'ketua_prodi'],
      description: 'Manual test configuration'
    };

    await this.testEndpoint('POST', '/api/signature-configs', testSignatureConfig, 'Create signature config');
    await this.testEndpoint('PUT', '/api/signature-configs/test_manual',
      { description: 'Updated manual test configuration' }, 'Update signature config');

    console.log('\n' + '='.repeat(50));
    console.log('👥 SIGNERS MANAGEMENT ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/signers', null, 'Get all signers');
    await this.testEndpoint('GET', '/api/signers/1', null, 'Get specific signer');

    const testSigner = {
      name: 'Manual Test Signer',
      nip: '123456789012345678',
      role: 'dosen_pembimbing',
      department: 'Test Department',
      prodi: 'informatika'
    };

    await this.testEndpoint('POST', '/api/signers', testSigner, 'Create new signer');

    console.log('\n' + '='.repeat(50));
    console.log('📄 DOCUMENT CONFIGURATION ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/document-configs', null, 'Get all document configurations');
    await this.testEndpoint('GET', '/api/document-configs/1', null, 'Get specific document config');

    const testDocConfig = {
      type: 'test_manual',
      prodi: 'informatika',
      template_path: 'templates/informatika/kkp.docx',
      description: 'Manual test document configuration'
    };

    await this.testEndpoint('POST', '/api/document-configs', testDocConfig, 'Create document config');

    console.log('\n' + '='.repeat(50));
    console.log('🏷️ DOCUMENT FIELDS ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/document-configs/1/fields', null, 'Get document fields');

    const testField = {
      field_name: 'test_field',
      field_type: 'text',
      is_required: true,
      default_value: 'Test default value'
    };

    await this.testEndpoint('POST', '/api/document-configs/1/fields', testField, 'Create document field');

    // Document Generation Endpoints
    console.log('\n' + '='.repeat(50));
    console.log('📝 DOCUMENT GENERATION ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/documents', null, 'Get all signed documents');
    await this.testEndpoint('GET', '/api/stats', null, 'Get verification statistics');

    const testDocumentData = {
      nama_mahasiswa: 'Manual Test Student',
      nim: '123456789',
      judul_kkp: 'Manual Testing Document Generation',
      nama_perusahaan: 'Test Company',
      periode_kkp: 'Juli - Agustus 2024'
    };

    await this.testEndpoint('POST', '/api/generate-document/kkp/informatika', testDocumentData, 'Generate document');
    await this.testEndpoint('POST', '/api/init-signers/informatika', {}, 'Initialize signers');

    // Verification Endpoints
    console.log('\n' + '='.repeat(50));
    console.log('✅ VERIFICATION ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('POST', '/api/verify-qr', { qrData: 'test-qr-data' }, 'Verify QR code');
    await this.testEndpoint('GET', '/api/verification/test-document-id', null, 'Verify document by ID');
    await this.testEndpoint('GET', '/api/verify/test-document-id', null, 'Verification page redirect');
    await this.testEndpoint('GET', '/api/v/test-document-id', null, 'Short verification URL');

    // Download Endpoints
    console.log('\n' + '='.repeat(50));
    console.log('📥 DOWNLOAD ENDPOINTS');
    console.log('='.repeat(50));

    await this.testEndpoint('GET', '/api/documents/test-document-id/download', null, 'Download signed document');

    // Cleanup test data
    console.log('\n' + '='.repeat(50));
    console.log('🧹 CLEANUP TEST DATA');
    console.log('='.repeat(50));

    await this.testEndpoint('DELETE', '/api/signature-configs/test_manual', null, 'Delete test signature config');

    // Generate Report
    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(70));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`📝 Total Endpoints Tested: ${totalTests}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\n' + '-'.repeat(70));
    console.log('❌ FAILED TESTS DETAILS:');
    console.log('-'.repeat(70));

    this.results
      .filter(r => !r.success)
      .forEach(result => {
        console.log(`\n🔴 ${result.method.toUpperCase()} ${result.endpoint}`);
        console.log(`   📝 ${result.description}`);
        console.log(`   💥 Status: ${result.status}`);
        if (result.error) {
          console.log(`   🔍 Error: ${result.error}`);
        } else if (result.data && typeof result.data === 'object') {
          console.log(`   🔍 Response: ${JSON.stringify(result.data, null, 2).substring(0, 100)}...`);
        }
      });

    console.log('\n' + '-'.repeat(70));
    console.log('✅ SUCCESSFUL TESTS:');
    console.log('-'.repeat(70));

    this.results
      .filter(r => r.success)
      .forEach(result => {
        console.log(`✅ ${result.method.toUpperCase()} ${result.endpoint} - ${result.description}`);
      });

    console.log('\n' + '='.repeat(70));
    console.log('🎯 RECOMMENDATIONS:');
    console.log('='.repeat(70));

    if (failedTests > 0) {
      console.log('1. Check database connection and ensure DATABASE_URL is set');
      console.log('2. Run database migrations: npm run prisma:migrate');
      console.log('3. Seed initial data: npm run seed:eddsa');
      console.log('4. Ensure all dependencies are installed: npm install');
      console.log('5. Check if server is running on correct port');
      console.log('6. Verify .env file contains all required variables');
    } else {
      console.log('🎉 All tests passed! Your API endpoints are working correctly.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new EndpointTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EndpointTester;
