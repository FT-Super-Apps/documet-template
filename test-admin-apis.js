// test-admin-apis.js
const axios = require('axios');

class AdminAPITester {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.adminUrl = `${baseUrl}/api/admin`;
  }

  async runAllTests() {
    console.log('🧪 Testing Admin API Endpoints');
    console.log('==============================\n');

    try {
      await this.testDashboardOverview();
      await this.testSignatureConfigAPIs();
      await this.testSignersAPIs();
      await this.testDocumentsAPIs();

      console.log('\n✅ All Admin API tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Admin API tests failed:', error.message);
    }
  }

  async testDashboardOverview() {
    console.log('📊 Testing Dashboard Overview');
    console.log('----------------------------');

    try {
      const response = await axios.get(`${this.adminUrl}/dashboard`);

      if (response.data.success) {
        console.log('✅ Dashboard overview retrieved successfully');
        console.log(`📊 Overview data:`, {
          signature_configs: response.data.data.overview.signature_configs,
          active_signers: response.data.data.overview.active_signers,
          document_types: response.data.data.overview.document_types,
          signed_documents: response.data.data.overview.signed_documents
        });
        console.log(`📈 Recent verifications: ${response.data.data.recent_verifications.length}`);
      } else {
        console.log('❌ Failed to get dashboard overview:', response.data.error);
      }
    } catch (error) {
      console.log('❌ Dashboard overview error:', error.response?.data?.error || error.message);
    }

    console.log('');
  }

  async testSignatureConfigAPIs() {
    console.log('🔐 Testing Signature Configuration APIs');
    console.log('---------------------------------------');

    let createdConfigType = null;

    try {
      // 1. Get all signature configs
      console.log('📋 Getting all signature configurations...');
      const getAllResponse = await axios.get(`${this.adminUrl}/signature-configs`);
      if (getAllResponse.data.success) {
        console.log(`✅ Found ${getAllResponse.data.data.length} signature configurations`);
        getAllResponse.data.data.forEach(config => {
          console.log(`   - ${config.document_type}: ${config.required_signature_count} signatures from [${config.required_roles.join(', ')}]`);
        });
      }

      // 2. Create new signature config
      console.log('\n➕ Creating new signature configuration...');
      const newConfig = {
        document_type: 'test_skripsi',
        required_signature_count: 5,
        required_roles: ['dosen_pembimbing', 'ketua_prodi', 'dekan', 'penguji_1', 'penguji_2'],
        description: 'Test skripsi document with 5 required signatures'
      };

      const createResponse = await axios.post(`${this.adminUrl}/signature-configs`, newConfig);
      if (createResponse.data.success) {
        console.log('✅ Signature configuration created successfully');
        console.log(`   Type: ${createResponse.data.data.document_type}`);
        console.log(`   Required: ${createResponse.data.data.required_signature_count} signatures`);
        createdConfigType = createResponse.data.data.document_type;
      }

      // 3. Get specific signature config
      if (createdConfigType) {
        console.log(`\n🔍 Getting signature configuration for '${createdConfigType}'...`);
        const getOneResponse = await axios.get(`${this.adminUrl}/signature-configs/${createdConfigType}`);
        if (getOneResponse.data.success) {
          console.log('✅ Signature configuration retrieved successfully');
          console.log(`   Description: ${getOneResponse.data.data.description}`);
        }
      }

      // 4. Update signature config
      if (createdConfigType) {
        console.log(`\n📝 Updating signature configuration for '${createdConfigType}'...`);
        const updateResponse = await axios.put(`${this.adminUrl}/signature-configs/${createdConfigType}`, {
          description: 'Updated test skripsi document configuration',
          required_signature_count: 6
        });
        if (updateResponse.data.success) {
          console.log('✅ Signature configuration updated successfully');
          console.log(`   New count: ${updateResponse.data.data.required_signature_count}`);
        }
      }

      // 5. Delete signature config
      if (createdConfigType) {
        console.log(`\n🗑️  Deleting signature configuration for '${createdConfigType}'...`);
        const deleteResponse = await axios.delete(`${this.adminUrl}/signature-configs/${createdConfigType}?hard_delete=true`);
        if (deleteResponse.data.success) {
          console.log('✅ Signature configuration deleted successfully');
        }
      }

    } catch (error) {
      console.log('❌ Signature config API error:', error.response?.data?.error || error.message);
    }

    console.log('');
  }

  async testSignersAPIs() {
    console.log('👥 Testing Signers APIs');
    console.log('-----------------------');

    let createdSignerId = null;

    try {
      // 1. Get all signers
      console.log('📋 Getting all signers...');
      const getAllResponse = await axios.get(`${this.adminUrl}/signers?active_only=true`);
      if (getAllResponse.data.success) {
        console.log(`✅ Found ${getAllResponse.data.data.length} active signers`);
        getAllResponse.data.data.slice(0, 3).forEach(signer => {
          console.log(`   - ${signer.name} (${signer.role}) - ${signer.prodi}`);
        });
      }

      // 2. Create new signer
      console.log('\n➕ Creating new signer...');
      const newSigner = {
        name: 'Dr. Test Signer',
        nip: 'TEST123456789',
        role: 'dosen_pembimbing',
        department: 'Teknik Informatika',
        prodi: 'informatika'
      };

      const createResponse = await axios.post(`${this.adminUrl}/signers`, newSigner);
      if (createResponse.data.success) {
        console.log('✅ Signer created successfully with auto-generated keys');
        console.log(`   ID: ${createResponse.data.data.id}`);
        console.log(`   Name: ${createResponse.data.data.name}`);
        console.log(`   Key ID: ${createResponse.data.data.key_id}`);
        createdSignerId = createResponse.data.data.id;
      }

      // 3. Get specific signer
      if (createdSignerId) {
        console.log(`\n🔍 Getting signer with ID ${createdSignerId}...`);
        const getOneResponse = await axios.get(`${this.adminUrl}/signers/${createdSignerId}`);
        if (getOneResponse.data.success) {
          console.log('✅ Signer retrieved successfully');
          console.log(`   NIP: ${getOneResponse.data.data.nip}`);
          console.log(`   Has Public Key: ${!!getOneResponse.data.data.public_key}`);
        }
      }

      // 4. Update signer
      if (createdSignerId) {
        console.log(`\n📝 Updating signer ${createdSignerId}...`);
        const updateResponse = await axios.put(`${this.adminUrl}/signers/${createdSignerId}`, {
          name: 'Dr. Updated Test Signer',
          department: 'Updated Department'
        });
        if (updateResponse.data.success) {
          console.log('✅ Signer updated successfully');
          console.log(`   New name: ${updateResponse.data.data.name}`);
        }
      }

      // 5. Regenerate keys
      if (createdSignerId) {
        console.log(`\n🔑 Regenerating keys for signer ${createdSignerId}...`);
        const regenResponse = await axios.put(`${this.adminUrl}/signers/${createdSignerId}`, {
          regenerate_keys: true
        });
        if (regenResponse.data.success) {
          console.log('✅ Keys regenerated successfully');
          console.log(`   New Key ID: ${regenResponse.data.data.key_id}`);
        }
      }

      // 6. Delete signer
      if (createdSignerId) {
        console.log(`\n🗑️  Deleting signer ${createdSignerId}...`);
        const deleteResponse = await axios.delete(`${this.adminUrl}/signers/${createdSignerId}?hard_delete=true`);
        if (deleteResponse.data.success) {
          console.log('✅ Signer deleted successfully');
        }
      }

    } catch (error) {
      console.log('❌ Signers API error:', error.response?.data?.error || error.message);
    }

    console.log('');
  }

  async testDocumentsAPIs() {
    console.log('📄 Testing Documents APIs');
    console.log('-------------------------');

    let createdDocumentId = null;

    try {
      // 1. Get all documents
      console.log('📋 Getting all document configurations...');
      const getAllResponse = await axios.get(`${this.adminUrl}/documents`);
      if (getAllResponse.data.success) {
        console.log(`✅ Found ${getAllResponse.data.data.length} document configurations`);
        getAllResponse.data.data.slice(0, 3).forEach(doc => {
          console.log(`   - ${doc.type} (${doc.prodi}) - Fields: ${doc.document_fields?.length || 0}`);
        });
      }

      // 2. Create new document configuration
      console.log('\n➕ Creating new document configuration...');
      const newDocument = {
        type: 'test_thesis',
        prodi: 'informatika',
        template_path: 'templates/test/thesis.docx',
        description: 'Test thesis document configuration',
        fields: [
          {
            field_name: 'student_name',
            field_type: 'text',
            is_required: true
          },
          {
            field_name: 'thesis_title',
            field_type: 'text',
            is_required: true
          },
          {
            field_name: 'defense_date',
            field_type: 'date',
            is_required: true
          }
        ]
      };

      const createResponse = await axios.post(`${this.adminUrl}/documents`, newDocument);
      if (createResponse.data.success) {
        console.log('✅ Document configuration created successfully');
        console.log(`   ID: ${createResponse.data.data.id}`);
        console.log(`   Type: ${createResponse.data.data.type}`);
        console.log(`   Fields: ${createResponse.data.data.document_fields.length}`);
        createdDocumentId = createResponse.data.data.id;
      }

      // 3. Get specific document
      if (createdDocumentId) {
        console.log(`\n🔍 Getting document configuration ${createdDocumentId}...`);
        const getOneResponse = await axios.get(`${this.adminUrl}/documents/${createdDocumentId}`);
        if (getOneResponse.data.success) {
          console.log('✅ Document configuration retrieved successfully');
          console.log(`   Description: ${getOneResponse.data.data.description}`);
        }
      }

      // 4. Get document fields
      if (createdDocumentId) {
        console.log(`\n📝 Getting fields for document ${createdDocumentId}...`);
        const getFieldsResponse = await axios.get(`${this.adminUrl}/documents/${createdDocumentId}/fields`);
        if (getFieldsResponse.data.success) {
          console.log(`✅ Found ${getFieldsResponse.data.data.length} fields`);
          getFieldsResponse.data.data.forEach(field => {
            console.log(`   - ${field.field_name} (${field.field_type}) ${field.is_required ? '- Required' : ''}`);
          });
        }
      }

      // 5. Update document
      if (createdDocumentId) {
        console.log(`\n📝 Updating document configuration ${createdDocumentId}...`);
        const updateResponse = await axios.put(`${this.adminUrl}/documents/${createdDocumentId}`, {
          description: 'Updated test thesis document configuration'
        });
        if (updateResponse.data.success) {
          console.log('✅ Document configuration updated successfully');
        }
      }

      // 6. Delete document
      if (createdDocumentId) {
        console.log(`\n🗑️  Deleting document configuration ${createdDocumentId}...`);
        const deleteResponse = await axios.delete(`${this.adminUrl}/documents/${createdDocumentId}`);
        if (deleteResponse.data.success) {
          console.log('✅ Document configuration deleted successfully');
        }
      }

    } catch (error) {
      console.log('❌ Documents API error:', error.response?.data?.error || error.message);
    }

    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new AdminAPITester();
  tester.runAllTests();
}

module.exports = AdminAPITester;
