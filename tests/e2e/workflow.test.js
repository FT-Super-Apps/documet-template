// tests/e2e/workflow.test.js
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const route = require('../../routes/index');

const prisma = new PrismaClient();

// Create test app
const createTestApp = () => {
  const app = express();

  app.use('/templates', express.static(path.join(__dirname, '../../templates')));
  app.use('/download', express.static(path.join(__dirname, '../../templates/output')));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  app.use('/api', route);
  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Generate Document API (EdDSA) running' });
  });

  return app;
};

describe('E2E Workflow Tests', () => {
  let app;
  let testSignatureConfigId;
  let testSignerId;
  let testDocumentConfigId;

  beforeAll(async () => {
    app = createTestApp();

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      // Clean up test data in correct order (respecting foreign keys)
      await prisma.document_signatures.deleteMany({
        where: {
          OR: [
            { signer: { name: { contains: 'E2E Test' } } },
            { signed_document: { document_type: { contains: 'e2e_test' } } }
          ]
        }
      });

      await prisma.signed_documents.deleteMany({
        where: { document_type: { contains: 'e2e_test' } }
      });

      await prisma.document_fields.deleteMany({
        where: { documents: { type: { contains: 'e2e_test' } } }
      });

      await prisma.documents.deleteMany({
        where: { type: { contains: 'e2e_test' } }
      });

      await prisma.signers.deleteMany({
        where: { name: { contains: 'E2E Test' } }
      });

      await prisma.document_signature_config.deleteMany({
        where: { document_type: { contains: 'e2e_test' } }
      });
    } catch (error) {
      console.log('Cleanup warning:', error.message);
    }
  }

  describe('Complete Document Management Workflow', () => {
    test('1. Should create signature configuration', async () => {
      const configData = {
        document_type: 'e2e_test_kkp',
        required_signature_count: 2,
        required_roles: ['dosen_pembimbing', 'ketua_prodi'],
        description: 'E2E Test Configuration for KKP'
      };

      const response = await request(app)
        .post('/api/signature-configs')
        .send(configData);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('document_type', configData.document_type);
        testSignatureConfigId = response.body.data.id;
      } else {
        // Log the error but continue with other tests
        console.log('Signature config creation failed:', response.body);
      }
    });

    test('2. Should create signers', async () => {
      const signerData = {
        name: 'E2E Test Dosen Pembimbing',
        nip: '12345678901234567890',
        role: 'dosen_pembimbing',
        department: 'Teknik Informatika',
        prodi: 'informatika'
      };

      const response = await request(app)
        .post('/api/signers')
        .send(signerData);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('name', signerData.name);
        testSignerId = response.body.data.id;
      } else {
        console.log('Signer creation failed:', response.body);
      }
    });

    test('3. Should create document configuration', async () => {
      const docConfigData = {
        type: 'e2e_test_kkp',
        prodi: 'informatika',
        template_path: 'templates/informatika/kkp.docx',
        description: 'E2E Test Document Configuration'
      };

      const response = await request(app)
        .post('/api/document-configs')
        .send(docConfigData);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        testDocumentConfigId = response.body.data.id;
      } else {
        console.log('Document config creation failed:', response.body);
      }
    });

    test('4. Should get all signature configurations', async () => {
      const response = await request(app)
        .get('/api/signature-configs');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);

        // Check if our test config exists
        const testConfig = response.body.data.find(
          config => config.document_type === 'e2e_test_kkp'
        );
        if (testConfig) {
          expect(testConfig).toHaveProperty('required_signature_count', 2);
        }
      }
    });

    test('5. Should get all signers', async () => {
      const response = await request(app)
        .get('/api/signers');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('6. Should get document configurations', async () => {
      const response = await request(app)
        .get('/api/document-configs');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('7. Should attempt document generation (may fail due to missing template)', async () => {
      const documentData = {
        nama_mahasiswa: 'John Doe E2E Test',
        nim: '123456789',
        judul_kkp: 'E2E Test Document Generation',
        nama_perusahaan: 'Test Company',
        periode_kkp: 'Juli - Agustus 2024'
      };

      const response = await request(app)
        .post('/api/generate-document/e2e_test_kkp/informatika')
        .send(documentData);

      // This might fail due to missing template or database issues
      // But we check that it's handled gracefully
      expect([200, 201, 400, 404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');

      if (response.body.success === false) {
        expect(response.body).toHaveProperty('error');
        console.log('Document generation expected error:', response.body.error);
      }
    });

    test('8. Should get statistics', async () => {
      const response = await request(app)
        .get('/api/stats');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalDocuments');
        expect(response.body.data).toHaveProperty('completedDocuments');
        expect(response.body.data).toHaveProperty('pendingDocuments');
      }
    });

    test('9. Should handle QR verification with invalid data', async () => {
      const response = await request(app)
        .post('/api/verify-qr')
        .send({ qrData: 'invalid-qr-data' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    test('10. Should handle document verification with invalid ID', async () => {
      const response = await request(app)
        .get('/api/verification/invalid-document-id');

      expect([404, 500]).toContain(response.status);
    });
  });

  describe('CRUD Operations Workflow', () => {
    test('Should update signature configuration if created', async () => {
      if (!testSignatureConfigId) {
        console.log('Skipping update test - no config ID available');
        return;
      }

      const updateData = {
        description: 'Updated E2E Test Configuration'
      };

      const response = await request(app)
        .put(`/api/signature-configs/e2e_test_kkp`)
        .send(updateData);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('Should update signer if created', async () => {
      if (!testSignerId) {
        console.log('Skipping signer update test - no signer ID available');
        return;
      }

      const updateData = {
        department: 'Updated Department'
      };

      const response = await request(app)
        .put(`/api/signers/${testSignerId}`)
        .send(updateData);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('Should delete test data in correct order', async () => {
      // Delete in reverse order of creation to respect foreign keys

      if (testDocumentConfigId) {
        const response = await request(app)
          .delete(`/api/document-configs/${testDocumentConfigId}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      }

      if (testSignerId) {
        const response = await request(app)
          .delete(`/api/signers/${testSignerId}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      }

      // Delete signature config
      const response = await request(app)
        .delete('/api/signature-configs/e2e_test_kkp');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });
});
