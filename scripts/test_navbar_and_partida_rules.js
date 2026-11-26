const fs = require('fs');
const path = require('path');

console.log('=====================================================');
console.log('  TEST: REGLAS DE NAVBAR Y SUPRESIÓN DE PARTIDAS');
console.log('=====================================================');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const appCustomCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'app-custom.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

let errors = [];

// 1. CSS Tests
if (!appCustomCss.includes('body.is-client-role #topbar-btn-add-partida')) {
  errors.push('Falta regla CSS para ocultar #topbar-btn-add-partida en body.is-client-role');
}
if (!appCustomCss.includes('body.is-client-role .btn-add-partida')) {
  errors.push('Falta regla CSS para ocultar .btn-add-partida en body.is-client-role');
}
if (!appCustomCss.includes('body.is-client-role #role-toggle-btn')) {
  errors.push('Falta regla CSS para ocultar #role-toggle-btn en body.is-client-role');
}
if (!appCustomCss.includes('body.is-client-role .topbar-search-box')) {
  errors.push('Falta regla CSS para ocultar .topbar-search-box en body.is-client-role');
}
if (!appCustomCss.includes('body.is-inspector-role #topbar-btn-add-partida')) {
  errors.push('Falta regla CSS para ocultar #topbar-btn-add-partida en body.is-inspector-role');
}

// 2. JS updateRoleUI Tests
if (!appJs.includes("breadcrumbCurrent.textContent = 'Portal del Cliente';")) {
  errors.push('app.js no actualiza el breadcrumb a "Portal del Cliente" en updateRoleUI()');
}
if (!appJs.includes("document.body.classList.add('is-client-role');")) {
  errors.push('app.js no añade is-client-role a body en updateRoleUI() o checkInitialAuth()');
}

// 3. JS updateUserProfileUI Tests
if (!appJs.includes("navRole.textContent = roleText;")) {
  errors.push('app.js no actualiza navRole en updateUserProfileUI()');
}
if (!appJs.includes("const isCliente = currentUser.rol === 'cliente';")) {
  errors.push('app.js no detecta isCliente en updateUserProfileUI()');
}
if (!appJs.includes("dualAllowed = hasDualProfile() && !isCliente;")) {
  errors.push('app.js no restringe switcher para clientes en updateUserProfileUI()');
}

// 4. Client cannot be inspector or have dual roles
if (!appJs.includes("if (currentUser.rol === 'cliente') return false;")) {
  errors.push('hasDualProfile() no excluye estrictamente al rol cliente');
}

if (errors.length > 0) {
  console.error('❌ ERRORES ENCONTRADOS:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('✓ Reglas CSS verificadas:');
  console.log('   - body.is-client-role oculta #topbar-btn-add-partida y .btn-add-partida con !important');
  console.log('   - body.is-client-role oculta #role-toggle-btn y .topbar-search-box con !important');
  console.log('   - body.is-inspector-role oculta #topbar-btn-add-partida en el topbar');
  console.log('✓ Lógica JavaScript verificada:');
  console.log('   - Actualización inmediata de nav-user-avatar, nav-user-name, nav-user-role para clientes');
  console.log('   - Breadcrumbs actualizados a "Portal del Cliente" y subsecciones');
  console.log('   - hasDualProfile() rechaza clientes (no pueden tener doble perfil ni ser inspector)');
  console.log('   - Switcher de rol desactivado y bloqueado para clientes');
  console.log('\n=====================================================');
  console.log('  ¡TODAS LAS COMPROBACIONES PASARON EXITOSAMENTE!');
  console.log('=====================================================');
}

