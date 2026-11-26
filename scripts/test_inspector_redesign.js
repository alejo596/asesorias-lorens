const fs = require('fs');

console.log('=================================================================');
console.log('  TEST AUTOMATIZADO: REDISEÑO DEL PERFIL INSPECTOR Y CORRECCIONES');
console.log('=================================================================');

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/css/app-custom.css', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');
const apiJs = fs.readFileSync('public/js/apiService.js', 'utf8');
const caseCtrl = fs.readFileSync('controllers/caseController.js', 'utf8');

const tests = [
  // 1. Botón + Partida
  [
    'CSS .btn-add-partida con Flexbox centrado, sin float y con gap/padding estandarizados',
    css.includes('.btn-add-partida {') &&
    css.includes('display: inline-flex') &&
    css.includes('align-items: center') &&
    css.includes('justify-content: center') &&
    css.includes('gap: 6px') &&
    css.includes('.btn-add-partida .material-icons {') &&
    css.includes('float: none !important')
  ],
  [
    'HTML de + Partida estructurado con <button>, icono sin .left y <span>',
    html.includes('<button type="button" class="btn btn-add-partida') &&
    html.includes('<i class="material-icons" aria-hidden="true">add_circle</i>') &&
    html.includes('<span>+ Partida</span>')
  ],
  [
    'Regla de ocultamiento de + Partida global para rol Inspector en CSS y JS',
    css.includes('body.is-inspector-role #topbar-btn-add-partida') &&
    js.includes("topbarBtnAdd.style.setProperty('display', 'none', 'important')")
  ],
  [
    '+ Partida disponible dentro de expediente seleccionado (subtab-danos)',
    html.includes('id="inspection-btn-add-partida"') &&
    html.includes('onclick="openAddDamageModalFromInspection()"')
  ],

  // 2. Navegación restringida del Inspector
  [
    'Menú Inspector incluye Mi Dashboard, Mis Expedientes, Mi Perfil, Cerrar Sesión',
    html.includes('id="sidebar-item-dashboard"') &&
    html.includes('id="sidebar-item-inspector-expedientes"') &&
    html.includes('id="sidebar-item-inspector-profile"') &&
    html.includes('id="sidebar-item-inspector-logout"')
  ],
  [
    'Módulos administrativos globales ocultos para Inspector',
    js.includes('document.querySelectorAll(\'.sidebar-admin-only\').forEach((element) => {') &&
    js.includes('element.style.display = isInspector ? \'none\' : \'\';')
  ],
  [
    'Control estricto en switchTab() bloqueando módulos globales a Inspector con alerta',
    js.includes("const forbiddenGlobalForInspector = ['tab-presupuesto', 'tab-danos', 'tab-fotos', 'tab-snapshots', 'tab-admin']") &&
    js.includes('Swal.fire({')
  ],

  // 3. Dashboard Exclusivo del Inspector
  [
    'Título "Panel de Inspección" y subtítulo "Gestión de expedientes e inspecciones asignadas"',
    html.includes('Panel de Inspección') &&
    html.includes('Gestión de expedientes e inspecciones asignadas.')
  ],
  [
    '6 KPIs reales del inspector presentes en el HTML',
    html.includes('id="inspector-kpi-total-casos"') &&
    html.includes('id="inspector-kpi-casos-pendientes"') &&
    html.includes('id="inspector-kpi-casos-proceso"') &&
    html.includes('id="inspector-kpi-casos-completados"') &&
    html.includes('id="inspector-kpi-partidas"') &&
    html.includes('id="inspector-kpi-fotos"')
  ],
  [
    'Bloque de Acciones Rápidas con las 5 operaciones requeridas',
    html.includes('ACCIONES RÁPIDAS') &&
    html.includes('onclick="quickActionVerExpedientes()"') &&
    html.includes('onclick="quickActionContinuarInspeccion()"') &&
    html.includes('onclick="quickActionRegistrarDano()"') &&
    html.includes('onclick="quickActionAdjuntarFotos()"') &&
    html.includes('onclick="quickActionConsultarSectores()"')
  ],
  [
    'Lógica de Acciones Rápidas con validación de caso y SweetAlert2',
    js.includes('function quickActionVerExpedientes()') &&
    js.includes('async function quickActionContinuarInspeccion()') &&
    js.includes('async function quickActionRegistrarDano()') &&
    js.includes('async function quickActionAdjuntarFotos()') &&
    js.includes('async function quickActionConsultarSectores()') &&
    js.includes('async function promptSelectAssignedCase(')
  ],

  // 4. DataTable de Expedientes Asignados
  [
    'DataTable con cabeceras ordenables por columna (Código, Siniestro, Cliente, Fecha, Estado, Avance)',
    html.includes('sortable-th') &&
    html.includes('data-col="codigo"') &&
    html.includes('data-col="numero_siniestro"') &&
    html.includes('data-col="cliente_nombre"') &&
    html.includes('data-col="fecha_visita"') &&
    html.includes('data-col="estado"') &&
    html.includes('data-col="avance_porcentaje"')
  ],
  [
    'Controles de filtro por fecha Desde y Hasta en la barra del DataTable',
    html.includes('id="inspector-case-date-from"') &&
    html.includes('id="inspector-case-date-to"') &&
    html.includes('onchange="filterInspectorCasesByDate()"')
  ],
  [
    'Lógica de ordenamiento y filtrado por fecha en JavaScript',
    js.includes('function sortInspectorCasesBy(column)') &&
    js.includes('function filterInspectorCasesByDate()') &&
    js.includes('function resetInspectorCaseDateFilter()')
  ],
  [
    'Acciones por expediente implementadas (Ver, Continuar, + Daño, Fotos)',
    js.includes("openInspectorCase('${c.id}', 'subtab-info')") &&
    js.includes("openInspectorCase('${c.id}', 'subtab-danos')") &&
    js.includes("openInspectorCaseAndAddDamage('${c.id}')") &&
    js.includes("openInspectorCase('${c.id}', 'subtab-fotos')")
  ],
  [
    'Soporte backend para dateFrom, dateTo, sortBy y sortOrder seguro en PostgreSQL',
    caseCtrl.includes('const dateFrom = (req.query.dateFrom || \'\').trim()') &&
    caseCtrl.includes('const dateTo = (req.query.dateTo || \'\').trim()') &&
    caseCtrl.includes('allowedSortColumns') &&
    caseCtrl.includes('c.fecha_visita >=')
  ],
  [
    'ApiService transmite dateFrom, dateTo, sortBy y sortOrder al endpoint /cases/assigned',
    apiJs.includes('if (params.dateFrom) query.append(\'dateFrom\', params.dateFrom);') &&
    apiJs.includes('if (params.dateTo) query.append(\'dateTo\', params.dateTo);') &&
    apiJs.includes('if (params.sortBy) query.append(\'sortBy\', params.sortBy);') &&
    apiJs.includes('if (params.sortOrder) query.append(\'sortOrder\', params.sortOrder);')
  ],

  // 5. Preservación de Webmaster y Administrador
  [
    'Webmaster preserva facultades administrativas en canUseAdminModule',
    js.includes("currentUser.rol === 'admin' || currentUser.rol === 'supervisor' || currentUser.rol === 'webmaster'")
  ]
];

let failed = 0;
tests.forEach(([desc, passed]) => {
  if (passed) {
    console.log(`✓ ${desc}`);
  } else {
    console.error(`✗ FALLÓ: ${desc}`);
    failed++;
  }
});

console.log('=================================================================');
if (failed === 0) {
  console.log(`¡ÉXITO TOTAL! Las ${tests.length} comprobaciones de rediseño pasaron (100% OK).`);
  console.log('=================================================================');
  process.exit(0);
} else {
  console.error(`Se detectaron ${failed} fallos de validación.`);
  console.log('=================================================================');
  process.exit(1);
}
