const FormData = require('form-data');

const uploadFileToApi = async (fileBuffer, fileName, apiUrl) => {
  try {
    const formdata = new FormData();
    formdata.append("fileName", fileName);
    formdata.append("file", fileBuffer, fileName.concat('.docx'));

    const requestOptions = {
      method: "POST",
      body: formdata,
      headers: formdata.getHeaders(),
    };
    const response = await fetch(apiUrl, requestOptions);

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error uploading file to API:', error);
    throw error;
  }
};

const sendWhatsAppMessage = async (number, message) => {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    "number": number,
    "message": message,
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  try {
    const response = await fetch("https://whatsapp.devnolife.site/send-message", requestOptions);
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};
const lastNumber = async (params) => {

  try {
    const number = await fetch(`https://devnolife.site/api/no-surat/${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!number.ok) {
      throw new Error('Ada kesalahan saat mengambil data');
    }
    const result = await number.json();
    return result?.noSurat;

  } catch (error) {
    throw error;
  }
}
module.exports = {
  uploadFileToApi,
  sendWhatsAppMessage,
  lastNumber
};

