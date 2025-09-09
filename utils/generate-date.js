let moment = require('moment');
require('moment-hijri');

const getTanggalMasehi = () => {
  moment.locale('id');
  return moment().format('DD MMMM YYYY') + ' M';
};


const hijriMonths = [
  'Muharram',
  'Safar',
  'Rabiul Awal',
  'Rabiul Akhir',
  'Jumadil Awal',
  'Jumadil Akhir',
  'Rajab',
  'Syaban',
  'Ramadan',
  'Syawal',
  'Dzul Qadah',
  'Zulhijjah'
];
const arabicToLatin = (str) => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const latinNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return str.replace(/[٠-٩]/g, (d) => latinNumbers[arabicNumbers.indexOf(d)]);
};


const getTanggalHijriyah = (dateInput = null) => {
  const moment = require('moment-hijri');
  let date = dateInput ? moment(dateInput, 'iYYYY/iM/iD') : moment();
  let hijriDate = date.format('iYYYY/iM/iD');
  hijriDate = arabicToLatin(hijriDate);
  const [year, month, day] = hijriDate.split('/');
  const monthName = hijriMonths[parseInt(month) - 1];

  return `${day} ${monthName} ${year} H`;
};

const setDate = (tanggalHijriah, tanggalMasehi) => {
  return {
    tanggalHijriah: tanggalHijriah || getTanggalHijriyah(),
    tanggalMasehi: tanggalMasehi || getTanggalMasehi()
  }
}

module.exports = {
  getTanggalMasehi,
  getTanggalHijriyah,
  setDate
};
