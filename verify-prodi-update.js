// verify-prodi-update.js - Script untuk memverifikasi update nama prodi
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyProdiUpdate() {
  try {
    console.log('🔍 Verifying prodi name updates...\n');

    // 1. Check documents table
    console.log('📄 Documents Table:');
    const documents = await prisma.documents.findMany({
      select: {
        id: true,
        prodi: true,
        description: true,
        template_path: true,
        document_fields: {
          where: { field_name: 'nama_prodi' },
          select: { default_value: true }
        }
      },
      orderBy: { prodi: 'asc' }
    });

    documents.forEach((doc, index) => {
      const namaProdi = doc.document_fields[0]?.default_value || 'N/A';
      console.log(`   ${index + 1}. ${doc.prodi} -> Display Name: "${namaProdi}"`);
      console.log(`      Template: ${doc.template_path}`);
    });

    // 2. Check signers table
    console.log('\n👥 Signers Table:');
    const signersByProdi = await prisma.signers.groupBy({
      by: ['prodi'],
      _count: { prodi: true },
      orderBy: { prodi: 'asc' }
    });

    signersByProdi.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.prodi}: ${group._count.prodi} signers`);
    });

    // 3. Check signed_documents table
    console.log('\n📝 Signed Documents Table:');
    const signedDocsByProdi = await prisma.signed_documents.groupBy({
      by: ['prodi'],
      _count: { prodi: true },
      orderBy: { prodi: 'asc' }
    });

    if (signedDocsByProdi.length > 0) {
      signedDocsByProdi.forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.prodi}: ${group._count.prodi} signed document(s)`);
      });
    } else {
      console.log('   No signed documents found');
    }

    // 4. Check validation rules for nama_prodi fields
    console.log('\n📋 Validation Rules for nama_prodi fields:');
    const namaProdiFields = await prisma.document_fields.findMany({
      where: { field_name: 'nama_prodi' },
      select: {
        id: true,
        validation_rules: true,
        help_text: true,
        documents: {
          select: { prodi: true }
        }
      }
    });

    namaProdiFields.forEach((field, index) => {
      const rules = JSON.parse(field.validation_rules || '{}');
      console.log(`   ${index + 1}. Document prodi: ${field.documents?.prodi}`);
      console.log(`      Allowed values: ${JSON.stringify(rules.allowed_values)}`);
      console.log(`      Help text: "${field.help_text}"`);
    });

    // 5. Expected vs Actual comparison
    console.log('\n✅ Expected Prodi Names:');
    const expectedProdis = [
      { key: 'teknik-sipil', display: 'Teknik Sipil (Pengairan)' },
      { key: 'teknik-elektro', display: 'Teknik Elektro' },
      { key: 'arsitektur', display: 'Arsitektur' },
      { key: 'informatika', display: 'Informatika' },
      { key: 'perencanaan-wilayah-kota', display: 'Perencanaan Wilayah Kota' }
    ];

    expectedProdis.forEach((prodi, index) => {
      console.log(`   ${index + 1}. ${prodi.display} (${prodi.key})`);
    });

    // 6. Verification summary
    console.log('\n🎯 Verification Summary:');

    const actualProdiKeys = documents.map(d => d.prodi).sort();
    const expectedProdiKeys = expectedProdis.map(p => p.key).sort();

    const isCorrect = JSON.stringify(actualProdiKeys) === JSON.stringify(expectedProdiKeys);

    console.log(`   Database prodi keys: ${actualProdiKeys.join(', ')}`);
    console.log(`   Expected prodi keys: ${expectedProdiKeys.join(', ')}`);
    console.log(`   Status: ${isCorrect ? '✅ CORRECT' : '❌ MISMATCH'}`);

    // 7. Template paths check
    console.log('\n📁 Template Paths Verification:');
    documents.forEach(doc => {
      const expectedPath = `templates/${doc.prodi}/kkp.docx`;
      const isPathCorrect = doc.template_path === expectedPath;
      console.log(`   ${doc.prodi}: ${isPathCorrect ? '✅' : '❌'} ${doc.template_path}`);
    });

    console.log('\n🎉 Prodi verification completed!');

  } catch (error) {
    console.error('❌ Error verifying prodi updates:', error);
    throw error;
  }
}

async function main() {
  await verifyProdiUpdate();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
