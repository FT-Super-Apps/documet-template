// prisma/seed-enhanced-fields.js - Seed data untuk field dan tabel baru yang enhanced
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedEnhancedFields() {
  try {
    console.log('🌱 Seeding enhanced fields and new tables...');

    // 1. Seed Document Categories
    console.log('📋 Seeding document categories...');
    const categories = [
      {
        name: 'Kerja Praktik',
        description: 'Dokumen surat kerja praktik dan terkait',
        color_hex: '#3B82F6',
        icon: 'briefcase',
        sort_order: 1
      },
      {
        name: 'Tugas Akhir',
        description: 'Dokumen surat tugas akhir dan skripsi',
        color_hex: '#10B981',
        icon: 'academic-cap',
        sort_order: 2
      },
      {
        name: 'Bimbingan',
        description: 'Dokumen surat bimbingan akademik',
        color_hex: '#F59E0B',
        icon: 'user-group',
        sort_order: 3
      },
      {
        name: 'Administrasi',
        description: 'Dokumen administrasi umum',
        color_hex: '#8B5CF6',
        icon: 'clipboard-list',
        sort_order: 4
      },
      {
        name: 'Sertifikat',
        description: 'Dokumen sertifikat dan penghargaan',
        color_hex: '#EF4444',
        icon: 'badge-check',
        sort_order: 5
      }
    ];

    for (const category of categories) {
      await prisma.document_categories.upsert({
        where: { name: category.name },
        update: category,
        create: category
      });
    }
    console.log('✅ Document categories seeded successfully');

    // 2. Update existing document fields dengan field baru
    console.log('📝 Updating existing document fields with enhanced data...');

    const fieldUpdates = [
      {
        field_name: 'kepada',
        validation_rules: JSON.stringify({
          minLength: 5,
          maxLength: 200,
          pattern: '^[A-Za-z0-9\\s\\.,\\-]+$'
        }),
        help_text: 'Nama perusahaan atau instansi tujuan kerja praktik',
        display_order: 1
      },
      {
        field_name: 'tempat_tujuan',
        validation_rules: JSON.stringify({
          minLength: 3,
          maxLength: 100,
          required_format: 'city_name'
        }),
        help_text: 'Kota atau lokasi tempat kerja praktik dilakukan',
        display_order: 2
      },
      {
        field_name: 'nama_prodi',
        validation_rules: JSON.stringify({
          allowed_values: ['Informatika', 'Teknik Elektro', 'Arsitektur', 'Teknik Sipil (Pengairan)', 'Perencanaan Wilayah Kota']
        }),
        help_text: 'Nama program studi mahasiswa',
        display_order: 3
      },
      {
        field_name: 'tanggal_hijriyah',
        validation_rules: JSON.stringify({
          format: 'hijriyah_date',
          auto_generate: true
        }),
        help_text: 'Tanggal dalam kalender Hijriyah (otomatis dari tanggal Masehi)',
        display_order: 4
      },
      {
        field_name: 'tanggal_masehi',
        validation_rules: JSON.stringify({
          format: 'YYYY-MM-DD',
          future_only: false,
          default_today: true
        }),
        help_text: 'Tanggal dalam kalender Masehi',
        display_order: 5
      },
      {
        field_name: 'tableData',
        validation_rules: JSON.stringify({
          min_rows: 1,
          max_rows: 20,
          required_columns: ['nama', 'nim', 'semester'],
          column_validation: {
            nama: { minLength: 2, maxLength: 100 },
            nim: { pattern: '^[0-9]{7,10}$' },
            semester: { min: 1, max: 14, type: 'number' }
          }
        }),
        help_text: 'Tabel data mahasiswa yang melakukan kerja praktik',
        display_order: 6
      }
    ];

    for (const fieldUpdate of fieldUpdates) {
      await prisma.document_fields.updateMany({
        where: { field_name: fieldUpdate.field_name },
        data: {
          validation_rules: fieldUpdate.validation_rules,
          help_text: fieldUpdate.help_text,
          display_order: fieldUpdate.display_order,
          updated_at: new Date()
        }
      });
    }
    console.log('✅ Document fields updated with enhanced data');

    // 3. Seed Document Templates untuk setiap dokumen yang ada
    console.log('📄 Seeding document templates...');

    const documents = await prisma.documents.findMany();

    for (const doc of documents) {
      // Template utama (default)
      await prisma.document_templates.upsert({
        where: {
          document_id_template_name: {
            document_id: doc.id,
            template_name: 'Template Utama'
          }
        },
        update: {
          file_path: doc.template_path || `templates/${doc.prodi}/${doc.type}.docx`,
          is_default: true,
          updated_at: new Date()
        },
        create: {
          document_id: doc.id,
          template_name: 'Template Utama',
          file_path: doc.template_path || `templates/${doc.prodi}/${doc.type}.docx`,
          file_type: 'docx',
          is_default: true
        }
      });

      // Template alternatif
      await prisma.document_templates.upsert({
        where: {
          document_id_template_name: {
            document_id: doc.id,
            template_name: 'Template Alternatif'
          }
        },
        update: {
          file_path: `templates/${doc.prodi}/${doc.type}_alt.docx`,
          is_default: false,
          updated_at: new Date()
        },
        create: {
          document_id: doc.id,
          template_name: 'Template Alternatif',
          file_path: `templates/${doc.prodi}/${doc.type}_alt.docx`,
          file_type: 'docx',
          is_default: false
        }
      });
    }
    console.log('✅ Document templates seeded successfully');

    // 4. Update existing signers dengan field baru
    console.log('👥 Updating existing signers with enhanced data...');

    const signers = await prisma.signers.findMany();
    const emailDomains = ['unismuh.ac.id', 'ft.unismuh.ac.id'];
    const positionTitles = {
      'dosen_pembimbing': 'Dosen Pembimbing Kerja Praktik',
      'ketua_prodi': 'Ketua Program Studi',
      'dekan': 'Dekan Fakultas Teknik',
      'koordinator_kkp': 'Koordinator Kerja Praktik'
    };

    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      const emailDomain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
      const email = signer.nip ? `${signer.nip}@${emailDomain}` : `${signer.name.toLowerCase().replace(/\s/g, '.')}@${emailDomain}`;

      await prisma.signers.update({
        where: { id: signer.id },
        data: {
          email: email,
          phone: `+62${Math.floor(Math.random() * 900000000) + 100000000}`, // Random phone number
          position_title: positionTitles[signer.role] || signer.role,
          signature_image_path: `signatures/${signer.key_id}.png`,
          updated_at: new Date()
        }
      });
    }
    console.log('✅ Signers updated with enhanced data');

    // 5. Seed sample notifications
    console.log('🔔 Seeding sample notifications...');

    const sampleNotifications = [
      {
        recipient: 'admin@unismuh.ac.id',
        title: 'Dokumen KKP Menunggu Persetujuan',
        message: 'Terdapat 3 dokumen KKP yang menunggu persetujuan dari Anda.',
        type: 'info'
      },
      {
        recipient: 'dekan@ft.unismuh.ac.id',
        title: 'Sistem Tanda Tangan Digital Aktif',
        message: 'Sistem tanda tangan digital EdDSA telah berhasil diaktifkan.',
        type: 'success'
      },
      {
        recipient: 'admin@unismuh.ac.id',
        title: 'Backup Database Berhasil',
        message: 'Backup database harian telah berhasil dilakukan pada ' + new Date().toLocaleDateString(),
        type: 'success'
      }
    ];

    for (const notification of sampleNotifications) {
      await prisma.notifications.create({
        data: notification
      });
    }
    console.log('✅ Sample notifications seeded successfully');

    // 6. Seed system config tambahan
    console.log('⚙️ Seeding additional system configuration...');

    const additionalConfigs = [
      {
        config_key: 'max_document_size_mb',
        config_value: '10',
        description: 'Maksimal ukuran dokumen yang dapat diupload (MB)'
      },
      {
        config_key: 'notification_email_enabled',
        config_value: 'true',
        description: 'Enable email notifications for document status changes'
      },
      {
        config_key: 'auto_expire_days',
        config_value: '365',
        description: 'Jumlah hari sebelum dokumen expired'
      },
      {
        config_key: 'backup_retention_days',
        config_value: '30',
        description: 'Jumlah hari retention untuk backup database'
      },
      {
        config_key: 'qr_code_size',
        config_value: '200',
        description: 'Ukuran QR code dalam pixel'
      },
      {
        config_key: 'allowed_file_types',
        config_value: 'docx,pdf,odt',
        description: 'Tipe file yang diperbolehkan untuk template'
      },
      {
        config_key: 'signature_timeout_minutes',
        config_value: '30',
        description: 'Timeout untuk proses tanda tangan dalam menit'
      }
    ];

    for (const config of additionalConfigs) {
      await prisma.system_config.upsert({
        where: { config_key: config.config_key },
        update: {
          config_value: config.config_value,
          description: config.description,
          updated_at: new Date()
        },
        create: config
      });
    }
    console.log('✅ Additional system configuration seeded successfully');

    console.log('🎉 Enhanced fields and tables seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding enhanced fields:', error);
    throw error;
  }
}

async function main() {
  await seedEnhancedFields();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
