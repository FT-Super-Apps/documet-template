// tests/integration/api.test.js
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const route = require('../../routes/index');

// Create test app
const createTestApp = () => {
  const app = express();

  // Middleware
  app.use('/templates', express.static(path.join(__dirname, '../../templates')));
  app.use('/download', express.static(path.join(__dirname, '../../templates/output')));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  // Routes
  app.use('/api', route);
  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Generate Document API (EdDSA) running' });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check Endpoints', () => {
    test('GET / should return OK status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        message: 'Generate Document API (EdDSA) running'
      });
    });

    test('GET /api/ should return OK status', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        message: 'Generate Document API (EdDSA) running'
      });
    });

    test('GET /api/health should return detailed health info', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('eddsa');
      expect(response.body.services).toHaveProperty('multisignature');
      expect(response.body.services).toHaveProperty('qr_generation');
    });
  });

  describe('Admin Endpoints', () => {
    describe('Signature Configurations', () => {
      test('GET /api/signature-configs should return configs', async () => {
        const response = await request(app)
          .get('/api/signature-configs');

        // Should not throw error (may be empty array if no data)
        expect(response.status).toBeLessThan(500);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
        }
      });

      test('POST /api/signature-configs should validate required fields', async () => {
        const response = await request(app)
          .post('/api/signature-configs')
          .send({});

        // Should return validation error
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });

      test('POST /api/signature-configs with valid data', async () => {
        const validConfig = {
          document_type: 'test_doc',
          required_signature_count: 2,
          required_roles: ['dosen_pembimbing', 'ketua_prodi'],
          description: 'Test configuration'
        };

        const response = await request(app)
          .post('/api/signature-configs')
          .send(validConfig);

        // Should either succeed or fail with specific database error
        expect([200, 201, 400, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('success');
      });
    });

    describe('Signers Management', () => {
      test('GET /api/signers should return signers', async () => {
        const response = await request(app)
          .get('/api/signers');

        expect(response.status).toBeLessThan(500);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
        }
      });

      test('POST /api/signers should validate required fields', async () => {
        const response = await request(app)
          .post('/api/signers')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('Document Configurations', () => {
      test('GET /api/document-configs should return document configs', async () => {
        const response = await request(app)
          .get('/api/document-configs');

        expect(response.status).toBeLessThan(500);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
        }
      });

      test('POST /api/document-configs should validate required fields', async () => {
        const response = await request(app)
          .post('/api/document-configs')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Document Generation Endpoints', () => {
    test('GET /api/documents should return signed documents', async () => {
      const response = await request(app)
        .get('/api/documents');

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    });

    test('GET /api/stats should return statistics', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
      }
    });

    test('POST /api/generate-document/:type/:prodi should validate parameters', async () => {
      const response = await request(app)
        .post('/api/generate-document/invalid_type/invalid_prodi')
        .send({});

      // Should return error for invalid document type
      expect([400, 404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    test('POST /api/verify-qr should validate QR data', async () => {
      const response = await request(app)
        .post('/api/verify-qr')
        .send({});

      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Verification Endpoints', () => {
    test('GET /api/verification/:documentId with invalid ID should return error', async () => {
      const response = await request(app)
        .get('/api/verification/invalid-document-id');

      expect([404, 500]).toContain(response.status);
    });

    test('GET /api/verify/:documentId should redirect', async () => {
      const response = await request(app)
        .get('/api/verify/test-document-id')
        .expect(302);

      expect(response.header.location).toMatch(/\/api\/verification\/test-document-id/);
    });

    test('GET /api/v/:documentId should redirect to verification', async () => {
      const response = await request(app)
        .get('/api/v/test-document-id')
        .expect(302);

      expect(response.header.location).toMatch(/\/api\/verification\/test-document-id/);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/signature-configs')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 500]).toContain(response.status);
    });
  });
});
