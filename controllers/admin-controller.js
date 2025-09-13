// controllers/admin-controller.js
const { PrismaClient } = require('@prisma/client');
const { EdDSACrypto } = require('../utils/eddsa-crypto');
const fs = require('fs-extra');

const prisma = new PrismaClient();

class AdminController {
  constructor() {
    this.crypto = new EdDSACrypto();
  }

  // ================================
  // SIGNATURE CONFIGURATION MANAGEMENT
  // ================================

  /**
   * Get all signature configurations
   */
  getSignatureConfigs = async (req, res) => {
    try {
      const { active_only } = req.query;

      const whereClause = active_only === 'true' ? { is_active: true } : {};

      const configs = await prisma.document_signature_config.findMany({
        where: whereClause,
        orderBy: { document_type: 'asc' }
      });

      res.json({
        success: true,
        message: `Found ${configs.length} signature configurations`,
        data: configs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get signature configs: ${error.message}`
      });
    }
  };

  /**
   * Get single signature configuration
   */
  getSignatureConfig = async (req, res) => {
    try {
      const { type } = req.params;

      const config = await prisma.document_signature_config.findUnique({
        where: { document_type: type }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: `Signature config for document type '${type}' not found`
        });
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get signature config: ${error.message}`
      });
    }
  };

  /**
   * Create new signature configuration
   */
  createSignatureConfig = async (req, res) => {
    try {
      const { document_type, required_signature_count, required_roles, description } = req.body;

      // Validation
      if (!document_type || !required_signature_count || !required_roles || !Array.isArray(required_roles)) {
        return res.status(400).json({
          success: false,
          error: 'document_type, required_signature_count, and required_roles (array) are required'
        });
      }

      if (required_signature_count <= 0 || required_roles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'required_signature_count must be > 0 and required_roles must not be empty'
        });
      }

      const config = await prisma.document_signature_config.create({
        data: {
          document_type: document_type.toLowerCase(),
          required_signature_count,
          required_roles,
          description: description || `${document_type} document requires ${required_signature_count} signatures`,
          is_active: true
        }
      });

