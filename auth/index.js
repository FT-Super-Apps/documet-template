const validateFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !(field in data) || data[field] === undefined || data[field] === null);
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

const { sessionCodes } = require('../session');
const verifySessionCode = (req, res, next) => {
  const { sessionCode } = req.body;
  if (!sessionCode) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Kode verifikasi tidak disertakan dalam permintaan.',
    });
  }
  const sessionData = sessionCodes[sessionCode];
  if (!sessionData || new Date() > sessionData.expiry) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Kode verifikasi tidak valid atau telah kadaluarsa.',
    });
  }
  req.sessionData = sessionData.data;
  delete sessionCodes[sessionCode];

  next();
};

module.exports = {
  validateFields,
  verifySessionCode,
};
