const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { generateQRCodeWithImage } = require('./generate-qrcode');
const ImageModule = require('docxtemplater-image-module-free');

// Simple function to generate document number
function generateDocumentNumber(type) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const time = new Date().getTime().toString().slice(-3); // last 3 digits

  return `${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}/${type.toUpperCase()}/${month}${year}`;
}

const generateDocument = async (type, prodi, data) => {
  try {
    const no_surat = generateDocumentNumber(type);

    // Gunakan template path dari data jika ada, fallback ke path default
    const templatePath = data.template_path
      ? path.resolve(__dirname, '..', data.template_path)
      : path.resolve(__dirname, `../templates/${prodi}/${type}.docx`);

    // Cek apakah template file ada
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file tidak ditemukan: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);

    // Generate verification URL for QR code using environment variables
    const BASE_URL = process.env.BASE_URL || `${process.env.PROTOCOL || 'http'}://${process.env.DOMAIN || 'localhost'}:${process.env.PORT || 8080}`;
    const verificationUrl = `${BASE_URL}/verify?id=${data.doc_id || 'temp'}`;
    const qrCodePath = await generateQRCodeWithImage(verificationUrl);

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

    // Hapus template_path sebelum render
    const { template_path, ...renderData } = data;

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
    const outputPath = path.join(outputDir, `${prodi}_${type}_${time}.docx`);
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buffer);

    return { filePath: outputPath, no_surat: no_surat };
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Gagal membuat dokumen: ${error.message}`);
  }
};

module.exports = generateDocument;

