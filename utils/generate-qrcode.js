const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const generateQRCodeWithImage = async (data) => {
  try {
    const qrCodeDir = path.resolve(__dirname, '../templates/qr-code');
    const qrOutputPath = path.join(qrCodeDir, 'qr-code.png');

    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }

    await QRCode.toFile(qrOutputPath, data, {
      width: 300,
      margin: 2,
    });

    return qrOutputPath;
  } catch (error) {
    console.error('Error generating QR Code:', error);
    throw new Error('Gagal menghasilkan QR Code');
  }
};

module.exports = {
  generateQRCodeWithImage,
};
