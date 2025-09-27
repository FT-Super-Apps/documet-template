# Database Migration & Enhanced Fields Documentation

## 📋 Overview
Dokumentasi ini menjelaskan field-field baru yang telah ditambahkan ke database, migrasi yang dilakukan, dan data seed yang tersedia.

## 🗃️ New Fields & Tables Added

### 1. Enhanced `documents` Table
Field baru yang ditambahkan:
- `version`: Version control untuk template (default: "1.0")
- `is_active`: Status aktif template (default: true)
- `max_filesize_mb`: Maksimal ukuran file output dalam MB (default: 10)
- `updated_at`: Timestamp auto-update

### 2. Enhanced `document_fields` Table
Field baru yang ditambahkan:
- `validation_rules`: JSON untuk rules validasi (min/max length, pattern, dll)
- `help_text`: Teks bantuan untuk field (max 500 karakter)
- `display_order`: Urutan tampilan field (default: 0)
- `is_active`: Status aktif field (default: true)
- `updated_at`: Timestamp auto-update

### 3. Enhanced `signers` Table
Field baru yang ditambahkan:
- `email`: Email untuk notifikasi (unique)
- `phone`: Nomor telepon (max 20 karakter)
- `signature_image_path`: Path ke gambar tanda tangan
- `position_title`: Jabatan lengkap untuk tanda tangan
- `last_signed_at`: Kapan terakhir menandatangani

### 4. Enhanced `signed_documents` Table
Field baru yang ditambahkan:
- `file_size`: Ukuran file dalam bytes
- `created_by`: User yang membuat dokumen
- `approved_by`: User yang menyetujui
- `priority_level`: Level prioritas (urgent, high, normal, low)
- `expiry_date`: Tanggal kadaluarsa dokumen
- `status`: Status dokumen (pending, in_progress, completed, rejected, expired)
- `status_notes`: Catatan status
- `last_updated_at`: Timestamp auto-update

## 🆕 New Tables

### 1. `document_templates`
Tabel untuk template dokumen fisik:
- `id`: Primary key
- `document_id`: Foreign key ke documents
- `template_name`: Nama template
- `file_path`: Path file template
- `file_type`: Tipe file (docx, pdf, odt)
- `file_size`: Ukuran file dalam bytes
- `checksum`: Checksum untuk integritas file
- `is_default`: Template default untuk document type