      res.status(201).json({
        success: true,
        message: `Signature config for document type '${document_type}' created successfully`,
        data: config
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: `Document type '${req.body.document_type}' already exists`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to create signature config: ${error.message}`
      });
    }
  };

  /**
   * Update signature configuration
   */
  updateSignatureConfig = async (req, res) => {
    try {
      const { type } = req.params;
      const { required_signature_count, required_roles, description, is_active } = req.body;

      const updateData = {};
      if (required_signature_count !== undefined) updateData.required_signature_count = required_signature_count;
      if (required_roles !== undefined) updateData.required_roles = required_roles;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields provided for update'
        });
      }

      const config = await prisma.document_signature_config.update({
        where: { document_type: type },
        data: updateData
      });

      res.json({
        success: true,
        message: `Signature config for document type '${type}' updated successfully`,
        data: config
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Signature config for document type '${req.params.type}' not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to update signature config: ${error.message}`
      });
    }
  };

  /**
   * Delete signature configuration
   */
  deleteSignatureConfig = async (req, res) => {
    try {
      const { type } = req.params;
      const { hard_delete } = req.query;

      if (hard_delete === 'true') {
        await prisma.document_signature_config.delete({
          where: { document_type: type }
        });
      } else {
        await prisma.document_signature_config.update({
          where: { document_type: type },
          data: { is_active: false }
        });
      }

      res.json({
        success: true,
        message: `Signature config for document type '${type}' ${hard_delete === 'true' ? 'deleted' : 'deactivated'} successfully`
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Signature config for document type '${req.params.type}' not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to delete signature config: ${error.message}`
      });
    }
  };

  // ================================
  // SIGNERS MANAGEMENT
  // ================================

  /**
   * Get all signers
   */
  getSigners = async (req, res) => {
    try {
      const { prodi, role, active_only } = req.query;

      const whereClause = {};
      if (prodi) whereClause.prodi = prodi;
      if (role) whereClause.role = role;
      if (active_only === 'true') whereClause.is_active = true;

      const signers = await prisma.signers.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          nip: true,
          role: true,
          department: true,
          prodi: true,
          key_id: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          // Exclude private keys from response
          public_key: false,
          private_key: false
        },
        orderBy: [
          { prodi: 'asc' },
          { role: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        message: `Found ${signers.length} signers`,
        data: signers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get signers: ${error.message}`
      });
    }
  };

  /**
   * Get single signer
   */
  getSigner = async (req, res) => {
    try {
      const { id } = req.params;

      const signer = await prisma.signers.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          name: true,
          nip: true,
          role: true,
          department: true,
          prodi: true,
          key_id: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          public_key: true,
          // Exclude private key from response for security
          private_key: false
        }
      });

      if (!signer) {
        return res.status(404).json({
          success: false,
          error: `Signer with ID ${id} not found`
        });
      }

      res.json({
        success: true,
        data: signer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get signer: ${error.message}`
      });
    }
  };

  /**
   * Create new signer with automatic key generation
   */
  createSigner = async (req, res) => {
    try {
      const { name, nip, role, department, prodi } = req.body;

      // Validation
      if (!name || !role || !prodi) {
        return res.status(400).json({
          success: false,
          error: 'name, role, and prodi are required'
        });
      }

      // Generate EdDSA key pair
      const keyPair = this.crypto.generateKeyPair();

      const signer = await prisma.signers.create({
        data: {
          name,
          nip,
          role,
          department,
          prodi,
          public_key: keyPair.publicKey,
          private_key: keyPair.privateKey,
          key_id: keyPair.keyId,
          is_active: true
        },
        select: {
          id: true,
          name: true,
          nip: true,
          role: true,
          department: true,
          prodi: true,
          key_id: true,
          is_active: true,
          created_at: true,
          public_key: true,
          // Don't return private key
          private_key: false
        }
      });

      res.status(201).json({
        success: true,
        message: `Signer '${name}' created successfully with auto-generated keys`,
        data: signer
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'NIP already exists or duplicate key ID generated'
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to create signer: ${error.message}`
      });
    }
  };

  /**
   * Update signer
   */
  updateSigner = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, nip, role, department, prodi, is_active, regenerate_keys } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (nip !== undefined) updateData.nip = nip;
      if (role !== undefined) updateData.role = role;
      if (department !== undefined) updateData.department = department;
      if (prodi !== undefined) updateData.prodi = prodi;
      if (is_active !== undefined) updateData.is_active = is_active;

      // Regenerate keys if requested
      if (regenerate_keys === true) {
        const keyPair = this.crypto.generateKeyPair();
        updateData.public_key = keyPair.publicKey;
        updateData.private_key = keyPair.privateKey;
        updateData.key_id = keyPair.keyId;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields provided for update'
        });
      }

      const signer = await prisma.signers.update({
        where: { id: parseInt(id) },
        data: updateData,
        select: {
          id: true,
          name: true,
          nip: true,
          role: true,
          department: true,
          prodi: true,
          key_id: true,
          is_active: true,
          updated_at: true,
          public_key: true,
          private_key: false
        }
      });

      res.json({
        success: true,
        message: `Signer updated successfully${regenerate_keys ? ' with new keys' : ''}`,
        data: signer
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Signer with ID ${req.params.id} not found`
        });
      }

      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'NIP already exists or duplicate key ID generated'
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to update signer: ${error.message}`
      });
    }
  };

  /**
   * Delete signer
   */
  deleteSigner = async (req, res) => {
    try {
      const { id } = req.params;
      const { hard_delete } = req.query;

      if (hard_delete === 'true') {
        await prisma.signers.delete({
          where: { id: parseInt(id) }
        });
      } else {
        await prisma.signers.update({
          where: { id: parseInt(id) },
          data: { is_active: false }
        });
      }

      res.json({
        success: true,
        message: `Signer ${hard_delete === 'true' ? 'deleted' : 'deactivated'} successfully`
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Signer with ID ${req.params.id} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to delete signer: ${error.message}`
      });
    }
  };

  // ================================
  // DOCUMENT CONFIGURATION MANAGEMENT
  // ================================

  /**
   * Get all document configurations
   */
  getDocuments = async (req, res) => {
    try {
      const { type, prodi } = req.query;

      const whereClause = {};
      if (type) whereClause.type = type;
      if (prodi) whereClause.prodi = prodi;

      const documents = await prisma.documents.findMany({
        where: whereClause,
        include: {
          document_fields: {
            orderBy: { field_name: 'asc' }
          },
          _count: {
            select: { signed_documents: true }
          }
        },
        orderBy: [
          { type: 'asc' },
          { prodi: 'asc' }
        ]
      });

      res.json({
        success: true,
        message: `Found ${documents.length} document configurations`,
        data: documents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get documents: ${error.message}`
      });
    }
  };

  /**
   * Get single document configuration
   */
  getDocument = async (req, res) => {
    try {
      const { id } = req.params;

      const document = await prisma.documents.findUnique({
        where: { id: parseInt(id) },
        include: {
          document_fields: {
            orderBy: { field_name: 'asc' }
          },
          _count: {
            select: { signed_documents: true }
          }
        }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: `Document configuration with ID ${id} not found`
        });
      }

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get document: ${error.message}`
      });
    }
  };

  /**
   * Create new document configuration
   */
  createDocument = async (req, res) => {
    try {
      const { type, prodi, template_path, description, fields } = req.body;

      // Validation
      if (!type || !prodi) {
        return res.status(400).json({
          success: false,
          error: 'type and prodi are required'
        });
      }

      // Validate template file exists if provided
      if (template_path && !await fs.pathExists(template_path)) {
        return res.status(400).json({
          success: false,
          error: `Template file not found: ${template_path}`
        });
      }

      const document = await prisma.documents.create({
        data: {
          type: type.toLowerCase(),
          prodi: prodi.toLowerCase(),
          template_path,
          description: description || `${type} document for ${prodi}`,
          document_fields: fields && Array.isArray(fields) ? {
            create: fields.map(field => ({
              field_name: field.field_name,
              field_type: field.field_type,
              is_required: field.is_required !== undefined ? field.is_required : true,
              default_value: field.default_value
            }))
          } : undefined
        },
        include: {
          document_fields: true
        }
      });

      res.status(201).json({
        success: true,
        message: `Document configuration for '${type}' - '${prodi}' created successfully`,
        data: document
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: `Document configuration for type '${req.body.type}' and prodi '${req.body.prodi}' already exists`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to create document: ${error.message}`
      });
    }
  };

  /**
   * Update document configuration
   */
  updateDocument = async (req, res) => {
    try {
      const { id } = req.params;
      const { template_path, description } = req.body;

      const updateData = {};
      if (template_path !== undefined) {
        // Validate template file exists if provided
        if (template_path && !await fs.pathExists(template_path)) {
          return res.status(400).json({
            success: false,
            error: `Template file not found: ${template_path}`
          });
        }
        updateData.template_path = template_path;
      }
      if (description !== undefined) updateData.description = description;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields provided for update'
        });
      }

      const document = await prisma.documents.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          document_fields: true
        }
      });

      res.json({
        success: true,
        message: 'Document configuration updated successfully',
        data: document
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Document configuration with ID ${req.params.id} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to update document: ${error.message}`
      });
    }
  };

  /**
   * Delete document configuration
   */
  deleteDocument = async (req, res) => {
    try {
      const { id } = req.params;

      // Check if document has signed documents
      const signedDocsCount = await prisma.signed_documents.count({
        where: { document_id: parseInt(id) }
      });

      if (signedDocsCount > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot delete document configuration. It has ${signedDocsCount} signed documents associated with it.`
        });
      }

      await prisma.documents.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Document configuration deleted successfully'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Document configuration with ID ${req.params.id} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to delete document: ${error.message}`
      });
    }
  };

  // ================================
  // DOCUMENT FIELDS MANAGEMENT
  // ================================

  /**
   * Get fields for a specific document
   */
  getDocumentFields = async (req, res) => {
    try {
      const { documentId } = req.params;

      const fields = await prisma.document_fields.findMany({
        where: { document_id: parseInt(documentId) },
        orderBy: { field_name: 'asc' }
      });

      res.json({
        success: true,
        message: `Found ${fields.length} fields`,
        data: fields
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get document fields: ${error.message}`
      });
    }
  };

  /**
   * Add field to document
   */
  createDocumentField = async (req, res) => {
    try {
      const { documentId } = req.params;
      const { field_name, field_type, is_required, default_value } = req.body;

      if (!field_name || !field_type) {
        return res.status(400).json({
          success: false,
          error: 'field_name and field_type are required'
        });
      }

      const field = await prisma.document_fields.create({
        data: {
          document_id: parseInt(documentId),
          field_name,
          field_type,
          is_required: is_required !== undefined ? is_required : true,
          default_value
        }
      });

      res.status(201).json({
        success: true,
        message: `Field '${field_name}' added successfully`,
        data: field
      });
    } catch (error) {
      if (error.code === 'P2003') {
        return res.status(404).json({
          success: false,
          error: `Document with ID ${req.params.documentId} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to create document field: ${error.message}`
      });
    }
  };

  /**
   * Update document field
   */
  updateDocumentField = async (req, res) => {
    try {
      const { fieldId } = req.params;
      const { field_name, field_type, is_required, default_value } = req.body;

      const updateData = {};
      if (field_name !== undefined) updateData.field_name = field_name;
      if (field_type !== undefined) updateData.field_type = field_type;
      if (is_required !== undefined) updateData.is_required = is_required;
      if (default_value !== undefined) updateData.default_value = default_value;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields provided for update'
        });
      }

      const field = await prisma.document_fields.update({
        where: { id: parseInt(fieldId) },
        data: updateData
      });

      res.json({
        success: true,
        message: 'Document field updated successfully',
        data: field
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Document field with ID ${req.params.fieldId} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to update document field: ${error.message}`
      });
    }
  };

  /**
   * Delete document field
   */
  deleteDocumentField = async (req, res) => {
    try {
      const { fieldId } = req.params;

      await prisma.document_fields.delete({
        where: { id: parseInt(fieldId) }
      });

      res.json({
        success: true,
        message: 'Document field deleted successfully'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: `Document field with ID ${req.params.fieldId} not found`
        });
      }

      res.status(500).json({
        success: false,
        error: `Failed to delete document field: ${error.message}`
      });
    }
  };

  // ================================
  // SYSTEM STATISTICS & OVERVIEW
  // ================================

  /**
   * Get admin dashboard overview
   */
  getDashboardOverview = async (req, res) => {
    try {
      const [
        signatureConfigsCount,
        signersCount,
        documentsCount,
        signedDocumentsCount,
        recentVerifications
      ] = await Promise.all([
        prisma.document_signature_config.count({ where: { is_active: true } }),
        prisma.signers.count({ where: { is_active: true } }),
        prisma.documents.count(),
        prisma.signed_documents.count(),
        prisma.verification_logs.findMany({
          take: 10,
          orderBy: { verified_at: 'desc' },
          include: {
            signed_document: {
              select: {
                document_type: true,
                prodi: true,
                no_surat: true
              }
            }
          }
        })
      ]);

      // Get signature config breakdown
      const signatureConfigBreakdown = await prisma.document_signature_config.groupBy({
        by: ['document_type'],
        _count: { document_type: true },
        where: { is_active: true }
      });

      // Get signer breakdown by role
      const signersByRole = await prisma.signers.groupBy({
        by: ['role'],
        _count: { role: true },
        where: { is_active: true }
      });

      // Get documents by type
      const documentsByType = await prisma.documents.groupBy({
        by: ['type'],
        _count: { type: true }
      });

      res.json({
        success: true,
        data: {
          overview: {
            signature_configs: signatureConfigsCount,
            active_signers: signersCount,
            document_types: documentsCount,
            signed_documents: signedDocumentsCount
          },
          breakdowns: {
            signature_configs: signatureConfigBreakdown,
            signers_by_role: signersByRole,
            documents_by_type: documentsByType
          },
          recent_verifications: recentVerifications.map(v => ({
            document_id: v.signed_doc_id,
            document_type: v.signed_document?.document_type,
            prodi: v.signed_document?.prodi,
            no_surat: v.signed_document?.no_surat,
            verification_result: v.verification_result,
            verified_at: v.verified_at,
            verifier_ip: v.verifier_ip
          }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to get dashboard overview: ${error.message}`
      });
    }
  };
}

module.exports = AdminController;
