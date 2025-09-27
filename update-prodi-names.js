// update-prodi-names.js - Script untuk memperbarui nama prodi yang benar
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateProdiNames() {
  try {
    console.log('🔄 Updating prodi names to correct format...\n');

    // Mapping nama prodi lama ke nama prodi baru yang benar
    const prodiMapping = {
      // Dari nama lama (key dalam database) -> nama baru yang benar
      'pengairan': {
        newKey: 'teknik-sipil',
        newDisplayName: 'Teknik Sipil (Pengairan)',
        templatePath: 'templates/teknik-sipil/kkp.docx'
      },
      'elektro': {
        newKey: 'teknik-elektro',
        newDisplayName: 'Teknik Elektro',
        templatePath: 'templates/teknik-elektro/kkp.docx'
      },
      'arsitektur': {
        newKey: 'arsitektur',
        newDisplayName: 'Arsitektur',
        templatePath: 'templates/arsitektur/kkp.docx'
      },
      'informatika': {
        newKey: 'informatika',
        newDisplayName: 'Informatika',
        templatePath: 'templates/informatika/kkp.docx'
      },
      'pwk': {
        newKey: 'perencanaan-wilayah-kota',
        newDisplayName: 'Perencanaan Wilayah Kota',
        templatePath: 'templates/perencanaan-wilayah-kota/kkp.docx'
      }
    };

    // 1. Update Documents table
    console.log('📄 Updating documents table...');
    for (const [oldKey, newData] of Object.entries(prodiMapping)) {
      const updateResult = await prisma.documents.updateMany({
        where: { prodi: oldKey },
        data: {
          prodi: newData.newKey,
          template_path: newData.templatePath,
          description: `Template surat KKP untuk Program Studi ${newData.newDisplayName}`,
          updated_at: new Date()
        }
      });

      if (updateResult.count > 0) {
        console.log(`   ✅ Updated ${updateResult.count} document(s) from '${oldKey}' to '${newData.newKey}'`);

        // Update default_value di document_fields yang terkait
        const documents = await prisma.documents.findMany({
          where: { prodi: newData.newKey }
        });

        for (const doc of documents) {
          await prisma.document_fields.updateMany({
            where: {
              document_id: doc.id,
              field_name: 'nama_prodi'
            },
            data: {
              default_value: newData.newDisplayName,
              updated_at: new Date()
            }
          });
        }
      }
    }

    // 2. Update Signers table
    console.log('\n👥 Updating signers table...');
    for (const [oldKey, newData] of Object.entries(prodiMapping)) {
      const updateResult = await prisma.signers.updateMany({
        where: { prodi: oldKey },
        data: {
          prodi: newData.newKey,
          updated_at: new Date()
        }
      });

      if (updateResult.count > 0) {
        console.log(`   ✅ Updated ${updateResult.count} signer(s) from '${oldKey}' to '${newData.newKey}'`);
      }
    }

    // 3. Update Signed Documents table
    console.log('\n📝 Updating signed_documents table...');
    for (const [oldKey, newData] of Object.entries(prodiMapping)) {
      const updateResult = await prisma.signed_documents.updateMany({
        where: { prodi: oldKey },
        data: {
          prodi: newData.newKey,
          last_updated_at: new Date()
        }
      });

      if (updateResult.count > 0) {
        console.log(`   ✅ Updated ${updateResult.count} signed document(s) from '${oldKey}' to '${newData.newKey}'`);
      }
    }

    // 4. Update validation rules di document_fields untuk nama_prodi
    console.log('\n📋 Updating validation rules for nama_prodi fields...');
    const allowedValues = Object.values(prodiMapping).map(p => p.newDisplayName);

    await prisma.document_fields.updateMany({
      where: { field_name: 'nama_prodi' },
      data: {
        validation_rules: JSON.stringify({
          allowed_values: allowedValues
        }),
        help_text: 'Nama program studi mahasiswa (pilih dari daftar yang tersedia)',
        updated_at: new Date()
      }
    });
    console.log(`   ✅ Updated validation rules with ${allowedValues.length} allowed values`);

    // 5. Update document history untuk mencatat perubahan
    console.log('\n📚 Adding update history records...');
    const signedDocs = await prisma.signed_documents.findMany();

    for (const doc of signedDocs) {
      await prisma.document_history.create({
        data: {
          signed_doc_id: doc.id,
          action: 'updated',
          description: `Nama prodi diperbarui ke format yang benar: ${doc.prodi}`,
          performed_by: 'system@unismuh.ac.id',
          ip_address: '127.0.0.1',
          user_agent: 'Database Migration Script',
          metadata: JSON.stringify({
            migration_type: 'prodi_name_correction',
            timestamp: new Date().toISOString(),
            automated: true
          })
        }
      });
    }
    console.log(`   ✅ Added ${signedDocs.length} history record(s)`);

    // 6. Add audit log untuk perubahan ini
    console.log('\n📊 Adding audit log entries...');
    for (const [oldKey, newData] of Object.entries(prodiMapping)) {
      if (oldKey !== newData.newKey) { // Hanya log yang benar-benar berubah
        await prisma.audit_logs.create({
          data: {
            table_name: 'multiple_tables',
            record_id: `prodi_${oldKey}`,
            operation: 'UPDATE',
            old_values: JSON.stringify({ prodi_key: oldKey }),
            new_values: JSON.stringify({
              prodi_key: newData.newKey,
              display_name: newData.newDisplayName
            }),
            user_info: 'system@unismuh.ac.id',
            ip_address: '127.0.0.1'
          }
        });
      }
    }
    console.log('   ✅ Added audit log entries for prodi name changes');

    // 7. Summary report
    console.log('\n📋 Summary Report:');

    // Count documents by prodi
    const docCounts = await prisma.documents.groupBy({
      by: ['prodi'],
      _count: { prodi: true }
    });

    console.log('\n   📄 Documents by Prodi:');
    docCounts.forEach(item => {
      const prodiData = Object.values(prodiMapping).find(p => p.newKey === item.prodi);
      console.log(`   📋 ${prodiData?.newDisplayName || item.prodi}: ${item._count.prodi} document(s)`);
    });

    // Count signers by prodi  
    const signerCounts = await prisma.signers.groupBy({
      by: ['prodi'],
      _count: { prodi: true }
    });

    console.log('\n   👥 Signers by Prodi:');
    signerCounts.forEach(item => {
      const prodiData = Object.values(prodiMapping).find(p => p.newKey === item.prodi);
      console.log(`   🖊️  ${prodiData?.newDisplayName || item.prodi}: ${item._count.prodi} signer(s)`);
    });

    console.log('\n🎉 Prodi names update completed successfully!');
    console.log('\n✅ All prodi names have been updated to the correct format:');
    Object.values(prodiMapping).forEach((prodi, index) => {
      console.log(`   ${index + 1}. ${prodi.newDisplayName} (${prodi.newKey})`);
    });

  } catch (error) {
    console.error('❌ Error updating prodi names:', error);
    throw error;
  }
}

async function main() {
  await updateProdiNames();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
