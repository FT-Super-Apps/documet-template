# 🔐 Digital Document Signature System

Sistem tanda tangan digital untuk dokumen KKP, Persetujuan Hasil, KRS, dan KHS dengan QR Code verification.

## 📁 Struktur Folder

```
documet-template/
├── public/                 # Frontend files
│   ├── index.html         # Main application
│   └── verify.html        # Verification page
├── services/              # Business logic
│   └── signer-service.js  # Digital signature service
├── utils/                 # Utilities
│   ├── crypto-utils.js    # EdDSA cryptography
│   └── generate-qrcode.js # QR Code generator
├── templates/             # Document templates
│   ├── kkp.docx          # KKP template (1 TTD)
│   ├── persetujuan.docx  # Persetujuan template (3 TTD)
│   ├── krs.docx          # KRS template (2 TTD)
│   ├── khs.docx          # KHS template (2 TTD)
│   ├── output/           # Generated documents
│   └── qr-code/          # Temporary QR codes
├── uploads/               # Uploaded files (temp)
├── db.json               # Database
├── server.js             # Express server
└── package.json          # Dependencies
```

## 🚀 Cara Menggunakan

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env sesuai kebutuhan
```

### 3. Buat Template Word

Buat file `.docx` di folder `templates/` dengan tag QR Code:

**KKP (1 penandatangan):**
- Tag: `{qrCode}`

**Persetujuan Hasil (3 penandatangan):**
- Tag: `{qrCode1}` `{qrCode2}` `{qrCode3}`

**KRS (2 penandatangan):**
- Tag: `{qrCode1}` `{qrCode2}`

**KHS (2 penandatangan):**
- Tag: `{qrCode1}` `{qrCode2}`

### 4. Jalankan Server
```bash
npm start
```

### 5. Akses Aplikasi
- **Generate Dokumen:** http://localhost:8080
- **Verifikasi:** http://localhost:8080/verify?id=<doc_id>
- **Health Check:** http://localhost:8080/health

## 🔐 Fitur Keamanan

- ✅ **EdDSA (Ed25519)** - Algoritma kriptografi modern
- ✅ **Unique Keypair** - Setiap tanda tangan punya keypair sendiri
- ✅ **QR Code Verification** - Scan untuk verifikasi instant
- ✅ **Digital Fingerprint** - Integritas dokumen terjaga
- ✅ **Signature Validation** - Verifikasi otomatis dengan public key

## 📝 Jenis Dokumen

1. **KKP** - 1 penandatangan (Kaprodi)
2. **Persetujuan Hasil** - 3 penandatangan (Pembimbing 1, 2, Kaprodi)
3. **KRS** - 2 penandatangan (Dosen PA, Kaprodi)
4. **KHS** - 2 penandatangan (Dosen PA, Kaprodi)

## 🔧 API Endpoints

### GET /api/document-types
Mendapatkan daftar jenis dokumen

### POST /api/generate-document
Generate dokumen dengan tanda tangan digital
```json
{
  "document_type": "kkp",
  "signers": [
    {"name": "Dr. John", "nip": "123456"}
  ],
  "notes": "optional"
}
```

### GET /verify-document/:id
Verifikasi dokumen berdasarkan ID

### GET /download/:filename
Download dokumen yang sudah ditandatangani

## 📦 Dependencies

- express - Web framework
- docxtemplater - Template processor
- docxtemplater-image-module-free - Image module
- tweetnacl - EdDSA implementation
- qrcode - QR Code generator
- sharp - Image processing

## 🛡️ Security Notes

- Private keys disimpan di database (production: gunakan HSM/KMS)
- QR Code temporary files dibersihkan otomatis
- Validasi input di frontend dan backend
- CORS enabled untuk development

## 📄 License

MIT License

## 👨‍💻 Author

devnolife
