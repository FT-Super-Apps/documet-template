const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { lastNumber } = require('../api');
const { generateQRCodeWithImage } = require('./generate-qrcode');
const ImageModule = require('docxtemplater-image-module-free');

const generateDocument = async (type, prodi, data) => {
  try {
    // Use provided no_surat if available (e.g., from EdDSA flow), fallback to generator
    const no_surat = data?.no_surat ? String(data.no_surat) : await lastNumber(type);

    // Gunakan template path dari metadata jika ada, fallback ke path lama
    const templatePath = data._metadata?.template_path
      ? path.resolve(__dirname, '..', data._metadata.template_path)
      : path.resolve(__dirname, `../templates/${prodi}/${type}.docx`);

    // Cek apakah template file ada
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file tidak ditemukan: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);

    // Prefer provided QR code path (from EdDSA), fallback to legacy QR content
    let qrCodePath = data?.qr_code_path;
    if (!qrCodePath || !fs.existsSync(qrCodePath)) {
      qrCodePath = await generateQRCodeWithImage(
        `${no_surat},${data?.nama_ttd || 'Unknown'},${prodi}`
      );
    }

    const imageModuleOpts = {
      centered: true,
      fileType: 'docx',
      getImage: (tagValue) => {
        if (tagValue === 'qrCode') {
          return fs.readFileSync(qrCodePath);
        }
        throw new Error(`Tag ${tagValue} tidak dikenal`);
      },
      getSize: () => {
        return [100, 100];
      },
    };

    const imageModule = new ImageModule(imageModuleOpts);
    const doc = new Docxtemplater()
      .attachModule(imageModule)
      .loadZip(zip);

    // Hapus metadata sebelum render
    const { _metadata, ...renderData } = data;

    doc.setData({
      ...renderData,
      no_surat,
      prodi: prodi,
      qrCode: 'qrCode',
    });

    doc.render();

    const outputDir = path.resolve(__dirname, '../templates/output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const time = new Date().getTime();
    const fileName = `${prodi}_${type}_${time}.docx`;
    const outputPath = path.join(outputDir, fileName);
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buffer);

    // Generate download URL
    const downloadUrl = `/download/${fileName}`;

    return {
      filePath: outputPath,
      fileName: fileName,
      downloadUrl: downloadUrl,
      no_surat: no_surat
    };
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Gagal membuat dokumen: ${error.message}`);
  }
};

module.exports = generateDocument;

