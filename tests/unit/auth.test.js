// tests/unit/auth.test.js
const { validateFields, verifySessionCode } = require('../../auth/index');

describe('Auth Utils', () => {
  describe('validateFields', () => {
    test('should return valid for complete data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };
      const requiredFields = ['name', 'email'];

      const result = validateFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    test('should return invalid for missing fields', () => {
      const data = {
        name: 'John Doe'
      };
      const requiredFields = ['name', 'email', 'age'];

      const result = validateFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['email', 'age']);
    });

    test('should handle null and undefined values', () => {
      const data = {
        name: 'John Doe',
        email: null,
        age: undefined
      };
      const requiredFields = ['name', 'email', 'age'];

      const result = validateFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['email', 'age']);
    });
  });

  describe('verifySessionCode', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should fail with missing session code', () => {
      verifySessionCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 400,
        error: 'Bad Request',
        message: 'Kode verifikasi tidak disertakan dalam permintaan.'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
