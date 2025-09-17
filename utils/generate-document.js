const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { lastNumber } = require('../api');
const { generateQRCodeWithImage } = require('./generate-qrcode');
const { generateQRCodeWithSignature } = require('./generate-qrcode-enhanced');
const ImageModule = require('docxtemplater-image-module-free');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

    // Prefer provided QR code path (from EdDSA), fallback to enhanced QR generation
    let qrCodePath = data?.qr_code_path;
    let documentId = data?.document_id;

    if (!qrCodePath || !fs.existsSync(qrCodePath)) {
      // Generate document ID and save to database for verification
      documentId = crypto.randomUUID();
      const documentHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

      // Save basic document info to database for verification
      try {
        await prisma.signed_documents.create({
          data: {
            id: documentId,
            document_type: type,
            prodi: prodi,
            document_content: JSON.stringify(data),
            document_hash: documentHash,
            no_surat: no_surat,
            qr_code_data: '', // Will be updated after QR generation
            total_signatures_required: 0, // Basic document, no signatures required
            total_signatures_received: 0,
            is_complete: true // Basic document is immediately complete
          }
        });
      } catch (error) {
        console.warn('Failed to save document to database:', error.message);
        // Continue without database save if it fails
      }

      const verificationData = {
        version: '1.0',
        algorithm: 'Basic-Document',
        document: {
          id: documentId,
          type: type,
          prodi: prodi,
          hash: documentHash,
          no_surat: no_surat,
          timestamp: new Date().toISOString()
        },
        verification: {
          url: `${process.env.BASE_URL || 'http://localhost:8080'}/verify/${documentId}`,
          qr_generated: new Date().toISOString()
        }
      };

      const qrString = JSON.stringify(verificationData);
      const qrResult = await generateQRCodeWithSignature(qrString, {
        width: 300,
        margin: 3,
        errorCorrectionLevel: 'H'
      });
      qrCodePath = qrResult.filePath;

      // Update QR code data in database
      try {
        await prisma.signed_documents.update({
          where: { id: documentId },
          data: {
            qr_code_data: qrString,
            qr_code_image: qrCodePath
          }
        });
      } catch (error) {
        console.warn('Failed to update QR code data:', error.message);
      }
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

    // Update file path in database if document was saved
    if (documentId) {
      try {
        await prisma.signed_documents.update({
          where: { id: documentId },
          data: { file_path: outputPath }
        });
      } catch (error) {
        console.warn('Failed to update file path:', error.message);
      }
    }

    // Generate download URL
    const downloadUrl = `/download/${fileName}`;

    return {
      filePath: outputPath,
      fileName: fileName,
      downloadUrl: downloadUrl,
      no_surat: no_surat,
      documentId: documentId // Include document ID for verification
    };
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Gagal membuat dokumen: ${error.message}`);
  }
};

module.exports = generateDocument;