### 2. `document_categories`
Tabel untuk kategori dokumen:
- `id`: Primary key
- `name`: Nama kategori (unique)
- `description`: Deskripsi kategori
- `color_hex`: Warna untuk UI (default: #3B82F6)
- `icon`: Nama icon untuk UI
- `sort_order`: Urutan tampilan
- `is_active`: Status aktif kategori

### 3. `document_history`
Tabel untuk history perubahan dokumen:
- `id`: Primary key
- `signed_doc_id`: Foreign key ke signed_documents
- `action`: Jenis aksi (created, signed, updated, rejected, completed)
- `description`: Deskripsi aksi
- `performed_by`: User yang melakukan aksi
- `ip_address`: IP address user
- `user_agent`: Browser/app info
- `metadata`: Additional data dalam JSON format

### 4. `notifications`
Tabel untuk notifikasi sistem:
- `id`: Primary key
- `recipient`: Email atau user ID
- `title`: Judul notifikasi
- `message`: Isi pesan
- `type`: Tipe notifikasi (info, warning, error, success)
- `is_read`: Status baca
- `read_at`: Waktu dibaca
- `related_doc_id`: Optional FK ke signed_documents

### 5. `audit_logs`
Tabel untuk audit log:
- `id`: Primary key
- `table_name`: Nama table yang diubah
- `record_id`: ID record yang diubah
- `operation`: Operasi (INSERT, UPDATE, DELETE)
- `old_values`: JSON nilai lama
- `new_values`: JSON nilai baru
- `user_info`: Info user yang melakukan perubahan
- `ip_address`: IP address

## 🌱 Seed Data Available

### 1. Basic Seeding (`node prisma/seed.js`)
- Documents and fields untuk semua prodi
- EdDSA signers system
- Document signature configuration

### 2. Enhanced Fields Seeding (`node prisma/seed-enhanced-fields.js`)
- Document categories (5 categories)
- Enhanced validation rules untuk semua fields
- Document templates untuk setiap document
- Enhanced signer data (email, phone, position_title)
- Sample notifications
- Additional system configuration

### 3. Audit History Seeding (`node prisma/seed-audit-history.js`)
- Document history records
- Audit log entries
- Enhanced signed document status
- Realistic notifications based on document status

## 🚀 Migration Commands

### 1. Run Migration
```bash
cd generate-document-api
npx prisma migrate dev --name "add-enhanced-fields-and-new-tables"
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run All Seeding
```bash
# Basic seeding (automatically runs on migrate)
node prisma/seed.js

# Enhanced features seeding
node prisma/seed-enhanced-fields.js
node prisma/seed-eddsa-system.js
node prisma/seed-audit-history.js
```

### 4. Test Database Content
```bash
node test-database-content.js
```

## 📊 Database Schema Summary

### Total Tables: 12
1. `documents` (enhanced)
2. `document_fields` (enhanced) 
3. `document_templates` (new)
4. `document_categories` (new)
5. `signers` (enhanced)
6. `signed_documents` (enhanced)
7. `document_signatures` (existing)
8. `verification_logs` (existing)
9. `document_signature_config` (existing)
10. `document_history` (new)
11. `notifications` (new)
12. `audit_logs` (new)
13. `system_config` (existing)

### New Features Enabled:
- ✅ Document versioning and template management
- ✅ Field validation rules and help text
- ✅ Enhanced signer profiles with contact information
- ✅ Document status tracking and workflow
- ✅ Comprehensive audit logging
- ✅ Real-time notifications system
- ✅ Document categorization
- ✅ File integrity checking
- ✅ Priority and expiry management

## 🔧 Configuration

### System Configuration Keys Added:
- `max_document_size_mb`: Maksimal ukuran dokumen (10 MB)
- `notification_email_enabled`: Enable email notifications (true)
- `auto_expire_days`: Auto expire documents (365 days)
- `backup_retention_days`: Backup retention (30 days)
- `qr_code_size`: QR code size in pixels (200px)
- `allowed_file_types`: Allowed template file types (docx,pdf,odt)
- `signature_timeout_minutes`: Signature timeout (30 minutes)

## 📝 Usage Examples

### Query Enhanced Fields
```javascript
// Get document with enhanced fields and templates
const document = await prisma.documents.findUnique({
  where: { id: 1 },
  include: {
    document_fields: {
      where: { is_active: true },
      orderBy: { display_order: 'asc' }
    },
    document_templates: {
      where: { is_default: true }
    }
  }
});

// Get signer with full profile
const signer = await prisma.signers.findUnique({
  where: { id: 1 },
  select: {
    name: true,
    nip: true,
    email: true,
    phone: true,
    position_title: true,
    signature_image_path: true,
    last_signed_at: true
  }
});

// Get document with full history
const signedDoc = await prisma.signed_documents.findUnique({
  where: { id: "uuid" },
  include: {
    document_history: {
      orderBy: { created_at: 'desc' }
    },
    document_signatures: {
      include: {
        signer: {
          select: { name: true, position_title: true }
        }
      }
    }
  }
});
```

## 🎉 Migration Completed Successfully!

Database telah berhasil di-migrate dengan:
- **Field baru** untuk fitur enhanced
- **5 tabel baru** untuk fitur advanced
- **Data seed lengkap** untuk development
- **System configuration** yang dapat dikonfigurasi
- **Audit logging** untuk tracking perubahan

Semua fitur siap digunakan untuk development dan production!
