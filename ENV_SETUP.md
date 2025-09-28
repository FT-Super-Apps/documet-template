# Environment Variables Setup

## Pengaturan Environment Variables

Aplikasi ini menggunakan file `.env` untuk konfigurasi environment variables. File ini memungkinkan Anda untuk mengubah domain, port, dan URL tanpa mengubah kode.

## Setup Awal

1. **Copy file example**:
   ```bash
   cp .env.example .env
   ```

2. **Edit file .env** sesuai dengan konfigurasi Anda:
   ```bash
   nano .env
   ```

## Konfigurasi untuk Production

### Untuk domain custom (misalnya: `yourdomain.com`):

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Domain Configuration - UBAH INI UNTUK DOMAIN ANDA
DOMAIN=yourdomain.com
PROTOCOL=https

# Base URL untuk QR Code dan verifikasi - UBAH INI UNTUK DOMAIN ANDA
BASE_URL=https://yourdomain.com

# Database Configuration
DB_FILE=./db.json

# File Paths
TEMPLATE_DIR=./templates
OUTPUT_DIR=./templates/output
QR_CODE_DIR=./templates/qr-code

# Application Configuration
APP_NAME="Document Generator"
APP_VERSION="3.1.0-secure"
PRODI_NAME="Informatika"
FAKULTAS="Fakultas Teknik"
UNIVERSITAS="Universitas Example"
```

### Untuk menggunakan port berbeda:

```env
PORT=3000
BASE_URL=https://yourdomain.com:3000
```

### Untuk subdomain:

```env
DOMAIN=docs.yourdomain.com
BASE_URL=https://docs.yourdomain.com
```

## Variables Penting

| Variable | Deskripsi | Default | Contoh |
|----------|-----------|---------|---------|
| `PORT` | Port server | `8080` | `3000` |
| `DOMAIN` | Domain aplikasi | `localhost` | `yourdomain.com` |
| `PROTOCOL` | HTTP/HTTPS | `http` | `https` |
| `BASE_URL` | URL lengkap untuk QR code | `http://localhost:8080` | `https://yourdomain.com` |

## Dampak Perubahan

### BASE_URL
- **QR Code**: URL di QR code akan menggunakan BASE_URL
- **Verification**: Link verifikasi dokumen akan menggunakan BASE_URL
- **Email/Share**: URL yang dibagikan akan menggunakan BASE_URL

### Contoh QR Code URL:
- Development: `http://localhost:8080/verify?id=uuid-dokumen`
- Production: `https://yourdomain.com/verify?id=uuid-dokumen`

## Testing

1. **Start server**:
   ```bash
   npm start
   ```

2. **Test dengan curl**:
   ```bash
   curl http://localhost:8080/health
   ```

3. **Generate dokumen test**:
   ```bash
   curl -X POST http://localhost:8080/generate-document \
     -H "Content-Type: application/json" \
     -d '{"document_type": "kkp", "kepada": "Test"}'
   ```

## Security Notes

- File `.env` sudah ada di `.gitignore`
- Jangan commit file `.env` ke repository
- Gunakan `.env.example` sebagai template
- Pastikan BASE_URL menggunakan HTTPS di production