// prisma/seed-eddsa-system.js - Enhanced seeder untuk EdDSA system
const { PrismaClient } = require('@prisma/client');
const { MultiSignatureManager } = require('../utils/eddsa-crypto');

const prisma = new PrismaClient();

async function seedEdDSASystem() {
  try {
    console.log('🔑 Seeding EdDSA Multi-Signature system...');

    // 1. Seed system configuration
    console.log('📋 Creating system configuration...');

    const systemConfigs = [
      {
        config_key: 'eddsa_enabled',
        config_value: 'true',
        description: 'Enable EdDSA multi-signature functionality'
      },
      {
        config_key: 'required_signatures',
        config_value: '3',
        description: 'Number of required signatures for document completion'
      },
      {
        config_key: 'signature_algorithm',
        config_value: 'EdDSA',
        description: 'Digital signature algorithm used'
      },
      {
        config_key: 'qr_code_format',
        config_value: 'full',
        description: 'Default QR code format (full/standalone/compact)'
      },
      {
        config_key: 'verification_url_base',
        config_value: process.env.BASE_URL || 'http://localhost:8080',
        description: 'Base URL for document verification'
      }
    ];

    for (const config of systemConfigs) {
      await prisma.system_config.upsert({
        where: { config_key: config.config_key },
        update: { config_value: config.config_value },
        create: config
      });
    }

    console.log('✅ System configuration created');

    // 2. Create signers for each prodi
    console.log('👥 Creating signers for each prodi...');

    const prodis = ['informatika', 'teknik-elektro', 'arsitektur', 'teknik-sipil', 'perencanaan-wilayah-kota'];
    const manager = new MultiSignatureManager();

    for (const prodi of prodis) {
      console.log(`  Creating signers for ${prodi}...`);

      // Check if signers already exist
      const existingSigners = await prisma.signers.count({
        where: { prodi: prodi, is_active: true }
      });

      if (existingSigners >= 3) {
        console.log(`  ⚠️  Signers for ${prodi} already exist, skipping...`);
        continue;
      }

      // Generate new signers
      const signers = manager.initializeSigners();

      for (const [role, signerData] of Object.entries(signers)) {
        const signerName = getSignerName(role, prodi);
        const signerNip = generateNIP(role);

        await prisma.signers.create({
          data: {
            name: signerName,
            nip: signerNip,
            role: role,
            department: 'Fakultas Teknik',
            prodi: prodi,
            public_key: signerData.publicKey,
            private_key: signerData.privateKey, // In production, encrypt this
            key_id: signerData.keyId,
            is_active: true
          }
        });
      }

      console.log(`  ✅ Created 3 signers for ${prodi}`);
    }

    // 3. Create sample signed document for testing
    console.log('📄 Creating sample signed documents...');

    const sampleData = {
      kepada: 'PT. Tech Indonesia Sample',
      tempat_tujuan: 'Jakarta',
      tableData: [
        { nama: 'John Doe Sample', nim: '2021001', semester: '6' },
        { nama: 'Jane Smith Sample', nim: '2021002', semester: '6' }
      ]
    };

    // Create sample for informatika
    const informatikaSigners = await prisma.signers.findMany({
      where: { prodi: 'informatika', is_active: true }
    });

    if (informatikaSigners.length >= 3) {
      const documentContent = JSON.stringify(sampleData);
      const documentHash = require('crypto').createHash('sha256').update(documentContent).digest('hex');

      const sampleDoc = await prisma.signed_documents.create({
        data: {
          document_type: 'kkp',
          prodi: 'informatika',
          document_content: documentContent,
          document_hash: documentHash,
          no_surat: 'SAMPLE/001/KKP/2025',
          qr_code_data: JSON.stringify({ sample: true, documentHash }),
          total_signatures_required: 3,
          total_signatures_received: 3,
          is_complete: true,
          completed_at: new Date()
        }
      });

      // Create sample signatures
      for (const signer of informatikaSigners) {
        await prisma.document_signatures.create({
          data: {
            signed_doc_id: sampleDoc.id,
            signer_id: signer.id,
            signature_data: Buffer.from(`sample_signature_${signer.role}`).toString('base64'),
            signature_hash: require('crypto').createHash('sha256').update(`sample_${signer.role}`).digest('hex'),
            signer_info: JSON.stringify({
              role: signer.role,
              name: signer.name,
              nip: signer.nip
            }),
            algorithm: 'EdDSA'
          }
        });
      }

      console.log('✅ Sample signed document created');
    }

    console.log('🎉 EdDSA Multi-Signature system seeding completed!');

    // Print summary
    const totalSigners = await prisma.signers.count();
    const totalDocs = await prisma.signed_documents.count();
    const totalSigs = await prisma.document_signatures.count();

    console.log('\n📊 Summary:');
    console.log(`   Signers created: ${totalSigners}`);
    console.log(`   Documents created: ${totalDocs}`);
    console.log(`   Signatures created: ${totalSigs}`);
    console.log(`   System configs: ${systemConfigs.length}`);

  } catch (error) {
    console.error('❌ Error seeding EdDSA system:', error);
    throw error;
  }
}

function getSignerName(role, prodi) {
  const names = {
    dosen_pembimbing: `Dr. Pembimbing ${prodi.charAt(0).toUpperCase() + prodi.slice(1)}`,
    ketua_prodi: `Dr. Kaprodi ${prodi.charAt(0).toUpperCase() + prodi.slice(1)}`,
    dekan: `Prof. Dekan Fakultas Teknik`
  };
  return names[role] || `${role} ${prodi}`;
}

function generateNIP(role) {
  const base = {
    dosen_pembimbing: '198501',
    ketua_prodi: '197501',
    dekan: '196501'
  };
  const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return (base[role] || '199001') + randomSuffix;
}

async function main() {
  await seedEdDSASystem();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
