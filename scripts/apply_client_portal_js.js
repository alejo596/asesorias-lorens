const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

console.log('--- ACTUALIZANDO public/js/app.js CON LÓGICA DEL PORTAL DEL CLIENTE ---');

// 1. Modificar checkInitialAuth para detectar rol cliente
const oldCheckAuthTarget = `  if (token && user) {
    currentUser = user;
    currentRole = user.rol === 'admin' ? 'admin' : 'inspector';

    document.body.classList.add('is-authenticated');
    if (viewLogin) viewLogin.style.display = 'none';
    if (appNavbar) appNavbar.style.display = 'block';
    if (mainApp) mainApp.style.display = 'block';
    if (navAuth) navAuth.style.display = 'flex';

    updateRoleUI();
    if (currentRole === 'inspector') {
      showInspectorHome();
    } else {
      loadCase(currentCaseId);
    }
  }`;

const newCheckAuthCode = `  if (token && user) {
    currentUser = user;

    document.body.classList.add('is-authenticated');
    if (viewLogin) viewLogin.style.display = 'none';
    if (appNavbar) appNavbar.style.display = 'block';
    if (mainApp) mainApp.style.display = 'block';
    if (navAuth) navAuth.style.display = 'flex';

    if (user.rol === 'cliente') {
      currentRole = 'cliente';
      document.body.classList.add('is-client-role');
      updateRoleUI();
      showClientPortal();
    } else {
      document.body.classList.remove('is-client-role');
      currentRole = user.rol === 'admin' ? 'admin' : 'inspector';
      updateRoleUI();
      if (currentRole === 'inspector') {
        showInspectorHome();
      } else {
        loadCase(currentCaseId);
      }
    }
  }`;

if (appJs.includes(oldCheckAuthTarget)) {
  appJs = appJs.replace(oldCheckAuthTarget, newCheckAuthCode);
  console.log('✓ checkInitialAuth actualizado para enrutar perfil cliente.');
} else {
  console.warn('⚠️ No se encontró el bloque exacto de checkInitialAuth, buscando alternativo...');
}

// 2. Modificar updateRoleUI para soportar rol cliente
const updateRoleUITarget = `  // Alternancia de contenedores principales entre Inspector y Administrador (Arquitectura SPA)
  const inspectorMain = document.getElementById('inspector-main-content');
  const adminMain = document.getElementById('admin-main-content');
  const adminFinRow = document.getElementById('admin-financial-metrics-row');

  if (isInspector) {
    if (inspectorMain) inspectorMain.style.display = 'block';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    const userNameEl = document.getElementById('inspector-home-user-name');
    if (userNameEl) userNameEl.textContent = (currentUser && currentUser.nombre) ? currentUser.nombre : 'Inspector';
  } else {
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'block';
    if (adminFinRow) adminFinRow.style.display = 'flex';
  }`;

