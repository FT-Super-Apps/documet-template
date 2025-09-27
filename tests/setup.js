// tests/setup.js
const { PrismaClient } = require('@prisma/client');

let prisma;

beforeAll(async () => {
  // Initialize Prisma for testing
  prisma = new PrismaClient();

  // Set test timeout
  jest.setTimeout(30000);
});

afterAll(async () => {
  // Clean up database connections
  if (prisma) {
    await prisma.$disconnect();
  }
});

// Global test utilities
global.testPrisma = () => prisma;

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.PORT = '8081'; // Different port for testing
process.env.BASE_URL = 'http://localhost:8081';
process.env.VERIFY_APP_BASE_URL = 'http://localhost:8081';
