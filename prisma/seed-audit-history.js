// prisma/seed-audit-history.js - Seed data untuk audit logs dan document history
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAuditHistory() {
  try {
    console.log('🔍 Seeding audit logs and document history...');

    // 1. Seed sample document history untuk existing signed documents
    console.log('📚 Seeding document history...');

    const signedDocs = await prisma.signed_documents.findMany({
      take: 5 // Ambil 5 dokumen pertama saja untuk contoh
    });

    for (const doc of signedDocs) {
      // History: Document created
      await prisma.document_history.create({
        data: {
          signed_doc_id: doc.id,
          action: 'created',
          description: `Dokumen ${doc.document_type} untuk ${doc.prodi} berhasil dibuat`,
          performed_by: 'system@unismuh.ac.id',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          metadata: JSON.stringify({
            document_type: doc.document_type,
            prodi: doc.prodi,
            auto_generated: true
          })
        }
      });

      // History: First signature (if complete)
      if (doc.is_complete && doc.total_signatures_received > 0) {
        await prisma.document_history.create({
          data: {
            signed_doc_id: doc.id,
            action: 'signed',
            description: 'Dokumen ditandatangani oleh Dosen Pembimbing',
            performed_by: 'dosen.pembimbing@ft.unismuh.ac.id',
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            metadata: JSON.stringify({
              signature_order: 1,
              role: 'dosen_pembimbing',
              signature_method: 'eddsa'
            }),
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 hari lalu
          }
        });

        // History: Second signature
        if (doc.total_signatures_received > 1) {
          await prisma.document_history.create({
            data: {
              signed_doc_id: doc.id,
              action: 'signed',
              description: 'Dokumen ditandatangani oleh Ketua Program Studi',
              performed_by: 'ketua.prodi@ft.unismuh.ac.id',
              ip_address: '192.168.1.101',
              user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              metadata: JSON.stringify({
                signature_order: 2,
                role: 'ketua_prodi',
                signature_method: 'eddsa'
              }),
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 hari lalu
            }
          });
        }

        // History: Final signature and completion
        if (doc.total_signatures_received >= doc.total_signatures_required) {
          await prisma.document_history.create({
            data: {
              signed_doc_id: doc.id,
              action: 'signed',
              description: 'Dokumen ditandatangani oleh Dekan - Tanda tangan terakhir',
              performed_by: 'dekan@ft.unismuh.ac.id',
              ip_address: '192.168.1.102',
              user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
              metadata: JSON.stringify({
                signature_order: 3,
                role: 'dekan',
                signature_method: 'eddsa',
                final_signature: true
              }),
              created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 jam lalu
            }
          });

          await prisma.document_history.create({
            data: {
              signed_doc_id: doc.id,
              action: 'completed',
              description: 'Dokumen berhasil diselesaikan dengan semua tanda tangan lengkap',
              performed_by: 'system@unismuh.ac.id',
              ip_address: '127.0.0.1',
              user_agent: 'System Process',
              metadata: JSON.stringify({
                total_signatures: doc.total_signatures_received,
                completion_time: new Date().toISOString(),
                auto_completed: true
              }),
              created_at: new Date(Date.now() - 11 * 60 * 60 * 1000) // 11 jam lalu
            }
          });
        }
      }
    }
    console.log('✅ Document history seeded successfully');

    // 2. Seed sample audit logs
    console.log('📊 Seeding audit logs...');

    const auditLogSamples = [
      {
        table_name: 'documents',
        record_id: '1',
        operation: 'UPDATE',
        old_values: JSON.stringify({
          version: '1.0',
          max_filesize_mb: 5,
          updated_at: '2025-09-20T10:00:00Z'
        }),
        new_values: JSON.stringify({
          version: '1.1',
          max_filesize_mb: 10,
          updated_at: '2025-09-23T07:15:00Z'
        }),
        user_info: 'admin@unismuh.ac.id',
        ip_address: '192.168.1.10',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 hari lalu
      },
      {
        table_name: 'signers',
        record_id: '2',
        operation: 'UPDATE',
        old_values: JSON.stringify({
          email: null,
          phone: null,
          signature_image_path: null
        }),
        new_values: JSON.stringify({
          email: 'ketua.prodi@ft.unismuh.ac.id',
          phone: '+6281234567890',
          signature_image_path: 'signatures/abc123.png'
        }),
        user_info: 'ketua.prodi@ft.unismuh.ac.id',
        ip_address: '192.168.1.101',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 hari lalu
      },
      {
        table_name: 'system_config',
        record_id: 'max_document_size_mb',
        operation: 'INSERT',
        old_values: null,
        new_values: JSON.stringify({
          config_key: 'max_document_size_mb',
          config_value: '10',
          description: 'Maksimal ukuran dokumen yang dapat diupload (MB)'
        }),
        user_info: 'system@unismuh.ac.id',
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 hari lalu
      },
      {
        table_name: 'document_fields',
        record_id: '5',
        operation: 'UPDATE',
        old_values: JSON.stringify({
          validation_rules: null,
          help_text: null,
          display_order: null
        }),
        new_values: JSON.stringify({
          validation_rules: '{"minLength":3,"maxLength":100}',
          help_text: 'Kota atau lokasi tempat kerja praktik dilakukan',
          display_order: 2
        }),
        user_info: 'admin@unismuh.ac.id',
        ip_address: '192.168.1.10',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 jam lalu
      },
      {
        table_name: 'signed_documents',
        record_id: signedDocs[0]?.id || 'sample-uuid-123',
        operation: 'UPDATE',
        old_values: JSON.stringify({
          status: 'pending',
          total_signatures_received: 0,
          is_complete: false
        }),
        new_values: JSON.stringify({
          status: 'completed',
          total_signatures_received: 3,
          is_complete: true
        }),
        user_info: 'system@unismuh.ac.id',
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 jam lalu
      }
    ];

    for (const auditLog of auditLogSamples) {
      await prisma.audit_logs.create({
        data: auditLog
      });
    }
    console.log('✅ Audit logs seeded successfully');

    // 3. Update signed documents dengan status dan metadata baru
    console.log('📋 Updating signed documents with enhanced status...');

    const statusOptions = ['pending', 'in_progress', 'completed', 'rejected'];
    const priorityOptions = ['low', 'normal', 'high', 'urgent'];
    const createdByOptions = [
      'admin@unismuh.ac.id',
      'sekretariat@ft.unismuh.ac.id',
      'koordinator.kkp@ft.unismuh.ac.id'
    ];

    for (const doc of signedDocs) {
      const randomStatus = doc.is_complete ? 'completed' : statusOptions[Math.floor(Math.random() * statusOptions.length)];
      const randomPriority = priorityOptions[Math.floor(Math.random() * priorityOptions.length)];
      const randomCreatedBy = createdByOptions[Math.floor(Math.random() * createdByOptions.length)];

      // Set expiry date 1 year from now
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await prisma.signed_documents.update({
        where: { id: doc.id },
        data: {
          status: randomStatus,
          priority_level: randomPriority,
          created_by: randomCreatedBy,
          approved_by: randomStatus === 'completed' ? 'dekan@ft.unismuh.ac.id' : null,
          expiry_date: expiryDate,
          file_size: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
          status_notes: randomStatus === 'rejected' ? 'Dokumen perlu diperbaiki format tabelnya' :
            randomStatus === 'completed' ? 'Dokumen berhasil diselesaikan dengan semua approval' : null,
          last_updated_at: new Date()
        }
      });
    }
    console.log('✅ Signed documents updated with enhanced status');

    // 4. Seed more realistic notifications based on document status
    console.log('🔔 Seeding realistic notifications...');

    const recentDocs = await prisma.signed_documents.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 hari terakhir
        }
      },
      take: 3
    });

    for (const doc of recentDocs) {
      await prisma.notifications.create({
        data: {
          recipient: 'admin@unismuh.ac.id',
          title: `Status Dokumen ${doc.document_type.toUpperCase()} - ${doc.prodi}`,
          message: `Dokumen dengan nomor surat ${doc.no_surat} telah ${doc.status === 'completed' ? 'diselesaikan' : 'diperbarui statusnya'}`,
          type: doc.status === 'completed' ? 'success' : 'info',
          related_doc_id: doc.id,
          created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Random dalam 24 jam terakhir
        }
      });
    }

    console.log('✅ Realistic notifications seeded successfully');
    console.log('🎉 Audit history seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding audit history:', error);
    throw error;
  }
}

async function main() {
  await seedAuditHistory();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
