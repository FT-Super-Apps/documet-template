/**
 * Configuration for document signature requirements
 * Defines how many signatures and which roles are required for each document type
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DOCUMENT_SIGNATURE_CONFIG = {
  // KKP (Kerja Kuliah Praktek) - minimal requirement
  'kkp': {
    requiredSignatureCount: 1,
    requiredRoles: ['dosen_pembimbing'],
    description: 'KKP document requires 1 signature from supervising lecturer'
  },

  // KKP Plus - comprehensive requirement
  'kkplus': {
    requiredSignatureCount: 4,
    requiredRoles: ['dosen_pembimbing', 'ketua_prodi', 'dekan', 'koordinator_kkp'],
    description: 'KKP Plus requires 4 signatures from all academic hierarchy'
  },

  // Bimbingan - moderate requirement
  'bimbingan': {
    requiredSignatureCount: 2,
    requiredRoles: ['dosen_pembimbing', 'ketua_prodi'],
    description: 'Guidance document requires 2 signatures from lecturer and head of study program'
  }
};

/**
 * Get signature requirements for a specific document type from database
 * Falls back to static config if database is not available
 * @param {string} documentType - The type of document
 * @returns {Object} Signature configuration object
 */
async function getSignatureRequirementsFromDB(documentType) {
  try {
    const config = await prisma.document_signature_config.findUnique({
      where: {
        document_type: documentType.toLowerCase(),
        is_active: true
      }
    });

    if (config) {
      return {
        requiredSignatureCount: config.required_signature_count,
        requiredRoles: config.required_roles,
        description: config.description
      };
    }

    // Fall back to static config
    return getSignatureRequirements(documentType);
  } catch (error) {
    console.warn(`Warning: Could not fetch signature config from DB for ${documentType}, using static config:`, error.message);
    return getSignatureRequirements(documentType);
  }
}/**
 * Get signature requirements for a specific document type
 * @param {string} documentType - The type of document
 * @returns {Object} Signature configuration object
 */
function getSignatureRequirements(documentType) {
  const config = DOCUMENT_SIGNATURE_CONFIG[documentType.toLowerCase()];

  if (!config) {
    throw new Error(`Unknown document type: ${documentType}. Available types: ${Object.keys(DOCUMENT_SIGNATURE_CONFIG).join(', ')}`);
  }

  return config;
}

/**
 * Validate if a document type is supported
 * @param {string} documentType - The type of document to validate
 * @returns {boolean} True if supported, false otherwise
 */
function isValidDocumentType(documentType) {
  return Object.keys(DOCUMENT_SIGNATURE_CONFIG).includes(documentType.toLowerCase());
}

/**
 * Get all supported document types
 * @returns {Array} Array of supported document type names
 */
function getSupportedDocumentTypes() {
  return Object.keys(DOCUMENT_SIGNATURE_CONFIG);
}

/**
 * Get signature requirements summary for all document types
 * @returns {Object} Summary of all document types and their requirements
 */
function getAllSignatureRequirements() {
  return DOCUMENT_SIGNATURE_CONFIG;
}

module.exports = {
  DOCUMENT_SIGNATURE_CONFIG,
  getSignatureRequirements,
  getSignatureRequirementsFromDB,
  isValidDocumentType,
  getSupportedDocumentTypes,
  getAllSignatureRequirements
};
