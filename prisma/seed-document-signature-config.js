// prisma/seed-document-signature-config.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedDocumentSignatureConfig() {
  try {
    console.log('🌱 Seeding document signature configuration...');

    // Clear existing config
    await prisma.document_signature_config.deleteMany();

    // Seed signature requirements untuk setiap document type
    const configs = [
      {
        document_type: 'kkp',
        required_signature_count: 1,
        required_roles: ['dosen_pembimbing'],
        description: 'KKP document requires 1 signature from supervising lecturer',
        is_active: true
      },
      {
        document_type: 'kkplus',
        required_signature_count: 4,
        required_roles: ['dosen_pembimbing', 'ketua_prodi', 'dekan', 'koordinator_kkp'],
        description: 'KKP Plus requires 4 signatures from all academic hierarchy',
        is_active: true
      },
      {
        document_type: 'bimbingan',
        required_signature_count: 2,
        required_roles: ['dosen_pembimbing', 'ketua_prodi'],
        description: 'Guidance document requires 2 signatures from lecturer and head of study program',
        is_active: true
      }
    ];

    for (const config of configs) {
      const created = await prisma.document_signature_config.create({
        data: config
      });

      console.log(`✅ Created signature config for ${config.document_type}:`, {
        required_signatures: config.required_signature_count,
        required_roles: config.required_roles.join(', ')
      });
    }

    console.log('✅ Document signature configuration seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding document signature configuration:', error);
    throw error;
  }
}

module.exports = { seedDocumentSignatureConfig };

// Run directly if this file is executed
if (require.main === module) {
  seedDocumentSignatureConfig()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