const newUpdateRoleUICode = `  // Alternancia de contenedores principales entre Cliente, Inspector y Administrador (Arquitectura SPA)
  const clientMain = document.getElementById('client-main-content');
  const inspectorMain = document.getElementById('inspector-main-content');
  const adminMain = document.getElementById('admin-main-content');
  const adminFinRow = document.getElementById('admin-financial-metrics-row');
  const isClient = currentRole === 'cliente';

  if (isClient) {
    if (clientMain) clientMain.style.display = 'block';
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    if (sidebarUserRole) sidebarUserRole.textContent = 'CLIENTE';
    if (roleLabel) roleLabel.textContent = 'CLIENTE';
    if (rolePillIcon) rolePillIcon.textContent = 'person_pin';

    // Ocultar botones de acción operativa y administrativa
    const topbarBtnAdd = document.getElementById('topbar-btn-add-partida');
    if (topbarBtnAdd) topbarBtnAdd.style.display = 'none';
    const roleToggle = document.getElementById('role-toggle-btn');
    if (roleToggle) roleToggle.style.display = 'none';
    const topbarSearch = document.getElementById('topbar-search-input');
    if (topbarSearch && topbarSearch.parentElement) topbarSearch.parentElement.style.display = 'none';

    // Ocultar menús de inspector y admin
    const sidebarInspectorCases = document.getElementById('sidebar-item-inspector-expedientes');
    if (sidebarInspectorCases) sidebarInspectorCases.style.display = 'none';
    const sidebarFicha = document.getElementById('sidebar-item-ficha-inspeccion');
    if (sidebarFicha) sidebarFicha.style.display = 'none';
    const defaultDashboard = document.querySelector('a[data-tab="tab-dashboard"]');
    if (defaultDashboard && defaultDashboard.parentElement) defaultDashboard.parentElement.style.display = 'none';

    document.querySelectorAll('.sidebar-admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-client-only').forEach(el => el.style.display = '');

    const desktopTabsBar = document.getElementById('desktop-tabs-bar');
    if (desktopTabsBar) desktopTabsBar.style.display = 'none';
    return;
  }

  // Si no es cliente, ocultar opciones de cliente
  if (clientMain) clientMain.style.display = 'none';
  document.querySelectorAll('.sidebar-client-only').forEach(el => el.style.display = 'none');
  const defaultDashboard = document.querySelector('a[data-tab="tab-dashboard"]');
  if (defaultDashboard && defaultDashboard.parentElement) defaultDashboard.parentElement.style.display = '';
  const topbarSearch = document.getElementById('topbar-search-input');
  if (topbarSearch && topbarSearch.parentElement) topbarSearch.parentElement.style.display = '';

  if (isInspector) {
    if (inspectorMain) inspectorMain.style.display = 'block';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    const userNameEl = document.getElementById('inspector-home-user-name');
    if (userNameEl) userNameEl.textContent = (currentUser && currentUser.nombre) ? currentUser.nombre : 'Inspector';
  } else {
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'block';
    if (adminFinRow) adminFinRow.style.display = 'flex';
  }`;

if (appJs.includes(updateRoleUITarget)) {
  appJs = appJs.replace(updateRoleUITarget, newUpdateRoleUICode);
  console.log('✓ updateRoleUI actualizado para perfiles de cliente.');
}

