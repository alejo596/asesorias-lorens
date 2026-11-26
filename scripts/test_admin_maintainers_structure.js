const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/css/app-custom.css', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

console.log('=====================================================');
console.log('  TEST: MODO ADMINISTRADOR ACTIVO & MANTENEDORES');
console.log('=====================================================');

const tests = [
  ['Desktop bar tiene Dashboard Gerencial activo por defecto', html.includes('href="#tab-dashboard"') && html.includes('class="active" href="#tab-dashboard"')],
  ['Desktop bar tiene Módulo Admin', html.includes('href="#tab-admin"')],
  ['Desktop bar contiene botón dropdown de Mantenedores de Datos', html.includes('dropdown-mantenedores-terreno')],
  ['Módulo Admin contiene panel de Mantenedores de Terreno', html.includes('Mantenedores de Datos de Operaciones de Terreno')],
  ['Mantenedor Partidas tiene return bar', html.includes('MANTENEDOR DE DATOS DE TERRENO · PARTIDAS Y ACTA OFICIAL')],
  ['Mantenedor Levantamiento tiene return bar', html.includes('MANTENEDOR DE DATOS DE TERRENO · LEVANTAMIENTO GEOMÉTRICO')],
  ['Mantenedor Evidencias tiene return bar', html.includes('MANTENEDOR DE DATOS DE TERRENO · EVIDENCIAS FOTOGRÁFICAS')],
  ['Mantenedor Snapshots tiene return bar', html.includes('MANTENEDOR DE DATOS DE TERRENO · SNAPSHOTS INMUTABLES')],
  ['CSS contiene clases admin-top-nav-container y maintainer-top-bar', css.includes('.admin-top-nav-container') && css.includes('.maintainer-top-bar')],
  ['JS conmuta a tab-dashboard al cambiar a rol admin', js.includes("switchTab('tab-dashboard')")]
];

let failed = 0;
tests.forEach(([desc, res]) => {
  if (res) {
    console.log(`✓ ${desc}`);
  } else {
    console.error(`✗ ${desc}`);
    failed++;
  }
});

console.log('=====================================================');
if (failed === 0) {
  console.log('  ¡TODAS LAS PRUEBAS DE MODO ADMIN PASARON (100% OK)!');
  console.log('=====================================================');
  process.exit(0);
} else {
  console.error(`  ${failed} prueba(s) fallaron.`);
  console.log('=====================================================');
  process.exit(1);
}
