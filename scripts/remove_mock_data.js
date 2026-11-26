const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// Remove loadLocalPhotos, persistLocalPhotos, mergeLocalEvidence
const localPhotosStart = code.indexOf('function loadLocalPhotos(caseId) {');
const localPhotosEnd = code.indexOf('function photoSource(photo) {');
if (localPhotosStart !== -1 && localPhotosEnd !== -1) {
  code = code.substring(0, localPhotosStart) + code.substring(localPhotosEnd);
  console.log('Removed loadLocalPhotos, persistLocalPhotos, mergeLocalEvidence');
}

// Remove getLocalFallbackData
const fallbackStart = code.indexOf('function getLocalFallbackData() {');
const fallbackEnd = code.indexOf('// Puente para los atributos onclick del HTML estático');
if (fallbackStart !== -1 && fallbackEnd !== -1) {
  code = code.substring(0, fallbackStart) + code.substring(fallbackEnd);
  console.log('Removed getLocalFallbackData');
}

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('Done cleaning mock data!');

