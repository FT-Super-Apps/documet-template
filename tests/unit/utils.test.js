// tests/unit/utils.test.js
const path = require('path');

// Mock the dependencies first
jest.mock('fs-extra');
jest.mock('uuid');

const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

describe('Utils Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Generate Date Utils', () => {
    test('should be available', () => {
      // Test that the utility files exist
      const generateDatePath = path.join(__dirname, '../../utils/generate-date.js');
      expect(() => require(generateDatePath)).not.toThrow();
    });
  });

  describe('Generate Document Utils', () => {
    test('should be available', () => {
      const generateDocPath = path.join(__dirname, '../../utils/generate-document.js');
      expect(() => require(generateDocPath)).not.toThrow();
    });
  });

  describe('EdDSA Crypto Utils', () => {
    test('should be available', () => {
      const eddsaCryptoPath = path.join(__dirname, '../../utils/eddsa-crypto.js');
      expect(() => require(eddsaCryptoPath)).not.toThrow();
    });
  });

  describe('QR Code Utils', () => {
    test('should be available', () => {
      const qrcodePath = path.join(__dirname, '../../utils/generate-qrcode.js');
      expect(() => require(qrcodePath)).not.toThrow();
    });

    test('enhanced QR code should be available', () => {
      const enhancedQrPath = path.join(__dirname, '../../utils/generate-qrcode-enhanced.js');
      expect(() => require(enhancedQrPath)).not.toThrow();
    });
  });

  describe('UUID Mock', () => {
    test('should generate mocked UUID', () => {
      const mockId = 'test-uuid-123';
      uuidv4.mockReturnValue(mockId);

      expect(uuidv4()).toBe(mockId);
    });
  });
});
