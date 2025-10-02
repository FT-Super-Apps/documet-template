# 🚀 Setup Guide - Digital Document Signature

## ✅ Sistem Sudah Lengkap!

Aplikasi Digital Document Signature dengan EdDSA dan QR Code untuk 3 jenis dokumen:
- **KKP** (1 penandatangan)
- **Persetujuan Hasil** (3 penandatangan)  
- **KRS** (2 penandatangan)
- **KHS** (2 penandatangan)

## 📋 Yang Perlu Dilakukan

### 1. Buat Template Word (.docx)

Buat 4 file template di folder `templates/`:

#### a) **templates/kkp.docx**
```
==========================================
    SURAT KETERANGAN KERJA PRAKTIK
==========================================

[Isi surat KKP...]

Mengetahui,
Ketua Program Studi

{qrCode}  ← Letakkan tag ini

_________________________
Dr. Ir. Ar. Irnawaty Idrus...
```

#### b) **templates/persetujuan.docx**
```
==========================================
       PERSETUJUAN HASIL PENELITIAN
==========================================

[Isi persetujuan...]

Pembimbing 1         Pembimbing 2         Kaprodi
{qrCode1}           {qrCode2}           {qrCode3}
```

#### c) **templates/krs.docx**
```
==========================================
      KARTU RENCANA STUDI (KRS)
==========================================

[Isi KRS...]

Dosen PA                    Kaprodi
{qrCode1}                  {qrCode2}
```

#### d) **templates/khs.docx**
```
==========================================
      KARTU HASIL STUDI (KHS)
==========================================

[Isi KHS...]

Dosen PA                    Kaprodi
{qrCode1}                  {qrCode2}
```

### 2. Jalankan Aplikasi

Server sudah running di: **http://localhost:8080**

```bash
npm start
```

## 🎯 Cara Pakai

1. **Buka:** http://localhost:8080
2. **Pilih** jenis dokumen (KKP/Persetujuan/KRS/KHS)
3. **Isi** data penandatangan (sudah ada default)
4. **Klik** "Generate & Sign Document"
5. **Download** dokumen dengan QR Code
6. **Scan QR** untuk verifikasi

## 🔐 Fitur Keamanan

✅ **EdDSA (Ed25519)** - Setiap TTD punya keypair unik
✅ **Multiple QR Codes** - 1 QR per penandatangan
✅ **Validasi Otomatis** - Verifikasi dengan public key
✅ **Backward Compatible** - Support dokumen lama

## 📁 Struktur Database

```json
{
  "document_types": [...],
  "signed_documents": [
    {
      "id": "uuid",
      "document_type": "kkp",
      "signatures": [
        {
          "signer_name": "...",
          "signer_nip": "...",
          "signature": "...",
          "public_key": "...",
          "algorithm": "Ed25519"
        }
      ]
    }
  ]
}
```

## 🧪 Testing

### Test Endpoints:
```bash
# Document types
curl http://localhost:8080/api/document-types

# Health check
curl http://localhost:8080/health

# Verify document
curl http://localhost:8080/verify-document/<doc_id>
```

## 📝 Catatan Penting

1. **Tag QR Code:**
   - 1 TTD: `{qrCode}`
   - 2+ TTD: `{qrCode1}` `{qrCode2}` `{qrCode3}`

2. **Template Location:**
   - Harus di folder `templates/`
   - Format: `.docx` (Word)
   - Nama sesuai `template_path` di `db.json`

3. **QR Code Verification:**
   - Format: `/verify?id=<doc_id>&signer=<index>`
   - Scan QR → Auto highlight penandatangan yang sesuai

4. **Validasi:**
   - Frontend: Form validation
   - Backend: Signature verification dengan EdDSA
   - Database: Backward compatibility

## 🎨 Customization

Edit `db.json` untuk mengubah:
- Nama penandatangan default
- Jumlah penandatangan
- Label posisi/jabatan
- Template path

## ⚡ Next Steps

1. ✅ Buat template Word
2. ✅ Test generate dokumen
3. ✅ Test scan QR Code
4. ✅ Verifikasi signature validation
5. ⚙️ Deploy ke production (optional)

---

**Server Status:** 🟢 Running on http://localhost:8080
**Version:** 2.0.0
**Algorithm:** EdDSA (Ed25519)
