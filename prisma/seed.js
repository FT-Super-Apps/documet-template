const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Starting comprehensive database seeding...');

    // Import dan jalankan seeder dalam urutan yang benar
    console.log('📄 Step 1: Seeding documents and fields...');
    const { seedDocuments } = require('./seed-documents');
    if (typeof seedDocuments === 'function') {
      await seedDocuments();
    } else {
      // Fallback jika export berbeda
      await require('./seed-documents');
    }

    console.log('🔐 Step 2: Seeding EdDSA system...');
    const { seedEdDSASystem } = require('./seed-eddsa-system');
    if (typeof seedEdDSASystem === 'function') {
      await seedEdDSASystem();
    } else {
      // Fallback jika export berbeda  
      await require('./seed-eddsa-system');
    }

    console.log('📋 Step 3: Seeding document signature configuration...');
    const { seedDocumentSignatureConfig } = require('./seed-document-signature-config');
    await seedDocumentSignatureConfig();

    console.log('✅ All basic seeding completed successfully!');
    console.log('');
    console.log('🔧 Enhanced seeding available (run separately):');
    console.log('   node prisma/seed-enhanced-fields.js');
    console.log('   node prisma/seed-audit-history.js');
    console.log('');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
