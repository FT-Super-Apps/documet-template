# Generate Document API - Testing Suite

## Daftar Endpoint Yang Diuji

### **Document Generation Endpoints (EdDSA)**
- **POST** `/api/generate-document/:type/:prodi` - Generate document with EdDSA signature
- **POST** `/api/verify-qr` - Verify document from QR code
- **GET** `/api/verification/:documentId` - Verify document by ID
- **POST** `/api/init-signers/:prodi` - Initialize signers for a prodi
- **GET** `/api/documents` - Get all signed documents
- **GET** `/api/documents/:documentId/download` - Download signed document
- **GET** `/api/stats` - Get verification statistics

### **Admin Management Endpoints**

#### Signature Configurations
- **GET** `/api/signature-configs` - Get all signature configurations
- **GET** `/api/signature-configs/:type` - Get specific signature config
- **POST** `/api/signature-configs` - Create signature config
- **PUT** `/api/signature-configs/:type` - Update signature config
- **DELETE** `/api/signature-configs/:type` - Delete signature config

#### Signers Management
- **GET** `/api/signers` - Get all signers
- **GET** `/api/signers/:id` - Get specific signer
- **POST** `/api/signers` - Create new signer
- **PUT** `/api/signers/:id` - Update signer
- **DELETE** `/api/signers/:id` - Delete signer

#### Document Configurations
- **GET** `/api/document-configs` - Get all document configurations
- **GET** `/api/document-configs/:id` - Get specific document config
- **POST** `/api/document-configs` - Create document config
- **PUT** `/api/document-configs/:id` - Update document config
- **DELETE** `/api/document-configs/:id` - Delete document config

#### Document Fields Management
- **GET** `/api/document-configs/:documentId/fields` - Get document fields
- **POST** `/api/document-configs/:documentId/fields` - Create document field
- **PUT** `/api/fields/:fieldId` - Update document field
- **DELETE** `/api/fields/:fieldId` - Delete document field

### **Utility Endpoints**
- **GET** `/` - Root endpoint (health check)
- **GET** `/api/health` - Detailed health check
- **GET** `/api/verify/:documentId` - Document verification page
- **GET** `/api/v/:documentId` - Short verification URL

## Test Categories

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test endpoint interactions
3. **E2E Tests** - Test complete workflows
4. **Performance Tests** - Load testing
5. **Security Tests** - Authentication & validation

## Running Tests

```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Test Environment Setup

1. Create `.env.test` file with test database
2. Seed test data
3. Run migration for test database
