const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// Fix loadCase block
const startMarker = 'async function loadCase(caseId) {';
const endMarker = '// Renderizar todos los componentes';
const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `async function loadCase(caseId) {
  try {
    const data = await ApiService.getCaseDetails(caseId);
    currentCaseData = data;
    renderAll(currentCaseData);
  } catch (err) {
    console.error('[loadCase] Error al cargar expediente desde PostgreSQL:', err.message);
    M.toast({ html: 'No fue posible cargar el expediente desde la base de datos.', classes: 'red darken-3' });
  }
}

`;
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync(appJsPath, code, 'utf8');
  console.log('Fixed loadCase in public/js/app.js');
} else {
  console.error('Markers not found!');
}

