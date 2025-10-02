# 📁 Templates Directory

## Struktur Folder

```
templates/
├── kkp/
│   ├── README.md       → Panduan template KKP
│   └── kkp.docx        → Upload template di sini
├── persetujuan/
│   ├── README.md       → Panduan template Persetujuan
│   └── persetujuan.docx → Upload template di sini
├── khs/
│   ├── README.md       → Panduan template KHS
│   └── khs.docx        → Upload template di sini
├── output/             → Generated documents (auto)
└── qr-code/            → Temporary QR codes (auto)
```

## 🎯 Cara Upload Template

### Opsi 1: Upload ke Subfolder (RECOMMENDED)
Upload template Word ke folder masing-masing:
- `templates/kkp/kkp.docx`
- `templates/persetujuan/persetujuan.docx`
- `templates/khs/khs.docx`

### Opsi 2: Upload ke Root Templates
Langsung upload ke folder `templates/`:
- `templates/kkp.docx`
- `templates/persetujuan.docx`
- `templates/khs.docx`

## 📝 Tag QR Code

### KKP (1 penandatangan)
```
{qrCode}
```

### Persetujuan Hasil (3 penandatangan)
```
{qrCode1}  {qrCode2}  {qrCode3}
```

### KHS (2 penandatangan)
```
{qrCode1}  {qrCode2}
```

## ⚙️ Update Template Path (Jika Perlu)

Jika upload ke subfolder, update `db.json`:

```json
{
  "document_types": [
    {
      "id": "kkp",
      "template_path": "templates/kkp/kkp.docx"  // Ubah ini
    }
  ]
}
```

## ✅ Checklist

- [ ] Upload template KKP dengan tag `{qrCode}`
- [ ] Upload template Persetujuan dengan tag `{qrCode1}` `{qrCode2}` `{qrCode3}`
- [ ] Upload template KHS dengan tag `{qrCode1}` `{qrCode2}`
- [ ] Test generate dokumen
- [ ] Test scan QR Code
- [ ] Test verifikasi signature

## 📚 Dokumentasi Lengkap

Lihat panduan detail di setiap subfolder:
- `templates/kkp/README.md`
- `templates/persetujuan/README.md`
- `templates/khs/README.md`