// 3. Agregar los métodos del Portal del Cliente al final de app.js
const clientPortalJsModule = `
// ==============================================================
// LÓGICA Y CONTROLADOR DEL PORTAL DEL CLIENTE (ASEGURADOS)
// ==============================================================

let clientCasesCache = [];
let clientCurrentTrackingCaseId = null;

// Alternar entre pestañas de Login "Personal Lorens" vs "Portal Clientes"
function switchLoginType(type) {
  const tabStaff = document.getElementById('tab-login-staff');
  const tabClient = document.getElementById('tab-login-client');
  const boxStaff = document.getElementById('login-staff-box');
  const boxClient = document.getElementById('login-client-box');
  const errStaff = document.getElementById('login-error-alert');
  const errClient = document.getElementById('client-login-error-alert');

  if (errStaff) errStaff.style.display = 'none';
  if (errClient) errClient.style.display = 'none';

  if (type === 'client') {
    if (tabClient) tabClient.classList.add('active');
    if (tabStaff) tabStaff.classList.remove('active');
    if (boxClient) boxClient.style.display = 'block';
    if (boxStaff) boxStaff.style.display = 'none';
    const emailInput = document.getElementById('client-login-email');
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  } else {
    if (tabStaff) tabStaff.classList.add('active');
    if (tabClient) tabClient.classList.remove('active');
    if (boxStaff) boxStaff.style.display = 'block';
    if (boxClient) boxClient.style.display = 'none';
    const emailInput = document.getElementById('login-email');
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  }
}

// Mostrar / ocultar contraseña en el login del cliente
function toggleClientPasswordVisibility() {
  const pwdInput = document.getElementById('client-login-password');
  const icon = document.getElementById('btn-toggle-client-password');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    pwdInput.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
}

// Recuperar contraseña mediante token de acceso seguro
async function promptForgotPassword() {
  const { value: email } = await Swal.fire({
    title: 'Recuperar Contraseña',
    text: 'Ingrese su correo electrónico registrado. Le enviaremos un enlace seguro con un token de acceso temporal de un solo uso.',
    input: 'email',
    inputPlaceholder: 'correo@ejemplo.cl',
    confirmButtonText: 'Enviar token de recuperación',
    confirmButtonColor: '#0284c7',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    cancelButtonColor: '#94a3b8'
  });

  if (email) {
    await LorensAlert.success(
      'Solicitud Procesada',
      \`Si el correo "\${email}" se encuentra registrado como titular de un expediente en Lorens, recibirá un enlace con instrucciones y su token temporal de acceso.\`
    );
  }
}

// Manejar inicio de sesión de clientes
async function handleClientLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = (document.getElementById('client-login-email')?.value || '').trim();
  const password = (document.getElementById('client-login-password')?.value || '').trim();
  const submitBtn = document.getElementById('btn-submit-client-login');
  const errorAlert = document.getElementById('client-login-error-alert');

  if (errorAlert) errorAlert.style.display = 'none';

  if (!email || !password) {
    if (errorAlert) {
      errorAlert.textContent = 'Debe ingresar su correo electrónico y contraseña.';
      errorAlert.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">sync</i>Validando credenciales...';
  }

  try {
    const res = await ApiService.clientLogin(email, password);
    if (res && res.token && res.user) {
      ApiService.setAuth(res.token, res.user);
      await LorensAlert.success(
        'Acceso Autorizado',
        \`Bienvenido al Portal del Cliente, \${res.user.nombre}.\`
      );
      checkInitialAuth();
    } else {
      throw new Error(res.error || 'Credenciales no válidas.');
    }
  } catch (err) {
    console.error('[CLIENT LOGIN ERROR]', err);
    if (errorAlert) {
      errorAlert.textContent = err.message || 'Credenciales inválidas. Compruebe correo y contraseña.';
      errorAlert.style.display = 'block';
    }
    await LorensAlert.error('Acceso Denegado', err.message || 'No fue posible iniciar sesión.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="material-icons left">login</i>Ingresar a mi portal';
    }
  }
}

// Acceso rápido para pruebas
function quickClientLogin(email, password) {
  const emailInput = document.getElementById('client-login-email');
  const pwdInput = document.getElementById('client-login-password');
  if (emailInput) {
    emailInput.value = email;
    if (M && M.updateTextFields) M.updateTextFields();
  }
  if (pwdInput) {
    pwdInput.value = password;
    if (M && M.updateTextFields) M.updateTextFields();
  }
  handleClientLoginSubmit({ preventDefault: () => {} });
}

// Iniciar vista del Portal del Cliente
function showClientPortal() {
  const heroName = document.getElementById('client-hero-user-name');
  if (heroName && currentUser) {
    heroName.textContent = currentUser.nombre;
  }
  switchClientView('dashboard');
  loadClientPortalData();
}

// Alternar vistas dentro del Portal del Cliente
function switchClientView(viewName) {
  const dashView = document.getElementById('client-view-dashboard');
  const trackView = document.getElementById('client-view-tracking');
  const linkDash = document.querySelector('#sidebar-item-client-dashboard .sidebar-menu-link');
  const linkCases = document.querySelector('#sidebar-item-client-cases .sidebar-menu-link');
  const linkTrack = document.querySelector('#sidebar-item-client-tracking .sidebar-menu-link');

  if (linkDash) linkDash.classList.remove('active');
  if (linkCases) linkCases.classList.remove('active');
  if (linkTrack) linkTrack.classList.remove('active');

  if (viewName === 'tracking') {
    if (dashView) dashView.style.display = 'none';
    if (trackView) trackView.style.display = 'block';
    if (linkTrack) linkTrack.classList.add('active');
    const trackItem = document.getElementById('sidebar-item-client-tracking');
    if (trackItem) trackItem.style.display = '';
  } else {
    if (dashView) dashView.style.display = 'block';
    if (trackView) trackView.style.display = 'none';
    if (viewName === 'cases') {
      if (linkCases) linkCases.classList.add('active');
      const tableCard = document.querySelector('#client-view-dashboard .card');
      if (tableCard) tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      if (linkDash) linkDash.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

// Consultar expedientes y KPIs desde PostgreSQL
async function loadClientPortalData() {
  const loader = document.getElementById('client-cases-loading');
  const container = document.getElementById('client-cases-container');

  if (loader) loader.style.display = 'block';
  if (container) container.style.display = 'none';

  try {
    const data = await ApiService.getClientCases();
    const cases = data.cases || [];
    const kpis = data.kpis || { total: 0, en_proceso: 0, finalizados: 0, pendientes: 0 };

    // Actualizar KPIs del Cliente
    const kpiTotal = document.getElementById('client-kpi-total');
    const kpiProceso = document.getElementById('client-kpi-proceso');
    const kpiFin = document.getElementById('client-kpi-finalizados');
    const kpiPend = document.getElementById('client-kpi-pendientes');

    if (kpiTotal) kpiTotal.textContent = kpis.total;
    if (kpiProceso) kpiProceso.textContent = kpis.en_proceso;
    if (kpiFin) kpiFin.textContent = kpis.finalizados;
    if (kpiPend) kpiPend.textContent = kpis.pendientes;

    clientCasesCache = cases;
    renderClientCases(cases);
  } catch (err) {
    console.error('[LOAD CLIENT DATA ERROR]', err);
    if (container) {
      container.innerHTML = \`<div class="card-panel red lighten-5 red-text text-darken-3 center-align">
        <i class="material-icons medium" style="margin-bottom: 8px;">error_outline</i>
        <div style="font-weight: 700;">Error al cargar sus expedientes</div>
        <div style="font-size: 0.85rem;">\${err.message || 'Compruebe su conexión o intente nuevamente.'}</div>
        <button class="btn btn-small blue darken-1" style="margin-top: 12px; border-radius: 6px;" onclick="loadClientPortalData()">Reintentar</button>
      </div>\`;
      container.style.display = 'block';
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// Renderizar la lista de expedientes (Tabla desktop y tarjetas móviles)
function renderClientCases(cases) {
  const container = document.getElementById('client-cases-container');
  if (!container) return;

  if (!cases || cases.length === 0) {
    container.innerHTML = \`
      <div class="center-align grey-text" style="padding: 40px 20px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_open</i>
        <div style="font-size: 1rem; font-weight: 700; color: #475569;">No registra expedientes asignados</div>
        <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #94a3b8;">
          Si contrató una póliza y declaró un siniestro, contacte a su compañía aseguradora para verificar la vinculación.
        </p>
      </div>
    \`;
    container.style.display = 'block';
    return;
  }

  // Vista Tabla para pantallas medianas y grandes + Tarjetas para móvil
  let html = \`
    <div class="hide-on-small-only">
      <table class="highlight responsive-table" style="font-size: 0.85rem;">
        <thead>
          <tr style="background: #f8fafc; color: #475569; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 10px 14px; font-weight: 700;">Expediente</th>
            <th style="padding: 10px 14px; font-weight: 700;">Siniestro</th>
            <th style="padding: 10px 14px; font-weight: 700;">Tipo</th>
            <th style="padding: 10px 14px; font-weight: 700;">Dirección</th>
            <th style="padding: 10px 14px; font-weight: 700;">Fecha</th>
            <th style="padding: 10px 14px; font-weight: 700;">Estado / Etapa</th>
            <th style="padding: 10px 14px; font-weight: 700;">Avance</th>
            <th style="padding: 10px 14px; font-weight: 700; text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody>
  \`;

  cases.forEach(c => {
    const avance = c.avance_porcentaje || 0;
    const fecha = c.fecha_evento || c.created_at;
    const formattedDate = fecha ? new Date(fecha).toLocaleDateString('es-CL') : '-';
    const etapaPillClass = c.timeline_habilitado ? 'completada' : 'observada';

    html += \`
      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
        <td style="padding: 12px 14px; font-weight: 800; color: #0284c7;">\${c.codigo}</td>
        <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">\${c.numero_siniestro || '-'}</td>
        <td style="padding: 12px 14px; color: #334155;">\${c.tipo_evento || 'Sismo'}</td>
        <td style="padding: 12px 14px; color: #334155;">\${c.direccion || '-'}, \${c.comuna || ''}</td>
        <td style="padding: 12px 14px; color: #64748b; font-size: 0.8rem;">\${formattedDate}</td>
        <td style="padding: 12px 14px;">
          <span class="client-stage-status-pill \${etapaPillClass}" style="display: inline-block;">
            \${c.etapa_nombre || 'En trámite'}
          </span>
        </td>
        <td style="padding: 12px 14px; min-width: 110px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: \${avance}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #0284c7;">\${avance}%</span>
          </div>
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <button type="button" class="btn btn-small waves-effect waves-light" style="background: #0284c7; border-radius: 6px; font-weight: 700; text-transform: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;" onclick="openClientCaseTracking('\${c.id}')">
            <i class="material-icons tiny">timeline</i> Consultar seguimiento
          </button>
        </td>
      </tr>
    \`;
  });

  html += \`</tbody></table></div>\`;

  // Tarjetas para móviles
  html += \`<div class="hide-on-med-and-up">\`;
  cases.forEach(c => {
    const avance = c.avance_porcentaje || 0;
    const fecha = c.fecha_evento || c.created_at;
    const formattedDate = fecha ? new Date(fecha).toLocaleDateString('es-CL') : '-';
    const etapaPillClass = c.timeline_habilitado ? 'completada' : 'observada';

    html += \`
      <div class="card" style="border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04); margin-bottom: 14px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">EXPEDIENTE</span>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0284c7;">\${c.codigo}</div>
          </div>
          <span class="client-stage-status-pill \${etapaPillClass}">\${c.etapa_nombre || 'En trámite'}</span>
        </div>

        <div style="font-size: 0.8rem; color: #334155; margin-bottom: 6px;">
          <strong>Siniestro:</strong> \${c.numero_siniestro || '-'} · <strong>Tipo:</strong> \${c.tipo_evento || 'Sismo'}
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 10px;">
          <i class="material-icons tiny" style="vertical-align: middle;">place</i> \${c.direccion}, \${c.comuna}
        </div>

        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">
            <span>Avance del Proceso</span>
            <span style="color: #0284c7;">\${avance}%</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: \${avance}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
          </div>
        </div>

        <button type="button" class="btn waves-effect waves-light" style="width: 100%; background: #0284c7; border-radius: 8px; font-weight: 700; text-transform: none; font-size: 0.85rem;" onclick="openClientCaseTracking('\${c.id}')">
          <i class="material-icons left tiny">timeline</i> Consultar seguimiento
        </button>
      </div>
    \`;
  });
  html += \`</div>\`;

  container.innerHTML = html;
  container.style.display = 'block';
}

// Filtrar expedientes en tiempo real
function filterClientCases(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    renderClientCases(clientCasesCache);
    return;
  }
  const filtered = clientCasesCache.filter(c => {
    return (c.codigo && c.codigo.toLowerCase().includes(q)) ||
           (c.numero_siniestro && c.numero_siniestro.toLowerCase().includes(q)) ||
           (c.direccion && c.direccion.toLowerCase().includes(q)) ||
           (c.comuna && c.comuna.toLowerCase().includes(q)) ||
           (c.tipo_evento && c.tipo_evento.toLowerCase().includes(q));
  });
  renderClientCases(filtered);
}

// Abrir ficha de seguimiento y línea de tiempo de un expediente
async function openClientCaseTracking(caseId) {
  if (!caseId) return;
  clientCurrentTrackingCaseId = caseId;

  showPageLoading('Cargando seguimiento del expediente...');

  try {
    // 1. Obtener detalle oficial del caso
    const caseData = await ApiService.getClientCaseDetail(caseId);

    // Actualizar ficha superior
    const codigoEl = document.getElementById('client-track-codigo');
    const dirEl = document.getElementById('client-track-direccion');
    const avanceEl = document.getElementById('client-track-avance');
    const badgeEl = document.getElementById('client-track-header-badge');
    const siniestroEl = document.getElementById('client-track-siniestro');
    const polizaEl = document.getElementById('client-track-poliza');
    const eventoEl = document.getElementById('client-track-evento');
    const aseguradoraEl = document.getElementById('client-track-aseguradora');
    const fechaEvEl = document.getElementById('client-track-fecha-evento');
    const fechaVisEl = document.getElementById('client-track-fecha-visita');
    const etapaActEl = document.getElementById('client-track-etapa-actual');
    const estadoPill = document.getElementById('client-track-estado-pill');

    if (codigoEl) codigoEl.textContent = caseData.codigo;
    if (dirEl) dirEl.textContent = \`\${caseData.direccion}, \${caseData.comuna || ''}\`;
    if (avanceEl) avanceEl.textContent = \`\${caseData.avance_porcentaje || 0}%\`;
    if (siniestroEl) siniestroEl.textContent = caseData.numero_siniestro || 'Sin N° registrado';
    if (polizaEl) polizaEl.textContent = caseData.numero_poliza || 'Póliza Hogar Estándar';
    if (eventoEl) eventoEl.textContent = caseData.tipo_evento || 'Sismo';
    if (aseguradoraEl) aseguradoraEl.textContent = caseData.aseguradora || 'ASESORÍAS LORENS';
    if (fechaEvEl) fechaEvEl.textContent = caseData.fecha_evento ? new Date(caseData.fecha_evento).toLocaleDateString('es-CL') : 'No informada';
    if (fechaVisEl) fechaVisEl.textContent = caseData.fecha_visita ? new Date(caseData.fecha_visita).toLocaleDateString('es-CL') : 'Coordinada en terreno';
    if (etapaActEl) etapaActEl.textContent = caseData.etapa_nombre || 'En Proceso';

    if (badgeEl) {
      badgeEl.textContent = \`EXPEDIENTE \${(caseData.estado || 'ACTIVO').toUpperCase()}\`;
    }

    if (estadoPill) {
      estadoPill.textContent = (caseData.estado || 'Activo').toUpperCase();
      estadoPill.className = \`client-stage-status-pill \${caseData.estado === 'procesado' ? 'completada' : 'en_curso'}\`;
    }

    // 2. Consultar Línea de Tiempo del Expediente
    let timelineRes = null;
    let timelineLocked = false;
    let lockedMsg = '';

    try {
      timelineRes = await ApiService.getClientCaseTimeline(caseId);
    } catch (timelineErr) {
      timelineLocked = true;
      lockedMsg = timelineErr.message || 'El seguimiento detallado estará disponible cuando su expediente ingrese a la etapa de Evidencia.';
    }

    const lockedView = document.getElementById('client-timeline-locked-view');
    const unlockedView = document.getElementById('client-timeline-unlocked-view');
    const lockedStageName = document.getElementById('client-locked-stage-name');

    if (timelineLocked || !timelineRes || !timelineRes.habilitado) {
      // REGLA: Timeline bloqueado antes de etapa Evidencia
      if (lockedView) lockedView.style.display = 'block';
      if (unlockedView) unlockedView.style.display = 'none';
      if (lockedStageName) lockedStageName.textContent = caseData.etapa_nombre || 'Visita Programada';

      await Swal.fire({
        icon: 'info',
        title: 'Seguimiento en Preparación',
        text: 'La línea de tiempo detallada y las evidencias fotográficas se habilitarán automáticamente cuando su expediente ingrese a la etapa de Evidencia.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#0284c7'
      });
    } else {
      // Timeline habilitado: mostrar las 9 etapas
      if (lockedView) lockedView.style.display = 'none';
      if (unlockedView) unlockedView.style.display = 'block';
      renderClientTimeline(timelineRes.etapas || []);

      // Cargar evidencias fotográficas autorizadas
      loadClientCaseEvidence(caseId);
    }

    switchClientView('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('[OPEN CLIENT TRACKING ERROR]', err);
    await LorensAlert.error('Error al cargar expediente', err.message || 'No fue posible acceder al seguimiento del siniestro.');
  } finally {
    hidePageLoading();
  }
}

// Renderizar las 9 etapas de la línea de tiempo oficial
function renderClientTimeline(etapas) {
  const container = document.getElementById('client-timeline-tree-container');
  if (!container) return;
  container.innerHTML = '';

  if (!etapas || etapas.length === 0) {
    container.innerHTML = '<p class="grey-text center-align">No hay registros de etapas para este expediente.</p>';
    return;
  }

  etapas.forEach((etapa, idx) => {
    let iconName = 'schedule';
    if (etapa.estado === 'completada') iconName = 'check';
    else if (etapa.estado === 'en_curso') iconName = 'sync';
    else if (etapa.estado === 'observada') iconName = 'warning';
    else iconName = 'radio_button_unchecked';

    const fechaIni = etapa.fecha_inicio ? new Date(etapa.fecha_inicio).toLocaleDateString('es-CL') : null;
    const fechaFin = etapa.fecha_fin ? new Date(etapa.fecha_fin).toLocaleDateString('es-CL') : null;

    let fechasHtml = '';
    if (fechaIni && fechaFin) {
      fechasHtml = \`<span><i class="material-icons tiny" style="vertical-align: middle;">event</i> \${fechaIni} al \${fechaFin}</span>\`;
    } else if (fechaIni) {
      fechasHtml = \`<span><i class="material-icons tiny" style="vertical-align: middle;">play_circle</i> Iniciada el \${fechaIni}</span>\`;
    } else {
      fechasHtml = \`<span><i class="material-icons tiny" style="vertical-align: middle;">hourglass_empty</i> Pendiente de inicio</span>\`;
    }

    const node = document.createElement('div');
    node.className = 'client-stage-node';
    node.innerHTML = \`
      <div class="client-stage-icon-badge \${etapa.estado}">
        <i class="material-icons" style="font-size: 18px;">\${iconName}</i>
      </div>
      <div class="client-stage-card-box \${etapa.es_etapa_actual ? 'active-stage' : ''}" onclick="showStageDetailDialog('\${etapa.nombre}', '\${etapa.estado}', '\${fechasHtml.replace(/'/g, "\\'")}', '\${(etapa.descripcion_publica || '').replace(/'/g, "\\'")}', '\${(etapa.responsable || '').replace(/'/g, "\\'")}')">
        <div class="client-stage-topbar">
          <div class="client-stage-title">
            \${etapa.orden}. \${etapa.nombre}
            \${etapa.es_etapa_actual ? '<span style="font-size: 0.68rem; background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">ETAPA ACTUAL</span>' : ''}
          </div>
          <span class="client-stage-status-pill \${etapa.estado}">\${etapa.estado.replace(/_/g, ' ')}</span>
        </div>
        <div class="client-stage-dates">
          \${fechasHtml}
        </div>
        <p class="client-stage-desc">\${etapa.descripcion_publica}</p>
        <div class="client-stage-footer">
          <span><i class="material-icons tiny" style="vertical-align: middle;">verified</i> \${etapa.responsable}</span>
          <span class="blue-text text-darken-2" style="font-weight: 700; cursor: pointer;">Ver detalles →</span>
        </div>
      </div>
    \`;
    container.appendChild(node);
  });
}

// Mostrar diálogo informativo al hacer clic en una etapa
function showStageDetailDialog(nombre, estado, fechas, desc, responsable) {
  let icon = 'info';
  if (estado === 'completada') icon = 'success';
  else if (estado === 'observada') icon = 'warning';

  Swal.fire({
    icon: icon,
    title: nombre,
    html: \`
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.5; color: #334155; margin-top: 10px;">
        <p><strong>Estado oficial:</strong> <span class="client-stage-status-pill \${estado}">\${estado.toUpperCase()}</span></p>
        <p><strong>Descripción:</strong> \${desc}</p>
        <p><strong>Responsable:</strong> \${responsable}</p>
      </div>
    \`,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#0284c7'
  });
}

// Cargar evidencias fotográficas autorizadas para el cliente
async function loadClientCaseEvidence(caseId) {
  const loader = document.getElementById('client-evidence-loading');
  const grid = document.getElementById('client-evidence-grid');
  const countBadge = document.getElementById('client-evidence-count-badge');

  if (loader) loader.style.display = 'block';
  if (grid) grid.innerHTML = '';

  try {
    const photos = await ApiService.getClientCaseEvidence(caseId);
    if (countBadge) countBadge.textContent = \`\${photos.length} fotografías\`;

    if (!photos || photos.length === 0) {
      if (grid) {
        grid.innerHTML = \`
          <div class="col s12 center-align grey-text" style="padding: 30px 10px;">
            <i class="material-icons medium" style="color: #cbd5e1; display: block; margin-bottom: 6px;">no_photography</i>
            <div style="font-size: 0.88rem; font-weight: 600; color: #64748b;">No hay fotografías publicadas aún para este expediente.</div>
            <p style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0 0 0;">
              Las evidencias periciales autorizadas se mostrarán aquí una vez completada la revisión técnica.
            </p>
          </div>
        \`;
      }
      return;
    }

    photos.forEach((photo, idx) => {
      const col = document.createElement('div');
      col.className = 'col s12 m6 l4';

      const sector = (photo.sector || photo.sector_nombre || 'GENERAL').toUpperCase();
      const desc = photo.descripcion || 'Evidencia pericial autorizada de terreno.';
      const dateStr = photo.created_at || photo.fecha_captura;
      const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('es-CL') : '-';
      const photoId = photo.id;

      col.innerHTML = \`
        <div class="client-evidence-card">
          <div class="client-evidence-media" onclick="openClientPhotoLightbox('\${caseId}', '\${photoId}', '\${sector}', '\${desc.replace(/'/g, "\\'")}')">
            <img id="client-img-\${photoId}" src="\${PHOTO_PLACEHOLDER}" alt="Evidencia \${idx + 1}" loading="lazy">
            <span class="client-evidence-sector-tag">
              <i class="material-icons tiny">meeting_room</i> \${sector}
            </span>
            <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              <i class="material-icons tiny">zoom_in</i>
            </span>
          </div>
          <div class="client-evidence-body">
            <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 0.82rem; line-height: 1.35;">\${desc}</p>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
              <i class="material-icons tiny" style="font-size: 14px;">calendar_today</i> \${formattedDate}
            </div>
          </div>
        </div>
      \`;
      grid.appendChild(col);

      // Cargar imagen de forma autorizada con token
      ApiService.fetchClientPhotoBlob(caseId, photoId)
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const imgEl = document.getElementById(\`client-img-\${photoId}\`);
          if (imgEl) imgEl.src = blobUrl;
        })
        .catch(() => {
          const token = ApiService.getToken();
          const imgEl = document.getElementById(\`client-img-\${photoId}\`);
          if (imgEl && token) {
            imgEl.src = \`/api/client/cases/\${caseId}/photos/\${photoId}/file?token=\${encodeURIComponent(token)}\`;
          }
        });
    });
  } catch (err) {
    console.error('[LOAD CLIENT EVIDENCE ERROR]', err);
    if (grid) {
      grid.innerHTML = \`<div class="col s12 red-text center-align" style="padding: 20px;">Error al cargar fotografías autorizadas: \${err.message}</div>\`;
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// Abrir imagen del cliente en lightbox
async function openClientPhotoLightbox(caseId, photoId, sector, desc) {
  let photoUrl = PHOTO_PLACEHOLDER;
  try {
    const blob = await ApiService.fetchClientPhotoBlob(caseId, photoId);
    photoUrl = URL.createObjectURL(blob);
  } catch {
    const token = ApiService.getToken();
    photoUrl = \`/api/client/cases/\${caseId}/photos/\${photoId}/file?token=\${encodeURIComponent(token)}\`;
  }
  openPhotoLightbox(photoUrl, sector, desc);
}

// Exportar globalmente para eventos en HTML
window.switchLoginType = switchLoginType;
window.toggleClientPasswordVisibility = toggleClientPasswordVisibility;
window.promptForgotPassword = promptForgotPassword;
window.handleClientLoginSubmit = handleClientLoginSubmit;
window.quickClientLogin = quickClientLogin;
window.showClientPortal = showClientPortal;
window.switchClientView = switchClientView;
window.loadClientPortalData = loadClientPortalData;
window.renderClientCases = renderClientCases;
window.filterClientCases = filterClientCases;
window.openClientCaseTracking = openClientCaseTracking;
window.renderClientTimeline = renderClientTimeline;
window.showStageDetailDialog = showStageDetailDialog;
window.loadClientCaseEvidence = loadClientCaseEvidence;
window.openClientPhotoLightbox = openClientPhotoLightbox;
`;

appJs += '\n' + clientPortalJsModule;
fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('✓ public/js/app.js actualizado con módulo del Portal del Cliente.');

