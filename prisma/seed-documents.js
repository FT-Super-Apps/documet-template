const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDocuments() {
  try {
    console.log('🌱 Seeding documents and fields...');

    // Delete existing data first
    console.log('🗑️ Deleting existing data...');
    await prisma.document_fields.deleteMany();
    await prisma.documents.deleteMany();
    console.log('✅ Existing data deleted');

    // Define document types dengan field-nya
    const documentConfigs = [
      {
        type: 'kkp',
        prodi: 'informatika',
        template_path: 'templates/informatika/kkp.docx',
        description: 'Template surat KKP untuk Program Studi Informatika',
        fields: [
          { field_name: 'kepada', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tempat_tujuan', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'nama_prodi', field_type: 'string', is_required: false, default_value: 'Informatika' },
          { field_name: 'nama_ttd', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tanggal_hijriyah', field_type: 'date_hijriyah', is_required: false, default_value: null },
          { field_name: 'tanggal_masehi', field_type: 'date_masehi', is_required: false, default_value: null },
          { field_name: 'tableData', field_type: 'table', is_required: true, default_value: null },
        ]
      },
      {
        type: 'kkp',
        prodi: 'teknik-elektro',
        template_path: 'templates/teknik-elektro/kkp.docx',
        description: 'Template surat KKP untuk Program Studi Teknik Elektro',
        fields: [
          { field_name: 'kepada', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tempat_tujuan', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'nama_prodi', field_type: 'string', is_required: false, default_value: 'Teknik Elektro' },
          { field_name: 'tanggal_hijriyah', field_type: 'date_hijriyah', is_required: false, default_value: null },
          { field_name: 'tanggal_masehi', field_type: 'date_masehi', is_required: false, default_value: null },
          { field_name: 'tableData', field_type: 'table', is_required: true, default_value: null },
        ]
      },
      {
        type: 'kkp',
        prodi: 'arsitektur',
        template_path: 'templates/arsitektur/kkp.docx',
        description: 'Template surat KKP untuk Program Studi Arsitektur',
        fields: [
          { field_name: 'kepada', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tempat_tujuan', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'nama_prodi', field_type: 'string', is_required: false, default_value: 'Arsitektur' },
          { field_name: 'tanggal_hijriyah', field_type: 'date_hijriyah', is_required: false, default_value: null },
          { field_name: 'tanggal_masehi', field_type: 'date_masehi', is_required: false, default_value: null },
          { field_name: 'tableData', field_type: 'table', is_required: true, default_value: null },
        ]
      },
      {
        type: 'kkp',
        prodi: 'teknik-sipil',
        template_path: 'templates/teknik-sipil/kkp.docx',
        description: 'Template surat KKP untuk Program Studi Teknik Sipil (Pengairan)',
        fields: [
          { field_name: 'kepada', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tempat_tujuan', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'nama_prodi', field_type: 'string', is_required: false, default_value: 'Teknik Sipil (Pengairan)' },
          { field_name: 'tanggal_hijriyah', field_type: 'date_hijriyah', is_required: false, default_value: null },
          { field_name: 'tanggal_masehi', field_type: 'date_masehi', is_required: false, default_value: null },
          { field_name: 'tableData', field_type: 'table', is_required: true, default_value: null },
        ]
      },
      {
        type: 'kkp',
        prodi: 'perencanaan-wilayah-kota',
        template_path: 'templates/perencanaan-wilayah-kota/kkp.docx',
        description: 'Template surat KKP untuk Program Studi Perencanaan Wilayah Kota',
        fields: [
          { field_name: 'kepada', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'tempat_tujuan', field_type: 'string', is_required: true, default_value: null },
          { field_name: 'nama_prodi', field_type: 'string', is_required: false, default_value: 'Perencanaan Wilayah Kota' },
          { field_name: 'tanggal_hijriyah', field_type: 'date_hijriyah', is_required: false, default_value: null },
          { field_name: 'tanggal_masehi', field_type: 'date_masehi', is_required: false, default_value: null },
          { field_name: 'tableData', field_type: 'table', is_required: true, default_value: null },
        ]
      },
    ];

    // Create documents dan fields
    for (const config of documentConfigs) {
      console.log(`Creating document: ${config.type} - ${config.prodi}`);

      // Create document
      const document = await prisma.documents.create({
        data: {
          type: config.type,
          prodi: config.prodi,
          template_path: config.template_path,
          description: config.description,
        }
      });

      // Create fields for this document
      for (const field of config.fields) {
        await prisma.document_fields.create({
          data: {
            document_id: document.id,
            field_name: field.field_name,
            field_type: field.field_type,
            is_required: field.is_required,
            default_value: field.default_value,
          }
        });
      }

      console.log(`✅ Document ${config.type} - ${config.prodi} created with ${config.fields.length} fields`);
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding documents:', error);
    throw error;
  }
}

async function main() {
  await seedDocuments();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
