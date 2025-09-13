// simple-test.js
const http = require('http');

const testData = JSON.stringify({
  kepada: 'PT. Testing Indonesia',
  tempat_tujuan: 'Jakarta',
  nama_prodi: 'Teknik Informatika',
  tanggal_hijriyah: '15 Rajab 1446 H',
  tanggal_masehi: '15 Januari 2025',
  tableData: [{
    nama: 'John Doe KKP',
    nim: '12345678',
    semester: '7'
  }]
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/eddsa-document/informatika/kkp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🧪 Testing KKP document generation...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);

  res.setEncoding('utf8');
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('✅ Response:', JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('❌ Raw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
});

// Write data to request body
req.write(testData);
req.end();
