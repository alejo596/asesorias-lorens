
// ==============================================================
// SISTEMA CENTRALIZADO DE NOTIFICACIONES SWEETALERT2 (LORENS)
// ==============================================================
const LorensAlert = {
  success: (title, text = '', confirmText = 'Aceptar') => {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: confirmText,
      confirmButtonColor: '#10b981',
      customClass: { popup: 'lorens-swal-popup' }
    });
  },

  error: (title, text = '', confirmText = 'Reintentar') => {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: confirmText,
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'lorens-swal-popup' }
    });
  },

  warning: (title, text = '', confirmText = 'Entendido') => {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: confirmText,
      confirmButtonColor: '#f59e0b',
      customClass: { popup: 'lorens-swal-popup' }
    });
  },

  confirm: (title, text = '', confirmText = 'Sí, continuar', cancelText = 'Cancelar') => {
    return Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      customClass: { popup: 'lorens-swal-popup' }
    });
  },

  showUploadProgress: (title = 'Guardando evidencia pericial') => {
    return Swal.fire({
      title,
      html: `
        <div style="padding: 10px 0;">
          <div id="swal-upload-stage" style="font-size: 0.88rem; font-weight: 700; color: #1e293b; margin-bottom: 10px;">
            Iniciando transferencia del archivo...
          </div>
          <div style="background: #e2e8f0; border-radius: 8px; height: 14px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
            <div id="swal-upload-bar" style="background: linear-gradient(90deg, #f59e0b, #10b981); width: 0%; height: 100%; transition: width 0.15s ease;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: #64748b; font-weight: 600;">
            <span id="swal-upload-percent">0%</span>
            <span id="swal-upload-bytes">0 KB transferidos</span>
          </div>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      customClass: { popup: 'lorens-swal-popup' },
      didOpen: () => {
        Swal.showLoading();
      }
    });
  },

  updateUploadProgress: (percent, bytesLoaded, totalBytes, stageMessage) => {
    const bar = document.getElementById('swal-upload-bar');
    const pct = document.getElementById('swal-upload-percent');
    const bytes = document.getElementById('swal-upload-bytes');
    const stage = document.getElementById('swal-upload-stage');

    if (bar) bar.style.width = `${percent}%`;
    if (pct) pct.textContent = `${percent}%`;
    if (bytes) {
      const loadedKb = (bytesLoaded / 1024).toFixed(0);
      const totalKb = (totalBytes / 1024).toFixed(0);
      bytes.textContent = `${loadedKb} KB de ${totalKb} KB`;
    }
    if (stage && stageMessage) stage.textContent = stageMessage;
  },

  close: () => {
    Swal.close();
  }
};

// Caché de Blob URLs para visualización autorizada 100% segura
const photoBlobCache = new Map();

async function getAuthorizedPhotoUrl(photo) {
  if (!photo) return PHOTO_PLACEHOLDER;
  if (typeof photo.data_url === 'string' && photo.data_url.startsWith('data:')) {
    return photo.data_url;
  }

  const photoId = String(photo.id);
  if (photoBlobCache.has(photoId)) {
    return photoBlobCache.get(photoId);
  }

  const token = (typeof ApiService !== 'undefined' && ApiService.getToken)
    ? ApiService.getToken()
    : (localStorage.getItem('lorens_token') || localStorage.getItem('lorens_auth_token'));
  const cId = photo.expediente_id || currentCaseId;
  const endpoint = `/api/cases/${cId}/photos/${photo.id}/file`;

  try {
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error('El archivo recuperado no es una imagen válida.');
    }

    const objectUrl = URL.createObjectURL(blob);
    photoBlobCache.set(photoId, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn(`[getAuthorizedPhotoUrl] Fallback directo para foto ${photoId}:`, err.message);
    if (token) {
      return `${endpoint}?token=${encodeURIComponent(token)}`;
    }
    return PHOTO_PLACEHOLDER;
  }
}


// ==============================================================
// GESTOR DE CARGA GLOBAL Y CONTROL DE FOCUS
// ==============================================================
let globalLoadingCount = 0;

function showPageLoading(message = 'Cargando...') {
  globalLoadingCount++;
  const topLoader = document.getElementById('global-page-loader');
  const indicator = document.getElementById('global-loading-indicator');
  const textEl = document.getElementById('global-loading-text');

  if (topLoader) topLoader.style.display = 'block';
  if (textEl) textEl.textContent = message;
  if (indicator) {
    indicator.style.display = 'flex';
    indicator.classList.remove('hidden');
  }
}

function hidePageLoading() {
  globalLoadingCount = Math.max(0, globalLoadingCount - 1);
  if (globalLoadingCount === 0) {
    const topLoader = document.getElementById('global-page-loader');
    const indicator = document.getElementById('global-loading-indicator');
    if (topLoader) topLoader.style.display = 'none';
    if (indicator) {
      indicator.classList.add('hidden');
      setTimeout(() => {
        if (globalLoadingCount === 0 && indicator) {
          indicator.style.display = 'none';
        }
      }, 260);
    }
  }
}

// Control estricto de focus al hacer clic en menú o navegación
function controlMenuFocus(event, targetElement = null) {
  // 1. Quitar el foco del botón/enlace pulsado para evitar halos molestos
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  // 2. Cerrar el menú móvil si está desplegado
  if (typeof toggleMobileSidebar === 'function') {
    toggleMobileSidebar(false);
  }

  // 3. Mover foco suavemente al contenedor destino de forma accesible
  if (targetElement) {
    try {
      targetElement.setAttribute('tabindex', '-1');
      targetElement.focus({ preventScroll: true });
    } catch (e) {}
  }
}

/**
 * ASESORÍAS LORENS - Orquestación Frontend y Lógica de Aplicación
 * Soporte Multi-Dispositivo (Inspector de Terreno Móvil) y Panel Administrador
 */
let currentCaseId = 'd0000000-0000-0000-0000-000000000001';
let currentCaseData = null;
let editingLineId = null;
let currentRole = 'inspector'; // 'inspector' o 'admin'
let currentUser = null;

// Inicialización de la aplicación al cargar el DOM.
// Cada etapa se ejecuta de forma aislada: si una falla, el resto de la interfaz
// (menú, login, navegación, modales) sigue operativa en lugar de abortar por completo.
const APP_BOOT_STEPS = [
  ['Componentes Materialize', initMaterialize],
  ['Eventos globales', setupEventListeners],
  ['Sesión y navbar', setupNavbarNavigation],
  ['Navegación delegada', setupNavigationDelegation],
  ['Pestañas y secciones', setupTabPanels],
  ['Enrutado por hash', setupHashRouting],
  ['Calculadora geométrica', setupGeometricCalculator],
  ['Captura fotográfica', setupPhotoCapture],
  ['Sesión y roles', checkInitialAuth],
];

document.addEventListener('DOMContentLoaded', () => {
  APP_BOOT_STEPS.forEach(([label, step]) => {
    try {
      step();
    } catch (error) {
      console.error(`[BOOT] Error al inicializar "${label}":`, error);
    }
  });
});

// Inicializar componentes de Materialize CSS
function initMaterialize() {
  const sidenavs = document.querySelectorAll('.sidenav');
  if (sidenavs.length) M.Sidenav.init(sidenavs);
  M.Modal.init(document.querySelectorAll('.modal'), {
    dismissible: true,
    startingTop: '2%',
    endingTop: '6%'
  });
  M.FormSelect.init(document.querySelectorAll('select'));

  const tabsEl = document.querySelector('.tabs');
  if (tabsEl) {
    // onShow mantiene sincronizados el menú superior y la barra móvil
    // cuando la pestaña se activa desde el propio componente.
    M.Tabs.init(tabsEl, {
      onShow: (content) => syncNavigationState(content && content.id)
    });
  }

  M.Tooltip.init(document.querySelectorAll('.tooltipped'));

  const dropdowns = document.querySelectorAll('.dropdown-trigger');
  if (dropdowns.length) {
    M.Dropdown.init(dropdowns, { coverTrigger: false, constrainWidth: false });
  }
  M.updateTextFields();
}

// =============================================================================
// GESTIÓN DE AUTENTICACIÓN, SESIONES Y ROLES (RBAC)
// =============================================================================

function checkInitialAuth() {
  const user = ApiService.getUser();
  const token = (typeof ApiService !== 'undefined' && ApiService.getToken)
    ? ApiService.getToken()
    : (localStorage.getItem('lorens_token') || localStorage.getItem('lorens_auth_token'));

  const viewLogin = document.getElementById('view-login');
  const mainApp = document.getElementById('main-app-content');
  const appNavbar = document.getElementById('app-navbar');
  const navAuth = document.getElementById('nav-authenticated-menu');

  if (token && user) {
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
    } else if (user.rol === 'ajustador') {
      currentRole = 'ajustador';
      document.body.classList.remove('is-client-role');
      updateRoleUI();
      switchAdjusterView('dashboard');
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
  } else {
    currentUser = null;
    document.body.classList.remove('is-authenticated');
    if (viewLogin) viewLogin.style.display = 'flex';
    if (appNavbar) appNavbar.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (navAuth) navAuth.style.display = 'none';
  }
}

window.quickLogin = function(username, password) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = username;
  if (passInput) passInput.value = password;
  M.updateTextFields();
  doLogin(username, password);
};

async function doLogin(username, password) {
  const submitBtn = document.getElementById('btn-submit-login');
  const errorAlert = document.getElementById('login-error-alert');
  if (errorAlert) errorAlert.style.display = 'none';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">sync</i>Verificando acceso...';
  }

  try {
    const res = await ApiService.login(username, password);
    if (res && res.token && res.user) {
      ApiService.setAuth(res.token, res.user);
      M.toast({ 
        html: `¡Acceso concedido! Bienvenido, <strong>${res.user.nombre}</strong> (${res.user.rol.toUpperCase()})`, 
        classes: 'emerald darken-2' 
      });
      checkInitialAuth();
    } else {
      throw new Error(res.error || 'Credenciales no válidas.');
    }
  } catch (err) {
    console.warn('Fallo en autenticación:', err.message);
    if (errorAlert) {
      errorAlert.textContent = err.message || 'Credenciales inválidas. Compruebe usuario y contraseña.';
      errorAlert.style.display = 'block';
    }
    M.toast({ html: err.message || 'Error de autenticación', classes: 'red darken-3' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="material-icons left">login</i>Iniciar Sesión';
    }
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = (document.getElementById('login-password')?.value || '').trim();
  if (!email || !password) {
    M.toast({ html: 'Ingrese usuario y contraseña.', classes: 'amber darken-3' });
    return;
  }
  doLogin(email, password);
}

function handleLogout() {
  ApiService.clearAuth();
  currentUser = null;
  currentRole = 'inspector';
  document.body.classList.remove('is-authenticated', 'is-client-role', 'is-admin-role');
  document.body.classList.add('is-inspector-role');

  const navAvatar = document.getElementById('nav-user-avatar');
  const navName = document.getElementById('nav-user-name');
  const navRole = document.getElementById('nav-user-role');
  if (navAvatar) navAvatar.textContent = 'U';
  if (navName) navName.textContent = 'Usuario';
  if (navRole) {
    navRole.textContent = 'INSPECTOR';
    navRole.style.color = 'var(--amber-600, #d97706)';
  }

  const breadcrumbCurrent = document.getElementById('app-breadcrumbs-current');
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Dashboard';

  M.toast({ html: 'Sesión finalizada exitosamente.', classes: 'blue-grey darken-3' });
  checkInitialAuth();
}

// Muestra el módulo de login en pantalla única aislada, sin menú ni navbar.
function goToLogin() {
  const viewLogin = document.getElementById('view-login');
  const mainApp = document.getElementById('main-app-content');
  const appNavbar = document.getElementById('app-navbar');
  const navAuth = document.getElementById('nav-authenticated-menu');

  if (viewLogin) viewLogin.style.display = 'flex';
  if (appNavbar) appNavbar.style.display = 'none';
  if (mainApp) mainApp.style.display = 'none';
  if (navAuth) navAuth.style.display = 'none';
  document.body.classList.remove('is-authenticated');

  // El hash puede apuntar a una pestaña interna: se limpia para no reabrirla.
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  if (viewLogin && typeof viewLogin.scrollIntoView === 'function') {
    viewLogin.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const emailInput = document.getElementById('login-email');
  if (emailInput) {
    emailInput.focus({ preventScroll: true });
  }
}
window.goToLogin = goToLogin;

// Configuración del navbar superior: sesión y controles de acceso
function setupNavbarNavigation() {
  // Botón de logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Acceso al módulo de login desde el navbar (visible sin sesión)
  const navLoginBtn = document.getElementById('btn-nav-login');
  if (navLoginBtn) {
    navLoginBtn.addEventListener('click', goToLogin);
  }

  // Formulario de login
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', handleLoginSubmit);
  }

  // Toggle de visibilidad de password (operable con toque y con teclado)
  const togglePass = document.getElementById('btn-toggle-password');
  if (togglePass) {
    const togglePassword = () => {
      const passInput = document.getElementById('login-password');
      if (!passInput) return;
      const show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      togglePass.textContent = show ? 'visibility_off' : 'visibility';
      togglePass.setAttribute('aria-pressed', show ? 'true' : 'false');
    };
    togglePass.addEventListener('click', togglePassword);
    togglePass.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePassword();
      }
    });
  }
}

// =============================================================================
// ENLACE CENTRALIZADO DE EVENTOS (formularios, filtros, selector y gráfico)
// =============================================================================

function bindFormSubmit(elementId, handler) {
  const form = document.getElementById(elementId);
  if (form) form.addEventListener('submit', handler);
}

function bindClick(elementId, handler) {
  const element = document.getElementById(elementId);
  if (element) element.addEventListener('click', handler);
}

function setupEventListeners() {
  // --- Formularios de los modales ---
  bindFormSubmit('form-nueva-partida', handleAddOrUpdatePartida);
  bindFormSubmit('form-emitir-snapshot', handleConfirmSnapshot);
  bindFormSubmit('form-cambiar-liquidador', handleUpdateLiquidador);
  bindFormSubmit('form-nueva-foto', handleConfirmPhotoCapture);
    bindFormSubmit('form-nuevo-sector', handleCreateSector);

  // --- Conmutador de rol Inspector / Administrador ---
  bindClick('role-toggle-btn', toggleUserRole);

  // --- Visualización de Perfil de Usuario ---
  const profileNavBtn = document.getElementById('btn-view-profile');
  if (profileNavBtn) {
    profileNavBtn.addEventListener('click', () => {
      updateUserProfileUI();
      const modal = M.Modal.getInstance(document.getElementById('modal-user-profile'));
      if (modal) modal.open();
    });
  }

  // --- Botón de conmutación de rol dentro del modal de perfil ---
  bindClick('profile-toggle-role-btn', () => {
    toggleUserRole();
    updateUserProfileUI();
  });

  // --- Botón de logout dentro del modal de perfil ---
  bindClick('profile-modal-logout-btn', () => {
    const modal = M.Modal.getInstance(document.getElementById('modal-user-profile'));
    if (modal) modal.close();
    handleLogout();
  });

  // --- Búsqueda en vivo del acta oficial ---
  const searchInput = document.getElementById('acta-search-input');
  if (searchInput) {
    const applySearch = () => {
      BudgetViewer.activeSearchQuery = searchInput.value || '';
      if (currentCaseData) {
        BudgetViewer.renderTable(currentCaseData.lines || [], currentCaseData.expenses || []);
      }
    };
    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('search', applySearch);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        searchInput.value = '';
        applySearch();
      }
    });
  }

  // --- Modo del gráfico (cascada / por sector) ---
  const chartToggle = document.getElementById('chart-mode-toggle');
  if (chartToggle) {
    chartToggle.addEventListener('change', () => {
      BudgetViewer.chartViewMode = chartToggle.value === 'sector' ? 'sector' : 'financial';
      redrawChart();
    });
  }

  // --- Selector de expediente activo ---
  const caseSelector = document.getElementById('case-selector');
  if (caseSelector) {
    caseSelector.addEventListener('change', () => {
      currentCaseId = caseSelector.value;
      BudgetViewer.activeSearchQuery = '';
      const search = document.getElementById('acta-search-input');
      if (search) search.value = '';
      setActiveChipBySector('ALL');
      loadCase(currentCaseId);
    });
  }

  // --- Chips de filtrado por sector ---
  document.querySelectorAll('.chip-filter-sector').forEach((chip) => {
    const activate = () => {
      const sector = chip.getAttribute('data-sector') || 'ALL';
      setActiveChipBySector(sector);
      filterLevantamientoBySector(sector);
    };
    chip.addEventListener('click', activate);
    chip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
  });

  // --- Recalculo del canvas al girar el dispositivo o redimensionar ---
  let resizeTimer = null;
  const scheduleChartRedraw = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawChart, 220);
  };
  window.addEventListener('resize', scheduleChartRedraw);
  window.addEventListener('orientationchange', scheduleChartRedraw);

  // --- Sesión expirada reportada por el cliente API ---
  window.addEventListener('lorens:session-expired', () => {
    M.toast({ html: 'Su sesión expiró. Inicie sesión nuevamente.', classes: 'amber darken-3' });
    checkInitialAuth();
  });
}

function redrawChart() {
  if (!currentCaseData || !currentCaseData.summary) return;
  BudgetViewer.renderCanvasChart(
    currentCaseData.summary,
    currentCaseData.lines || [],
    currentCaseData.expenses || []
  );
}

function setActiveChipBySector(sectorName) {
  document.querySelectorAll('.chip-filter-sector').forEach((chip) => {
    const isActive = (chip.getAttribute('data-sector') || 'ALL') === sectorName;
    chip.classList.toggle('active-sector-chip', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

// Función unificada para alternar sección activa entre Navbar, Tabs y barra móvil
function switchTab(tabId, clickedElement = null) {
  if (!tabId) return;

  // Controlar foco inmediatamente
  controlMenuFocus(null, document.getElementById(tabId));

  const targetPanel = document.getElementById(tabId);
  if (!targetPanel) {
    console.warn(`[NAV] Sección solicitada inexistente: ${tabId}`);
    return;
  }

  showPageLoading('Cargando sección...');
  setTimeout(() => hidePageLoading(), 400);

  // RESTRICCIÓN ESTRICTA DE NAVEGACIÓN PARA EL PERFIL INSPECTOR
  // El inspector únicamente opera dentro de su Dashboard, Mis Expedientes y la Ficha de Inspección
  const isInspector = currentRole === 'inspector';
  if (isInspector) {
    if (tabId === 'tab-dashboard' || tabId === 'inspector-home') {
      showInspectorHome('dashboard');
      return;
    }
    if (tabId === 'tab-inspector-expedientes') {
      showInspectorHome('cases');
      return;
    }
    if (tabId === 'tab-ficha-inspeccion' || tabId === 'inspector-expediente-view') {
      if (currentCaseData && currentCaseData.expediente) {
        const homeSec = document.getElementById('inspector-home');
        const caseSec = document.getElementById('inspector-expediente-view');
        if (homeSec) homeSec.style.display = 'none';
        if (caseSec) caseSec.style.display = 'block';
      } else {
        showInspectorHome('dashboard');
      }
      return;
    }
    const forbiddenGlobalForInspector = ['tab-presupuesto', 'tab-danos', 'tab-fotos', 'tab-snapshots', 'tab-admin'];
    if (forbiddenGlobalForInspector.includes(tabId)) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'Módulo No Autorizado',
          text: 'Como Inspector de Terreno, las operaciones periciales de partidas, mediciones y fotografías deben gestionarse dentro del expediente asignado correspondiente.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#10222F'
        });
      } else {
        M.toast({
          html: 'Acceso restringido: En perfil Inspector, gestione daños y fotos directamente dentro de su expediente en <b>Mis Expedientes</b>.',
          classes: 'blue-grey darken-4'
        });
      }
      showInspectorHome('dashboard');
      return;
    }
  }

  // El panel administrativo exige perfil administrador o supervisor.
  if (tabId === 'tab-admin' && !isAdminRole()) {
    M.toast({
      html: 'El Panel Admin requiere un perfil de administrador o supervisor.',
      classes: 'blue-grey darken-3'
    });
    return;
  }

  const tabsElement = document.querySelector('.tabs');
  const tabsInstance = tabsElement ? M.Tabs.getInstance(tabsElement) : null;
  if (tabsInstance) {
    try {
      tabsInstance.select(tabId);
    } catch (navError) {
      console.warn('[NAV] No fue posible sincronizar el indicador de pestañas:', navError.message);
    }
  }

  applyPanelVisibility(tabId);
  syncNavigationState(tabId);

  // El hash se actualiza sin recargar ni provocar saltos de ancla.
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', `#${tabId}`);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Disparar cargas bajo demanda según pestaña
  if (tabId === 'tab-dashboard' && currentCaseData) {
    requestAnimationFrame(() => {
      renderProfileSpecificDashboards(currentCaseData);
    });
  } else if (tabId === 'tab-inspector-expedientes') {
    loadInspectorAssignedCases();
  }
}

// Muestra únicamente la sección solicitada (comportamiento determinista, independiente
// del viewport, del componente Materialize y del motor de impresión).
function applyPanelVisibility(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === tabId;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? 'block' : 'none';
  });
}

// Sincroniza los estados activos de las tres barras de navegación.
function syncNavigationState(tabId) {
  if (!tabId) return;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active-nav-link', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.sidebar-menu-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.mobile-bottom-nav a').forEach(item => {
    item.classList.toggle('active', item.getAttribute('href') === `#${tabId}`);
  });

  // Breadcrumbs
  const breadcrumb = document.getElementById('app-breadcrumbs-current');
  if (breadcrumb) {
    const labels = {
      'tab-dashboard': (currentRole === 'admin' ? 'Dashboard Gerencial' : 'Dashboard'),
      'tab-admin': 'Módulo Admin & Control de Expedientes',
      'tab-presupuesto': 'Mantenedor de Partidas & Acta Oficial',
      'tab-danos': 'Mantenedor de Levantamiento Geométrico',
      'tab-fotos': 'Mantenedor de Evidencias Fotográficas',
      'tab-snapshots': 'Mantenedor de Snapshots Inmutables',
      'tab-inspector-expedientes': 'Mis Expedientes Asignados',
      'tab-ficha-inspeccion': 'Ficha de Inspección'
    };
    breadcrumb.textContent = labels[tabId] || tabId;
  }

  // Cerrar sidebar móvil al navegar
  window.toggleMobileSidebar(false);
}

// Estado inicial: una sola sección visible y ningún panel apilado.
function setupTabPanels() {
  const panels = document.querySelectorAll('.tab-panel');
  if (!panels.length) return;
  const initialPanel = document.querySelector('.tab-panel.active') || panels[0];
  applyPanelVisibility(initialPanel.id);
  syncNavigationState(initialPanel.id);
}

// El módulo administrativo exige un rol real emitido por el servidor (admin o
// supervisor); el rol de vista por sí solo no habilita controles tarifarios.
function canUseAdminModule() {
  if (!currentUser) return false;
  return currentUser.rol === 'admin' || currentUser.rol === 'supervisor' || currentUser.rol === 'webmaster';
}

// Comprueba si el usuario tiene doble perfil registrado en la base de datos
function hasDualProfile() {
  if (!currentUser) return false;
  // REGLA ESTRICTA: El cliente no puede ser inspector ni tener dos roles
  if (currentUser.rol === 'cliente') return false;
  return currentUser.doble_perfil === true || 
    (Array.isArray(currentUser.roles) && currentUser.roles.includes('admin') && currentUser.roles.includes('inspector'));
}

function isAdminRole() {
  return currentRole === 'admin' && canUseAdminModule();
}

// Navegación unificada por delegación: un solo punto de entrada cubre el menú
// superior, las pestañas internas y la barra inferior móvil, incluso si el
// marcado se regenera dinámicamente.
function setupNavigationDelegation() {
  document.addEventListener('click', (event) => {
    const navItem = event.target.closest(
      '.nav-tab-btn, .mobile-bottom-nav a, .tabs .tab a, [data-tab]'
    );
    if (!navItem) return;

    const href = navItem.getAttribute('href') || '';

    if (href === '#camera-trigger') {
      event.preventDefault();
      triggerPhotoCapture();
      return;
    }

    const tabId =
      navItem.getAttribute('data-tab') || (href.indexOf('#tab-') === 0 ? href.slice(1) : '');
    if (!tabId || tabId.indexOf('tab-') !== 0) return;

    event.preventDefault();
    switchTab(tabId);
  });
}

// Enrutado por hash: permite abrir una sección directamente y respeta los
// botones atrás/adelante del navegador.
function setupHashRouting() {
  const syncFromHash = () => {
    const tabId = (window.location.hash || '').replace('#', '');
    if (!tabId || !document.getElementById(tabId)) return;
    // El panel administrativo se valida con el rol real antes de enrutar.
    if (tabId === 'tab-admin' && !isAdminRole()) return;
    switchTab(tabId);
  };

  window.addEventListener('hashchange', syncFromHash);
  syncFromHash();
}

// Alternar entre perfil Inspector (Móvil) y Administrador:
// REGLA ESTRICTA: Solo permitido si el usuario posee DOBLE PERFIL en base de datos.
function toggleUserRole() {
  if (currentUser && currentUser.rol === 'cliente') {
    M.toast({ 
      html: 'Acceso restringido: Las cuentas de clientes no pueden alternar roles ni acceder a funciones periciales.', 
      classes: 'red darken-3' 
    });
    return;
  }
  if (!hasDualProfile()) {
    M.toast({ 
      html: 'Acceso restringido: Su usuario no posee doble perfil (Inspector/Admin) habilitado en la base de datos.', 
      classes: 'amber darken-4' 
    });
    return;
  }

  currentRole = currentRole === 'admin' ? 'inspector' : 'admin';
  updateRoleUI();

  if (currentRole === 'admin') {
    switchTab('tab-dashboard');
    M.toast({ html: 'Vista Administrador Activa: Dashboard Gerencial.', classes: 'purple darken-3' });
  } else {
    showInspectorHome();
    M.toast({ html: 'Vista Inspector de Terreno Activa (Doble Perfil BD).', classes: 'blue darken-3' });
  }
}

function updateRoleUI() {
  const roleLabel = document.getElementById('current-role-label');
  const rolePillIcon = document.getElementById('current-role-icon');
  const adminTabHeader = document.getElementById('tab-header-admin');
  const adminTabItem = document.getElementById('tab-item-admin');
  const adminFloatingIndicator = document.getElementById('admin-mode-banner');
  const mobileAdminTab = document.getElementById('mobile-nav-admin');
  const roleToggle = document.getElementById('role-toggle-btn');
  const adminSwitcherBox = document.getElementById('profile-admin-switcher-box');
  const sidebarItemAdmin = document.getElementById('sidebar-item-admin');
  const sidebarSectionAdmin = document.getElementById('sidebar-section-admin-title');

  const dualAllowed = hasDualProfile();

  // Si el usuario NO tiene doble perfil en base de datos, su rol queda fijado al rol de BD
  if (!dualAllowed && currentUser) {
    if (currentUser.rol === 'cliente') {
      currentRole = 'cliente';
    } else if (currentUser.rol === 'ajustador') {
      currentRole = 'ajustador';
    } else {
      currentRole = currentUser.rol === 'admin' || currentUser.rol === 'supervisor' || currentUser.rol === 'webmaster' ? 'admin' : 'inspector';
    }
  }

  const isInspector = currentRole === 'inspector';
  const isAdjuster = currentRole === 'ajustador';
  const isClient = currentRole === 'cliente';
  const canAdmin = canUseAdminModule();
  const adminActive = canAdmin && currentRole === 'admin';
  const identity = `${(currentUser && currentUser.email) || ''} ${(currentUser && currentUser.nombre) || ''} ${(currentUser && currentUser.username) || ''}`.toLowerCase();
  const isWebmaster = identity.includes('webmaster');

  // Marca de perfil visible en la barra superior y sidebar
  let roleTitle = 'INSPECTOR';
  if (adminActive) {
    roleTitle = isWebmaster ? 'WEBMASTER' : 'ADMINISTRADOR';
  } else if (isAdjuster) {
    roleTitle = 'AJUSTADOR';
  } else if (currentRole === 'cliente') {
    roleTitle = 'CLIENTE';
  }

  if (roleLabel) roleLabel.textContent = roleTitle;
  if (rolePillIcon) rolePillIcon.textContent = adminActive ? (isWebmaster ? 'terminal' : 'admin_panel_settings') : (isAdjuster ? 'calculate' : (isClient ? 'person_pin' : 'person'));

  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserRole = document.getElementById('sidebar-user-role');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const initial = (currentUser && currentUser.nombre ? currentUser.nombre.charAt(0) : 'U').toUpperCase();

  if (sidebarUserName) sidebarUserName.textContent = currentUser ? currentUser.nombre : 'Usuario';
  if (sidebarUserRole) sidebarUserRole.textContent = roleTitle;
  if (sidebarUserAvatar) sidebarUserAvatar.textContent = initial;

  // Saludo en el dashboard del inspector
  const inspectorGreeting = document.getElementById('inspector-dashboard-greeting');
  if (inspectorGreeting) {
    inspectorGreeting.textContent = currentUser && currentUser.nombre ? currentUser.nombre : 'Inspector';
  }

  // Alternancia de contenedores principales entre Cliente, Inspector, Ajustador y Administrador (Arquitectura SPA)
  const clientMain = document.getElementById('client-main-content');
  const inspectorMain = document.getElementById('inspector-main-content');
  const adjusterMain = document.getElementById('adjuster-main-content');
  const adminMain = document.getElementById('admin-main-content');
  const adminFinRow = document.getElementById('admin-financial-metrics-row');

  if (isClient) {
    document.body.classList.add('is-client-role');
    document.body.classList.remove('is-inspector-role', 'is-admin-role', 'is-adjuster-role');

    if (clientMain) clientMain.style.display = 'block';
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adjusterMain) adjusterMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    if (sidebarUserRole) sidebarUserRole.textContent = 'CLIENTE';
    if (roleLabel) roleLabel.textContent = 'CLIENTE';
    if (rolePillIcon) rolePillIcon.textContent = 'person_pin';

    // Ocultar botones de acción operativa y administrativa (Los clientes NO generan partidas)
    const topbarBtnAdd = document.getElementById('topbar-btn-add-partida');
    if (topbarBtnAdd) topbarBtnAdd.style.setProperty('display', 'none', 'important');
    const roleToggle = document.getElementById('role-toggle-btn');
    if (roleToggle) roleToggle.style.setProperty('display', 'none', 'important');
    const topbarSearch = document.getElementById('topbar-search-input');
    if (topbarSearch && topbarSearch.parentElement) topbarSearch.parentElement.style.setProperty('display', 'none', 'important');

    // Ocultar menús de inspector, ajustador y admin
    const sidebarInspectorCases = document.getElementById('sidebar-item-inspector-expedientes');
    if (sidebarInspectorCases) sidebarInspectorCases.style.display = 'none';
    const sidebarFicha = document.getElementById('sidebar-item-ficha-inspeccion');
    if (sidebarFicha) sidebarFicha.style.display = 'none';
    const defaultDashboard = document.querySelector('a[data-tab="tab-dashboard"]');
    if (defaultDashboard && defaultDashboard.parentElement) defaultDashboard.parentElement.style.display = 'none';

    document.querySelectorAll('.sidebar-admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-inspector-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-adjuster-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-client-only').forEach(el => el.style.display = '');

    const desktopTabsBar = document.getElementById('desktop-tabs-bar');
    if (desktopTabsBar) desktopTabsBar.style.display = 'none';

    // Actualizar breadcrumbs superiores
    const breadcrumbCurrent = document.getElementById('app-breadcrumbs-current');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Portal del Cliente';

    // Actualizar píldora de usuario en el topbar y modal
    updateUserProfileUI();
    return;
  }

  if (isAdjuster) {
    document.body.classList.add('is-adjuster-role');
    document.body.classList.remove('is-inspector-role', 'is-admin-role', 'is-client-role');

    if (adjusterMain) adjusterMain.style.display = 'block';
    if (clientMain) clientMain.style.display = 'none';
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    if (sidebarUserRole) sidebarUserRole.textContent = 'AJUSTADOR';
    if (roleLabel) roleLabel.textContent = 'AJUSTADOR';
    if (rolePillIcon) rolePillIcon.textContent = 'calculate';

    // Ocultar botones no aplicables
    const topbarBtnAdd = document.getElementById('topbar-btn-add-partida');
    if (topbarBtnAdd) topbarBtnAdd.style.setProperty('display', 'none', 'important');
    const roleToggle = document.getElementById('role-toggle-btn');
    if (roleToggle) roleToggle.style.setProperty('display', 'none', 'important');
    const topbarSearch = document.getElementById('topbar-search-input');
    if (topbarSearch && topbarSearch.parentElement) topbarSearch.parentElement.style.setProperty('display', 'none', 'important');

    // Menús en Sidebar: Solo Ajustador
    document.querySelectorAll('.sidebar-admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-inspector-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-client-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-adjuster-only').forEach(el => el.style.display = '');

    const defaultDashboard = document.querySelector('a[data-tab="tab-dashboard"]');
    if (defaultDashboard && defaultDashboard.parentElement) defaultDashboard.parentElement.style.display = 'none';

    const desktopTabsBar = document.getElementById('desktop-tabs-bar');
    if (desktopTabsBar) desktopTabsBar.style.display = 'none';

    const breadcrumbCurrent = document.getElementById('app-breadcrumbs-current');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Panel de Control del Ajustador';

    updateUserProfileUI();
    loadAdjusterDashboard();
    return;
  }

  // Si no es cliente, restaurar clases de body y controles
  document.body.classList.remove('is-client-role');
  if (isInspector) {
    document.body.classList.add('is-inspector-role');
    document.body.classList.remove('is-admin-role');
  } else {
    document.body.classList.add('is-admin-role');
    document.body.classList.remove('is-inspector-role');
  }

  if (clientMain) clientMain.style.display = 'none';
  if (adjusterMain) adjusterMain.style.display = 'none';
  document.querySelectorAll('.sidebar-client-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.sidebar-adjuster-only').forEach(el => el.style.display = 'none');
  const defaultDashboard = document.querySelector('a[data-tab="tab-dashboard"]');
  if (defaultDashboard && defaultDashboard.parentElement) defaultDashboard.parentElement.style.display = '';
  const topbarSearch = document.getElementById('topbar-search-input');
  if (topbarSearch && topbarSearch.parentElement) topbarSearch.parentElement.style.removeProperty('display');

  // Alternador de roles en topbar: solo visible si el usuario tiene doble perfil en BD
  if (roleToggle) {
    roleToggle.style.setProperty('display', dualAllowed ? 'inline-flex' : 'none', 'important');
  }

  if (isInspector) {
    if (inspectorMain) inspectorMain.style.display = 'block';
    if (adminMain) adminMain.style.display = 'none';
    if (adminFinRow) adminFinRow.style.display = 'none';
    const userNameEl = document.getElementById('inspector-home-user-name');
    if (userNameEl) userNameEl.textContent = (currentUser && currentUser.nombre) ? currentUser.nombre : 'Inspector';

    const sidebarLabel = document.getElementById('sidebar-label-dashboard');
    if (sidebarLabel) sidebarLabel.textContent = 'Mi Dashboard';
    const sidebarIcon = document.getElementById('sidebar-icon-dashboard');
    if (sidebarIcon) sidebarIcon.textContent = 'dashboard';
    const mainTabLabel = document.getElementById('main-tab-dashboard-text');
    if (mainTabLabel) mainTabLabel.textContent = 'Mi Dashboard';
    const mobileTabDashText = document.getElementById('mobile-tab-dashboard-text');
    if (mobileTabDashText) mobileTabDashText.textContent = 'Mi Dashboard';

    // Mostrar menú de inspector: Mi Dashboard, Mis Expedientes, Mi Perfil, Cerrar Sesión
    document.querySelectorAll('.sidebar-inspector-only').forEach((el) => {
      el.style.display = '';
    });
    document.querySelectorAll('.mobile-inspector-only').forEach((el) => {
      el.style.display = 'inline-flex';
    });
  } else {
    if (inspectorMain) inspectorMain.style.display = 'none';
    if (adminMain) adminMain.style.display = 'block';
    if (adminFinRow) adminFinRow.style.display = 'flex';

    // Ocultar elementos exclusivos del Inspector
    document.querySelectorAll('.sidebar-inspector-only').forEach((el) => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.mobile-inspector-only').forEach((el) => {
      el.style.display = 'none';
    });

    // MODO ADMINISTRADOR ACTIVO: Dashboard Gerencial y Módulo Admin
    const sidebarLabel = document.getElementById('sidebar-label-dashboard');
    if (sidebarLabel) sidebarLabel.textContent = 'Dashboard Gerencial';
    const sidebarIcon = document.getElementById('sidebar-icon-dashboard');
    if (sidebarIcon) sidebarIcon.textContent = 'insights';
    const mainTabLabel = document.getElementById('main-tab-dashboard-text');
    if (mainTabLabel) mainTabLabel.textContent = 'Dashboard Gerencial';
    const mobileTabDashText = document.getElementById('mobile-tab-dashboard-text');
    if (mobileTabDashText) mobileTabDashText.textContent = 'Dashboard';

    if (adminFloatingIndicator) {
      adminFloatingIndicator.innerHTML = '<i class="material-icons tiny" style="vertical-align: middle; margin-right: 4px;">admin_panel_settings</i> MODO ADMINISTRADOR ACTIVO — Dashboard Gerencial, Auditoría y Módulo de Administración Lorens.';
    }
  }

  // 1. RESTRICCIÓN OBLIGATORIA: El botón + Partida NO debe aparecer como acción global para el Inspector
  const topbarBtnAdd = document.getElementById('topbar-btn-add-partida');
  if (topbarBtnAdd) {
    if (isInspector) {
      topbarBtnAdd.style.setProperty('display', 'none', 'important');
    } else {
      topbarBtnAdd.style.removeProperty('display');
    }
  }

  // 2. REGLA OBLIGATORIA DE NAVEGACIÓN: En rol inspector, NO mostrar como módulos globales independientes:
  // Acta de Presupuesto, Levantamiento, Evidencias, Snapshots, Panel Admin
  const sidebarInspectorCases = document.getElementById('sidebar-item-inspector-expedientes');
  if (sidebarInspectorCases) {
    sidebarInspectorCases.style.display = isInspector ? '' : 'none';
  }

  document.querySelectorAll('.sidebar-admin-only').forEach((element) => {
    element.style.display = isInspector ? 'none' : '';
  });

  const desktopTabsBar = document.getElementById('desktop-tabs-bar');
  if (desktopTabsBar) {
    desktopTabsBar.style.display = isInspector ? 'none' : '';
  }

  const globalCaseControlBar = document.getElementById('global-case-control-bar');
  if (globalCaseControlBar) {
    globalCaseControlBar.style.display = isInspector ? 'none' : '';
  }

  // Barra móvil
  const mobileNavInspectorCases = document.getElementById('mobile-nav-inspector-cases');
  if (mobileNavInspectorCases) mobileNavInspectorCases.style.display = isInspector ? 'inline-flex' : 'none';
  const mobileNavCamera = document.getElementById('mobile-nav-camera');
  if (mobileNavCamera) mobileNavCamera.style.display = isInspector ? 'inline-flex' : 'none';

  document.querySelectorAll('.mobile-admin-only').forEach((element) => {
    element.style.display = isInspector ? 'none' : 'inline-flex';
  });

  // El botón alternador de rol (Navbar y Modal) SOLO existe si tiene doble perfil en BD
  if (roleToggle) roleToggle.style.display = dualAllowed ? 'inline-flex' : 'none';
  if (adminSwitcherBox) adminSwitcherBox.style.display = dualAllowed ? 'block' : 'none';

  // Accesos al módulo admin: dependen del rol real
  [adminTabHeader, adminTabItem, mobileAdminTab, sidebarItemAdmin, sidebarSectionAdmin].forEach((element) => {
    if (element) element.style.display = canAdmin ? '' : 'none';
  });
  if (adminFloatingIndicator) adminFloatingIndicator.style.display = adminActive ? 'block' : 'none';

  // Controles exclusivos del administrador
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.style.display = adminActive ? '' : 'none';
  });

  // Si el visitante está en una sección no permitida para inspector, redirigir al Dashboard
  const forbiddenPanels = ['tab-presupuesto', 'tab-danos', 'tab-fotos', 'tab-snapshots', 'tab-admin'];
  const activePanel = document.querySelector('.tab-panel.active');
  if (isInspector && activePanel && forbiddenPanels.includes(activePanel.id)) {
    switchTab('tab-dashboard');
  }

  // Actualizar perfiles y dashboard según rol
  updateUserProfileUI();
  if (currentCaseData) {
    renderProfileSpecificDashboards(currentCaseData);
  }

  if (adminActive) renderAdminViews();
}

// Cargar expediente desde la API o Fallback
async function loadCase(caseId) {
  try {
    const data = await ApiService.getCaseDetails(caseId);
    currentCaseData = data;
    renderAll(currentCaseData);
  } catch (err) {
    console.error('[loadCase] Error al cargar expediente desde PostgreSQL:', err.message);
    M.toast({ html: 'No fue posible cargar el expediente desde la base de datos.', classes: 'red darken-3' });
  }
}

// Renderizar todos los componentes
function renderAll(data) {
  BudgetViewer.renderHeader(data.expediente);
  BudgetViewer.renderTable(data.lines, data.expenses);
  BudgetViewer.renderSummary(data.summary);
  renderLevantamientoTable(data.lines);
  renderPhotos(data.photos);
  loadSnapshotsList(data.expediente.id);
  updateKPIBadges(data);
  renderProfileSpecificDashboards(data);
  updateUserProfileUI();
  updateDraftBadge();
  renderAdminViews();

  // El canvas solo puede medirse cuando la sección de métricas está visible.
  if (document.getElementById('tab-dashboard')?.classList.contains('active')) {
    BudgetViewer.renderCanvasChart(data.summary, data.lines, data.expenses);
  }
}

// Actualizar la visualización del perfil de usuario (Navbar y Modal)
function updateUserProfileUI() {
  if (!currentUser) return;

  const identity = `${currentUser.email || ''} ${currentUser.nombre || ''}`.toLowerCase();
  const isWebmaster = identity.includes('webmaster');
  const isAdmin = currentUser.rol === 'admin';
  const isCliente = currentUser.rol === 'cliente';
  const initial = (currentUser.nombre || 'U').charAt(0).toUpperCase();

  const roleText = isCliente ? 'CLIENTE' : (isWebmaster ? 'WEBMASTER' : (isAdmin ? 'ADMINISTRADOR' : 'INSPECTOR'));
  const privilegesText = isCliente
    ? 'Portal del Cliente (Consulta exclusiva de expedientes, línea de tiempo y evidencias autorizadas)'
    : (isWebmaster 
      ? 'Webmaster General (Control Total, Gestión de Usuarios y Permisos)'
      : (isAdmin ? 'Administrador de Siniestros (Auditoría, Tarifas y Firmas)' : 'Inspector de Terreno (Levantamiento, Metraje y Fotos)'));

  // 1. Píldora del Navbar (extremo derecho)
  const navAvatar = document.getElementById('nav-user-avatar');
  const navName = document.getElementById('nav-user-name');
  const navRole = document.getElementById('nav-user-role');

  if (navAvatar) navAvatar.textContent = initial;
  if (navName) navName.textContent = currentUser.nombre ? currentUser.nombre.split(' ')[0] : (isCliente ? 'Cliente' : 'Usuario');
  if (navRole) {
    navRole.textContent = roleText;
    if (isCliente) {
      navRole.style.color = '#0284c7';
    } else if (isAdmin) {
      navRole.style.color = 'var(--emerald-600, #059669)';
    } else {
      navRole.style.color = 'var(--amber-600, #d97706)';
    }
  }

  // 2. Sidebar usuario
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserRole = document.getElementById('sidebar-user-role');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  if (sidebarUserName) sidebarUserName.textContent = currentUser.nombre || 'Usuario';
  if (sidebarUserRole) sidebarUserRole.textContent = roleText;
  if (sidebarUserAvatar) sidebarUserAvatar.textContent = initial;

  // 3. Modal de Perfil de Usuario
  const modalAvatar = document.getElementById('profile-modal-avatar');
  const modalName = document.getElementById('profile-modal-name');
  const modalRole = document.getElementById('profile-modal-role-badge');
  const modalEmail = document.getElementById('profile-modal-email');
  const modalPrivileges = document.getElementById('profile-modal-privileges');
  const modalCase = document.getElementById('profile-modal-case');
  const adminSwitcherBox = document.getElementById('profile-admin-switcher-box');
  const toggleRoleLabel = document.getElementById('profile-toggle-role-label');

  if (modalAvatar) modalAvatar.textContent = initial;
  if (modalName) modalName.textContent = currentUser.nombre || 'Usuario del Sistema';
  if (modalRole) {
    modalRole.textContent = isCliente ? 'CLIENTE / ASEGURADO' : roleText;
    modalRole.className = 'user-role-badge ' + (isCliente ? 'blue white-text' : (isAdmin ? 'role-admin-badge' : 'role-inspector-badge'));
  }
  if (modalEmail) modalEmail.textContent = currentUser.email || 'usuario@lorens.cl';
  if (modalPrivileges) modalPrivileges.textContent = privilegesText;
  if (modalCase) {
    if (isCliente) {
      modalCase.textContent = 'Portal de Siniestros Asignados';
    } else if (currentCaseData && currentCaseData.expediente) {
      modalCase.textContent = `${currentCaseData.expediente.codigo || 'SIS-2026-084'} · ${currentCaseData.expediente.cliente_nombre || 'Juan Pérez'}`;
    } else {
      modalCase.textContent = 'Ningún expediente seleccionado';
    }
  }

  // Switcher en el modal SOLO si el usuario tiene doble perfil registrado en BD (Los clientes NUNCA pueden tener doble perfil)
  const dualAllowed = hasDualProfile() && !isCliente;
  if (adminSwitcherBox) {
    adminSwitcherBox.style.display = dualAllowed ? 'block' : 'none';
  }
  if (toggleRoleLabel) {
    toggleRoleLabel.textContent = currentRole === 'admin' ? 'Cambiar a Vista Inspector de Terreno' : 'Cambiar a Vista Administrador';
  }

  const dualBadge = document.getElementById('profile-modal-dual-status');
  if (dualBadge) {
    dualBadge.textContent = isCliente ? 'No habilitado (Rol exclusivo Cliente / Asegurado)' : (dualAllowed ? 'Habilitado (Admin & Inspector en BD)' : 'No habilitado (Perfil único según BD)');
    dualBadge.className = 'detail-value font-weight-bold ' + (dualAllowed ? 'green-text text-darken-3' : 'grey-text text-darken-2');
  }
}

// Renderizar dashboards separados por perfil (Inspector vs Administrador)
function renderProfileSpecificDashboards(data) {
  if (!data) return;

  const identity = `${(currentUser && currentUser.email) || ''} ${(currentUser && currentUser.nombre) || ''} ${(currentUser && currentUser.username) || ''}`.toLowerCase();
  const isWebmaster = identity.includes('webmaster');
  const isInspector = currentRole === 'inspector';
  const isAdmin = currentRole === 'admin' && !isWebmaster;

  const webmasterBox = document.getElementById('dashboard-webmaster-container');
  const adminBox = document.getElementById('dashboard-admin-container');
  const inspectorBox = document.getElementById('dashboard-inspector-container');

  // Mostrar únicamente el dashboard del perfil activo
  if (webmasterBox) webmasterBox.style.display = (isWebmaster && currentRole === 'admin') ? 'block' : 'none';
  if (adminBox) adminBox.style.display = (isAdmin && currentRole === 'admin') ? 'block' : 'none';
  if (inspectorBox) inspectorBox.style.display = isInspector ? 'block' : 'none';

  // Sincronizar etiquetas de tab en Sidebar, Topbar y Tabs
  const sidebarLabel = document.getElementById('sidebar-label-dashboard');
  const navDashboardLink = document.getElementById('nav-link-dashboard');
  const tabDashboardText = document.getElementById('main-tab-dashboard-text');
  const tabDashboardIcon = document.getElementById('main-tab-dashboard-icon');
  const mobileDashboardText = document.getElementById('mobile-tab-dashboard-text');

  let titleText = 'Dashboard Inspector';
  let iconName = 'engineering';
  if (isWebmaster && currentRole === 'admin') {
    titleText = 'Dashboard Webmaster';
    iconName = 'terminal';
  } else if (currentRole === 'admin') {
    titleText = 'Dashboard Gerencial';
    iconName = 'insights';
  }

  if (sidebarLabel) sidebarLabel.textContent = titleText;
  if (navDashboardLink) navDashboardLink.textContent = titleText;
  if (tabDashboardText) tabDashboardText.textContent = titleText;
  if (tabDashboardIcon) tabDashboardIcon.textContent = iconName;
  if (mobileDashboardText) mobileDashboardText.textContent = isInspector ? 'Inspector' : 'Gerencial';

  // Renderizar contenido del dashboard correspondiente
  if (isWebmaster && currentRole === 'admin') {
    renderWebmasterDashboard();
  } else if (currentRole === 'admin') {
    renderAdminDashboard(data);
  } else {
    renderInspectorDashboard(data);
  }
}

async function renderWebmasterDashboard() {
  const usersTableBody = document.getElementById('webmaster-users-table-body');
  const kpiTotal = document.getElementById('webmaster-kpi-users-total');
  const kpiActive = document.getElementById('webmaster-kpi-users-active');
  const kpiDbStatus = document.getElementById('webmaster-kpi-db-status');
  const kpiDbDesc = document.getElementById('webmaster-kpi-db-desc');
  const kpiServerStatus = document.getElementById('webmaster-kpi-server-status');
  const kpiUptimeDesc = document.getElementById('webmaster-kpi-uptime-desc');
  const auditTableBody = document.getElementById('webmaster-audit-table-body');

  // 1. Usuarios del sistema
  try {
    const users = await ApiService.getUsers();
    if (Array.isArray(users) && users.length > 0) {
      if (kpiTotal) kpiTotal.textContent = users.length;
      const activeCount = users.filter(u => u.activo !== false).length;
      if (kpiActive) kpiActive.textContent = activeCount;
      const badge = document.getElementById('webmaster-users-badge');
      if (badge) badge.textContent = `${users.length} Cuentas Registradas`;

      if (usersTableBody) {
        usersTableBody.innerHTML = '';
        users.forEach(u => {
          const tr = document.createElement('tr');
          const isDual = u.doble_perfil === true;
          tr.innerHTML = `
            <td>
              <strong style="color: var(--navy-950);">${u.nombre}</strong>
            </td>
            <td><code>${u.email}</code></td>
            <td>
              <span class="badge ${u.rol === 'admin' ? 'purple lighten-5 purple-text text-darken-3' : 'amber lighten-5 amber-text text-darken-4'}" style="font-weight: 700; border-radius: 4px;">
                ${u.rol ? u.rol.toUpperCase() : 'INSPECTOR'}
              </span>
            </td>
            <td class="center-align">
              <span class="badge ${isDual ? 'green lighten-5 green-text text-darken-3' : 'grey lighten-4 grey-text text-darken-1'}" style="font-weight: 700; border-radius: 4px;">
                ${isDual ? '✓ Sí (Dual)' : '✗ No (Fijo)'}
              </span>
            </td>
            <td class="center-align">
              <span class="badge green lighten-4 green-text text-darken-4 font-weight-bold" style="border-radius: 12px; font-size: 0.72rem;">Activo</span>
            </td>
            <td style="font-size: 0.8rem; color: var(--slate-600);">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '01/01/2026'}</td>
          `;
          usersTableBody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.warn('[Webmaster] Error cargando usuarios:', err.message);
  }

  // 2. Salud de Servicios y PostgreSQL
  try {
    const status = await ApiService.getSystemStatus();
    if (status) {
      const isConnected = status.database && status.database.connected;
      if (kpiDbStatus) {
        kpiDbStatus.textContent = isConnected ? 'ONLINE' : 'CONTINGENCIA';
        kpiDbStatus.style.color = isConnected ? '#059669' : '#d97706';
      }
      if (kpiDbDesc) {
        kpiDbDesc.textContent = isConnected 
          ? `Latencia: ${status.database.latencyMs || 8}ms` 
          : 'Catálogo local activo';
      }
      if (kpiServerStatus) {
        kpiServerStatus.textContent = `${status.system?.memoryUsageMB || 45} MB`;
      }
      if (kpiUptimeDesc) {
        const mins = Math.floor((status.uptimeSeconds || 60) / 60);
        kpiUptimeDesc.textContent = `Uptime: ${mins} min activo`;
      }

      const modeEl = document.getElementById('webmaster-system-mode');
      const hostEl = document.getElementById('webmaster-system-host');
      const dbEl = document.getElementById('webmaster-system-db');
      const nodeEl = document.getElementById('webmaster-system-node');
      const memEl = document.getElementById('webmaster-system-memory');

      if (modeEl) modeEl.textContent = status.database?.mode || 'Activo';
      if (hostEl) hostEl.textContent = `${status.database?.host || 'localhost'}:${status.database?.port || 5432}`;
      if (dbEl) dbEl.textContent = status.database?.databaseName || 'lorens_db';
      if (nodeEl) nodeEl.textContent = status.system?.nodeVersion || 'v22.x';
      if (memEl) memEl.textContent = `${status.system?.memoryUsageMB || 45} MB`;
    }
  } catch (err) {
    console.warn('[Webmaster] Error obteniendo salud del sistema:', err.message);
  }

  // 3. Auditoría del Sistema
  try {
    const auditLogs = await ApiService.getAuditLogs();
    if (Array.isArray(auditLogs) && auditTableBody) {
      auditTableBody.innerHTML = '';
      auditLogs.slice(0, 15).forEach(log => {
        const tr = document.createElement('tr');
        const dt = log.fecha ? new Date(log.fecha).toLocaleString() : 'Reciente';
        const detailsStr = typeof log.detalles === 'object' ? JSON.stringify(log.detalles) : (log.detalles || 'Operación regular');
        tr.innerHTML = `
          <td><code style="font-size: 0.75rem;">${dt}</code></td>
          <td><strong>${log.usuario_nombre || 'Sistema'}</strong></td>
          <td><span class="badge blue lighten-5 blue-text text-darken-3" style="border-radius: 4px; font-weight: 700;">${log.accion}</span></td>
          <td style="color: var(--slate-600);"><small>${detailsStr.substring(0, 45)}</small></td>
        `;
        auditTableBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.warn('[Webmaster] Error cargando auditoría:', err.message);
  }
}

function renderAdminDashboard(data) {
  const lineCount = (data.lines || []).length;
  const sectors = new Set((data.lines || []).map(l => l.sector));

  const adminKpiPartidas = document.getElementById('admin-kpi-partidas');
  const adminKpiSectores = document.getElementById('admin-kpi-sectores');
  if (adminKpiPartidas) adminKpiPartidas.textContent = lineCount;
  if (adminKpiSectores) adminKpiSectores.textContent = sectors.size;

  // Renderizar la tabla de auditoría de expedientes
  renderAdminExpedientesTable();

  // Redibujar gráfico canvas
  if (document.getElementById('tab-dashboard')?.classList.contains('active')) {
    BudgetViewer.renderCanvasChart(data.summary, data.lines, data.expenses);
  }
}

async function renderInspectorDashboard(data) {
  const lineCount = (data.lines || []).length;
  const photoCount = (data.photos || []).length;

  const kpiInspectorPartidas = document.getElementById('inspector-kpi-partidas');
  const kpiInspectorFotos = document.getElementById('inspector-kpi-fotos');

  if (kpiInspectorPartidas) kpiInspectorPartidas.textContent = lineCount;
  if (kpiInspectorFotos) kpiInspectorFotos.textContent = photoCount;

  // Cargar casos asignados para alimentar KPIs y tabla de prioridad
  try {
    const cases = await getInspectorAssignedCasesList();
    if (Array.isArray(cases)) {
      const totalCount = cases.length;
      const pendientesCount = cases.filter(c => c.estado === 'en_espera').length;
      const procesoCount = cases.filter(c => c.estado === 'activo' || !c.estado).length;
      const completadosCount = cases.filter(c => c.estado === 'procesado').length;

      const elTotal = document.getElementById('inspector-kpi-total-casos');
      const elPend = document.getElementById('inspector-kpi-casos-pendientes');
      const elProc = document.getElementById('inspector-kpi-casos-proceso');
      const elComp = document.getElementById('inspector-kpi-casos-completados');

      if (elTotal) elTotal.textContent = totalCount;
      if (elPend) elPend.textContent = pendientesCount;
      if (elProc) elProc.textContent = procesoCount;
      if (elComp) elComp.textContent = completadosCount;

      // Renderizar tabla de prioridad en el dashboard del inspector
      const priorityBody = document.getElementById('inspector-dashboard-priority-cases-body');
      if (priorityBody) {
        priorityBody.innerHTML = '';
        cases.slice(0, 5).forEach(c => {
          const tr = document.createElement('tr');
          const estadoBadge = c.estado === 'procesado'
            ? '<span class="badge blue lighten-5 blue-text text-darken-3" style="font-weight: 700; border-radius: 4px;">PROCESADO</span>'
            : (c.estado === 'en_espera'
              ? '<span class="badge amber lighten-5 amber-text text-darken-4" style="font-weight: 700; border-radius: 4px;">EN ESPERA</span>'
              : '<span class="badge green lighten-5 green-text text-darken-3" style="font-weight: 700; border-radius: 4px;">ACTIVO</span>');

          tr.innerHTML = `
            <td><strong style="color: var(--navy-950);">${c.codigo}</strong></td>
            <td>${c.cliente_nombre || 'Cliente'}</td>
            <td><small style="color: var(--slate-600);">${c.direccion || c.comuna || 'Sin dirección'}</small></td>
            <td><small>${c.fecha_visita || '02/06/2026'}</small></td>
            <td>${estadoBadge}</td>
            <td class="center-align">
              <button type="button" class="btn btn-small primary darken-1 waves-effect" style="border-radius: 6px; font-weight: 700; text-transform: none; font-size: 0.78rem;" onclick="openCaseInspectionSheet('${c.id}')">
                <i class="material-icons left tiny">visibility</i>Ver Ficha
              </button>
            </td>
          `;
          priorityBody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.warn('[Inspector Dashboard] Error al cargar casos:', err.message);
  }
}

/**
 * Estado documental del acta según la especificación: el informe permanece como
 * BORRADOR mientras existan precios pendientes, evidencias faltantes o la
 * revisión técnica no esté confirmada.
 */
function updateDraftBadge() {
  const badge = document.getElementById('acta-estado-documento');
  if (!badge) return;

  const lines = (currentCaseData && currentCaseData.lines) || [];
  const photos = (currentCaseData && currentCaseData.photos) || [];
  const expediente = (currentCaseData && currentCaseData.expediente) || {};

  const pendientes = lines.filter((line) => {
    const pu = line.precio_unitario_neto;
    return pu === null || pu === undefined || Number.isNaN(parseFloat(pu));
  }).length;

  const faltantes = [];
  if (lines.length === 0) faltantes.push('partidas valorizadas');
  if (pendientes > 0) faltantes.push(`${pendientes} precio(s) pendiente(s)`);
  if (photos.length === 0) faltantes.push('evidencias fotográficas');
  if (!expediente.revisado) faltantes.push('revisión técnica');

  const esBorrador = faltantes.length > 0;
  badge.textContent = esBorrador ? 'BORRADOR' : 'INFORME OFICIAL';
  badge.className = `doc-state-badge ${esBorrador ? 'doc-state-draft' : 'doc-state-official'}`;
  badge.title = esBorrador
    ? `Faltan antecedentes para emitir el informe definitivo: ${faltantes.join(', ')}.`
    : 'Precios, evidencias y revisión técnica confirmados.';
}

// Actualizar indicadores secundarios
function updateKPIBadges(data) {
  const lineCount = (data.lines || []).length;
  const sectors = new Set((data.lines || []).map(l => l.sector));
  
  const elLines = document.getElementById('kpi-total-partidas');
  if (elLines) elLines.textContent = lineCount;

  const elSectors = document.getElementById('kpi-total-sectores');
  if (elSectors) elSectors.textContent = sectors.size;
}

// Renderizar tabla técnica de levantamiento (Desktop) y Cards (Móvil)
function renderLevantamientoTable(lines = []) {
  const tbody = document.getElementById('levantamiento-table-body');
  const mobileContainer = document.getElementById('levantamiento-mobile-cards');

  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (lines.length === 0) {
    const emptyMsg = `
      <div class="center-align grey-text" style="padding: 25px;">
        <i class="material-icons" style="font-size: 2.2rem; display: block; margin-bottom: 4px;">straighten</i>
        No hay partidas registradas. Pulsa en "Nueva Partida" para comenzar.
      </div>
    `;
    if (tbody) tbody.innerHTML = `<tr><td colspan="10">${emptyMsg}</td></tr>`;
    if (mobileContainer) mobileContainer.innerHTML = emptyMsg;
    return;
  }

  lines.forEach(l => {
    const finalQty = l.finalQty !== undefined ? l.finalQty : (l.cantidad_medida || 0);
    const pu = l.precio_unitario_neto !== null ? l.precio_unitario_neto : null;
    const subtotal = pu !== null ? Math.round(finalQty * pu) : 0;

    // 1. Desktop Table Row
    if (tbody) {
      const tr = document.createElement('tr');
      tr.dataset.sector = l.sector;
      tr.innerHTML = `
        <td><strong>${l.sector}</strong></td>
        <td>${l.elemento}</td>
        <td><span class="badge-tag blue lighten-5 blue-text text-darken-3">${l.dano_tipo}</span></td>
        <td>${l.reparacion_propuesta || l.descripcion_dano}</td>
        <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${l.metodo_calculo || 'direct'}</code></td>
        <td class="amount-col">${BudgetViewer.formatQty(l.cantidad_medida)} ${l.unidad_id}</td>
        <td class="amount-col">${l.cantidad_reparacion ? BudgetViewer.formatQty(l.cantidad_reparacion) + ' ' + l.unidad_id : '-'}</td>
        <td class="amount-col">${BudgetViewer.formatCLP(pu)}</td>
        <td class="amount-col" style="font-weight: 700; color: var(--navy-900);">${BudgetViewer.formatCLP(subtotal)}</td>
        <td class="center-align">
          <button class="btn-flat btn-small blue-text tooltipped" data-tooltip="Editar" onclick="editPartida('${l.id}')">
            <i class="material-icons" style="font-size: 1.15rem;">edit</i>
          </button>
          <button class="btn-flat btn-small red-text tooltipped" data-tooltip="Eliminar" onclick="deletePartida('${l.id}')">
            <i class="material-icons" style="font-size: 1.15rem;">delete</i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // 2. Mobile Damage Card (Optimizada para pantalla de celular del inspector)
    if (mobileContainer) {
      const card = document.createElement('div');
      card.className = 'damage-card-mobile';
      card.dataset.sector = l.sector;
      card.innerHTML = `
        <div class="header-info">
          <div>
            <div style="font-weight: 800; color: var(--navy-900); font-size: 0.95rem;">
              ${l.reparacion_propuesta || l.descripcion_dano}
            </div>
            <div style="font-size: 0.78rem; color: var(--slate-500); margin-top: 2px;">
              <strong>${l.sector}</strong> · ${l.elemento} (${l.dano_tipo})
            </div>
          </div>
          <span class="badge-unit">${l.unidad_id || 'm²'}</span>
        </div>

        <div class="amount-banner">
          <div>
            Medida Neta: <strong>${BudgetViewer.formatQty(finalQty)} ${l.unidad_id}</strong>
            <div style="font-size: 0.72rem; color: var(--slate-500);">(Fórmula: ${l.metodo_calculo || 'direct'})</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--slate-500);">Subtotal Estimado</div>
            <strong style="color: #b45309; font-size: 1.05rem; font-family: 'JetBrains Mono', monospace;">
              ${BudgetViewer.formatCLP(subtotal)}
            </strong>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button class="btn-small blue darken-3 waves-effect" onclick="editPartida('${l.id}')" style="border-radius: 4px; font-size: 0.75rem; text-transform: none;">
            <i class="material-icons left tiny" style="margin-right: 4px;">edit</i>Editar
          </button>
          <button class="btn-small red darken-3 waves-effect" onclick="deletePartida('${l.id}')" style="border-radius: 4px; font-size: 0.75rem; text-transform: none;">
            <i class="material-icons left tiny" style="margin-right: 4px;">delete</i>Eliminar
          </button>
        </div>
      `;
      mobileContainer.appendChild(card);
    }
  });

  M.Tooltip.init(document.querySelectorAll('.tooltipped'));

  const dropdowns = document.querySelectorAll('.dropdown-trigger');
  if (dropdowns.length) {
    M.Dropdown.init(dropdowns, { coverTrigger: false, constrainWidth: false });
  }
}

// Filtrar filas de levantamiento por sector
function filterLevantamientoBySector(sectorName) {
  const rows = document.querySelectorAll('#levantamiento-table-body tr');
  rows.forEach(r => {
    r.style.display = (sectorName === 'ALL' || r.dataset.sector === sectorName) ? '' : 'none';
  });

  const cards = document.querySelectorAll('#levantamiento-mobile-cards .damage-card-mobile');
  cards.forEach(c => {
    c.style.display = (sectorName === 'ALL' || c.dataset.sector === sectorName) ? '' : 'none';
  });
}

// Renderizar galería de fotos con lightbox interactivo (táctil en móvil)
function renderPhotos(photos = []) {
  const container = document.getElementById('photos-container');
  if (!container) return;
  container.innerHTML = '';
  photoRegistry.clear();

  if (!photos || photos.length === 0) {
    container.innerHTML = `
      <div class="col s12 center-align grey-text" style="padding: 24px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">add_a_photo</i>
        No se registran fotografías para este expediente.
      </div>
    `;
    return;
  }

  const galleryPhotos = photos;
  galleryPhotos.forEach(photo => {
    const key = String(photo.id || `photo-${photoRegistry.size + 1}`);
    photoRegistry.set(key, photo);

    const col = document.createElement('div');
    col.className = 'col s12 m6 l4';
    col.innerHTML = `
      <div class="photo-card-corporate">
        <div class="photo-card-media" data-photo-id="${key}" role="button" tabindex="0" aria-label="Ampliar evidencia del sector ${photo.sector || 'general'}">
          <img id="corporate-img-${key}" src="${photoSource(photo) || PHOTO_PLACEHOLDER}" alt="${photo.descripcion || 'Evidencia en terreno'}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PHOTO_PLACEHOLDER}'">
          <span class="photo-badge-sector">${photo.sector || 'GENERAL'}</span>
          <button type="button" class="photo-delete-btn" data-delete-photo="${key}" aria-label="Eliminar evidencia">
            <i class="material-icons">delete_outline</i>
          </button>
        </div>
        <div class="photo-content">
          <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--slate-700); line-height: 1.45;">
            ${photo.descripcion || 'Sin descripción registrada.'}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--slate-400); gap: 8px;">
            <span><i class="material-icons tiny" style="vertical-align: middle;">schedule</i> ${photo.created_at || '2026-06-02'}</span>
            <span class="blue-text text-darken-2 photo-detail-link" data-photo-id="${key}">Ver detalle</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(col);

    getAuthorizedPhotoUrl(photo).then((authUrl) => {
      const img = document.getElementById(`corporate-img-${key}`);
      if (img && authUrl) img.src = authUrl;
    }).catch(() => {});
  });

  // Delegación de eventos: evita inyectar data URLs extensas en atributos onclick.
  container.querySelectorAll('[data-photo-id]').forEach(element => {
    const open = () => openPhotoLightboxById(element.getAttribute('data-photo-id'));
    element.addEventListener('click', open);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  container.querySelectorAll('[data-delete-photo]').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      removePhoto(button.getAttribute('data-delete-photo'));
    });
  });
}

function openPhotoLightboxById(photoId) {
  const photo = photoRegistry.get(String(photoId));
  if (!photo) return;
  openPhotoLightbox(photoSource(photo), photo.sector || 'GENERAL', photo.descripcion || '');
}

// Abrir foto en Lightbox Modal
function openPhotoLightbox(src, sector, desc) {
  const modalEl = document.getElementById('modal-lightbox');
  if (!modalEl) return;
  const imgEl = document.getElementById('lightbox-img');
  const loaderEl = document.getElementById('lightbox-loader');
  const sectorEl = document.getElementById('lightbox-sector');
  const descEl = document.getElementById('lightbox-desc');

  if (sectorEl) sectorEl.textContent = sector || 'GENERAL';
  if (descEl) descEl.textContent = desc || '';

  if (imgEl) {
    imgEl.style.display = 'none';
    if (loaderEl) loaderEl.style.display = 'flex';

    imgEl.onload = () => {
      if (loaderEl) loaderEl.style.display = 'none';
      imgEl.style.display = 'block';
    };
    imgEl.onerror = () => {
      if (loaderEl) loaderEl.style.display = 'none';
      imgEl.style.display = 'block';
      imgEl.src = PHOTO_PLACEHOLDER;
    };
    imgEl.src = src || PHOTO_PLACEHOLDER;
  }

  const instance = M.Modal.getInstance(modalEl);
  if (instance) instance.open();
}

// ==============================================================
// EVIDENCIA FOTOGRÁFICA EN TERRENO (flujo táctil del inspector)
// ==============================================================
const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // Límite indicado en la especificación
const PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_STORAGE_PREFIX = 'lorens_photos_';
const PHOTO_STORAGE_LIMIT = 12;
// Marcador local para evidencias sin archivo disponible (evita peticiones externas).
const PHOTO_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e2e8f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#64748b" text-anchor="middle">Evidencia no disponible</text></svg>'
  );
const SECTOR_CATALOG = [
  'BAÑO 1', 'BAÑO 2', 'LIVING COMEDOR', 'COCINA', 'DORMITORIO 1', 'DORMITORIO 2',
  'PASILLO', 'FACHADA', 'PATIO', 'TECHUMBRE', 'GENERAL',
];

let pendingPhotoDraft = null;
const photoRegistry = new Map();

function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function photoSource(photo) {
  if (!photo) return '';
  if (typeof photo.data_url === 'string' && photo.data_url.startsWith('data:')) {
    return photo.data_url;
  }

  const token = (typeof ApiService !== 'undefined' && ApiService.getToken)
    ? ApiService.getToken()
    : localStorage.getItem('lorens_auth_token');

  let raw = photo.url || photo.ruta_almacenamiento || '';
  if (!raw && photo.id) {
    const cId = photo.expediente_id || currentCaseId;
    raw = `/api/cases/${cId}/photos/${photo.id}/file`;
  }
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (!raw.startsWith('/')) {
    const cId = photo.expediente_id || currentCaseId;
    raw = `/api/cases/${cId}/photos/${photo.id}/file`;
  }

  // Adjuntar siempre el token JWT para evitar 'Acceso no autorizado: Token no proporcionado.' en tags <img>
  if (raw.includes('/photos/') && raw.includes('/file')) {
    if (!raw.includes('token=') && token) {
      raw += (raw.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
    }
  }
  return raw;
}

let selectedPhotoSector = '';
let activePhotoFilterSector = 'all';

// Disparador directo de la cámara nativa del móvil
function triggerDirectCameraCapture(presetSector = null) {
  if (presetSector) selectedPhotoSector = presetSector.toUpperCase();
  const inputCamera = document.getElementById('foto-input-camera') || document.getElementById('input-foto-camera');
  if (inputCamera) {
    inputCamera.value = '';
    inputCamera.click();
  }
}

// Disparador directo de selección de galería
function triggerDirectGalleryCapture(presetSector = null) {
  if (presetSector) selectedPhotoSector = presetSector.toUpperCase();
  const inputGallery = document.getElementById('foto-input-gallery') || document.getElementById('input-foto-gallery');
  if (inputGallery) {
    inputGallery.value = '';
    inputGallery.click();
  }
}

function setupPhotoCapture() {
  const cameraInput = document.getElementById('foto-input-camera') || document.getElementById('input-foto-camera');
  const galleryInput = document.getElementById('foto-input-gallery') || document.getElementById('input-foto-gallery');
  const fileInput = document.getElementById('input-foto-file');

  if (cameraInput) cameraInput.addEventListener('change', handlePhotoFileSelected);
  if (galleryInput) galleryInput.addEventListener('change', handlePhotoFileSelected);
  if (fileInput) fileInput.addEventListener('change', handlePhotoFileSelected);
}

function triggerPhotoCapture() {
  openPhotoUploadModal();
}

function openPhotoUploadModal(presetSector = null) {
  pendingPhotoDraft = null;
  if (presetSector) {
    selectedPhotoSector = presetSector.toUpperCase();
  }

  const modalEl = document.getElementById('modal-nueva-foto');
  if (!modalEl) return;

  const preview = document.getElementById('foto-preview');
  const placeholder = document.getElementById('foto-preview-placeholder');
  const metaBar = document.getElementById('foto-meta-bar');
  const meta = document.getElementById('foto-meta');

  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'block';
  if (metaBar) metaBar.style.display = 'none';
  if (meta) meta.textContent = '';

  const cameraInput = document.getElementById('foto-input-camera') || document.getElementById('input-foto-camera');
  const galleryInput = document.getElementById('foto-input-gallery') || document.getElementById('input-foto-gallery');
  if (cameraInput) cameraInput.value = '';
  if (galleryInput) galleryInput.value = '';

  const desc = document.getElementById('foto-descripcion');
  if (desc) desc.value = '';

  // Actualizar pills y dropdown con los sectores del caso
  populatePhotoSectorOptions(selectedPhotoSector);

  // Mostrar la tira de fotos ya almacenadas en este expediente
  renderModalStoredPhotos();

  const instance = M.Modal.getInstance(modalEl);
  if (instance) instance.open();
  M.updateTextFields();
}

const openPhotoCaptureModal = openPhotoUploadModal;

// Al tomar o elegir la fotografía: MOSTRAR DE INMEDIATO ("al tomar la fotografia la debe mostrar")
function handlePhotoFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!PHOTO_ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    M.toast({ html: 'Formato no admitido. Use JPG, PNG o WebP.', classes: 'red darken-3' });
    return;
  }

  if (file.size > PHOTO_MAX_BYTES) {
    M.toast({
      html: `La imagen pesa ${formatFileSize(file.size)} y supera el límite de 10 MB.`,
      classes: 'red darken-3'
    });
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    M.toast({ html: 'No fue posible leer la imagen seleccionada.', classes: 'red darken-3' });
  };
  reader.onload = (loadEvent) => {
    pendingPhotoDraft = {
      file: file,
      nombre_archivo: file.name || `evidencia_${Date.now()}.jpg`,
      mime_type: file.type || 'image/jpeg',
      tamano_bytes: file.size,
      data_url: loadEvent.target.result,
    };

    // 1. Mostrar de inmediato la fotografía capturada
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-preview-placeholder');
    const metaBar = document.getElementById('foto-meta-bar');
    const meta = document.getElementById('foto-meta');

    if (preview) {
      preview.src = pendingPhotoDraft.data_url;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (metaBar) metaBar.style.display = 'flex';
    if (meta) {
      meta.textContent = `${pendingPhotoDraft.nombre_archivo} · ${formatFileSize(pendingPhotoDraft.tamano_bytes)}`;
    }

    // 2. Abrir el modal automáticamente si no está abierto
    const modalEl = document.getElementById('modal-nueva-foto');
    if (modalEl) {
      const inst = M.Modal.getInstance(modalEl);
      if (inst && !inst.isOpen) inst.open();
    }

    // 3. Poblar sectores y enfocar la pregunta del sector
    populatePhotoSectorOptions(selectedPhotoSector);
    renderModalStoredPhotos();

    // Feedback visual
    M.toast({
      html: '<i class="material-icons left tiny">check_circle</i>Fotografía capturada. Confirme el sector a continuación.',
      classes: 'teal darken-2'
    });

    const sectorCard = document.getElementById('foto-sector-card');
    if (sectorCard) {
      sectorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  reader.readAsDataURL(file);
}

// Poblar chips interactivos y opciones de sector ("¿A qué sector pertenece?")
function populatePhotoSectorOptions(presetSector = null) {
  const select = document.getElementById('foto-sector');
  const pillsContainer = document.getElementById('foto-sector-pills');
  if (!select) return;

  const sectors = new Set(SECTOR_CATALOG);
  if (currentCaseData && Array.isArray(currentCaseData.sectors)) {
    currentCaseData.sectors.forEach(s => {
      if (s.nombre) sectors.add(s.nombre.toUpperCase());
    });
  }
  if (currentCaseData && Array.isArray(currentCaseData.lines)) {
    currentCaseData.lines.forEach((line) => {
      if (line.sector) sectors.add(String(line.sector).toUpperCase());
    });
  }

  const sectorList = Array.from(sectors);

  // 1. Renderizar chips interactivos
  if (pillsContainer) {
    pillsContainer.innerHTML = '';
    sectorList.forEach(name => {
      const pill = document.createElement('span');
      pill.className = 'foto-sector-pill' + (presetSector && presetSector.toUpperCase() === name ? ' active' : '');
      pill.setAttribute('data-sector', name);
      pill.innerHTML = `<i class="material-icons tiny">meeting_room</i> ${name}`;
      pill.onclick = () => selectPhotoSector(name);
      pillsContainer.appendChild(pill);
    });
  }

  // 2. Poblar select desplegable
  select.innerHTML = '<option value="" disabled selected>-- Seleccione o confirme el Sector * --</option>';
  sectorList.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  const targetSector = presetSector || selectedPhotoSector;
  if (targetSector && sectors.has(targetSector.toUpperCase())) {
    select.value = targetSector.toUpperCase();
    selectedPhotoSector = targetSector.toUpperCase();
  }

  select.onchange = (e) => {
    selectPhotoSector(e.target.value);
  };

  const existing = M.FormSelect.getInstance(select);
  if (existing) existing.destroy();
  M.FormSelect.init(select);

  updateSavePhotoButtonLabel();
}

// Seleccionar sector al tocar un chip o cambiar el dropdown
function selectPhotoSector(sectorName) {
  selectedPhotoSector = (sectorName || '').toUpperCase();
  const select = document.getElementById('foto-sector');
  if (select && select.value !== selectedPhotoSector) {
    select.value = selectedPhotoSector;
    const existing = M.FormSelect.getInstance(select);
    if (existing) existing.destroy();
    M.FormSelect.init(select);
  }

  document.querySelectorAll('.foto-sector-pill').forEach(p => {
    if (p.getAttribute('data-sector') === selectedPhotoSector) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  updateSavePhotoButtonLabel();
}

function updateSavePhotoButtonLabel() {
  const saveBtn = document.getElementById('btn-save-photo');
  if (!saveBtn) return;
  if (selectedPhotoSector) {
    saveBtn.innerHTML = `<i class="material-icons tiny left">cloud_upload</i> Guardar en Sector: <b>${selectedPhotoSector}</b>`;
    saveBtn.classList.remove('grey', 'lighten-1');
    saveBtn.classList.add('primary', 'darken-1');
  } else {
    saveBtn.innerHTML = '<i class="material-icons tiny left">cloud_upload</i> Guardar Evidencia Fotográfica';
  }
}

// Crear rápidamente un nuevo sector desde el modal de foto
function promptQuickNewSectorFromPhoto() {
  const name = prompt('Ingrese el nombre del nuevo sector o ambiente (Ej: "TERRAZA", "BODEGA", "QUINCHO"):');
  if (!name || !name.trim()) return;
  const cleanName = name.trim().toUpperCase();

  if (currentCaseId) {
    ApiService.createSector(currentCaseId, { nombre: cleanName })
      .then(newSector => {
        if (!currentCaseData) currentCaseData = {};
        if (!Array.isArray(currentCaseData.sectors)) currentCaseData.sectors = [];
        currentCaseData.sectors.push(newSector);
        populatePhotoSectorOptions(cleanName);
        selectPhotoSector(cleanName);
        M.toast({ html: `Sector <b>"${cleanName}"</b> agregado y seleccionado.`, classes: 'green darken-2' });
      })
      .catch(err => {
        populatePhotoSectorOptions(cleanName);
        selectPhotoSector(cleanName);
      });
  } else {
    populatePhotoSectorOptions(cleanName);
    selectPhotoSector(cleanName);
  }
}

// Renderizar la tira de miniaturas de fotos ya almacenadas dentro del modal
function renderModalStoredPhotos() {
  const container = document.getElementById('modal-stored-photos-list');
  const countLabel = document.getElementById('modal-stored-photos-count');
  if (!container) return;

  const photos = (currentCaseData && currentCaseData.photos) || [];
  if (countLabel) countLabel.textContent = photos.length;

  container.innerHTML = '';
  if (photos.length === 0) {
    container.innerHTML = '<span class="grey-text" style="font-size: 0.75rem; padding: 12px 4px;">Aún no hay evidencias almacenadas en este siniestro.</span>';
    return;
  }

  photos.forEach((p, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'modal-stored-photo-thumb';
    const photoUrl = photoSource(p) || PHOTO_PLACEHOLDER;
    const sectorName = p.sector || 'GENERAL';
    thumb.title = `${sectorName} - ${p.descripcion || 'Evidencia'} (Clic para ampliar)`;
    thumb.innerHTML = `
      <img src="${photoUrl}" alt="Evidencia ${idx + 1}" onerror="this.onerror=null;this.src='${PHOTO_PLACEHOLDER}'">
      <span class="thumb-tag">${sectorName}</span>
    `;
    thumb.onclick = () => {
      openPhotoLightbox(photoUrl, sectorName, p.descripcion || '');
    };
    container.appendChild(thumb);
  });
}

// Guardar evidencia fotográfica física en PostgreSQL y disco
async function handleConfirmPhotoCapture(event) {
  event.preventDefault();

  if (!pendingPhotoDraft || !pendingPhotoDraft.file) {
    LorensAlert.warning('Fotografía requerida', 'Debe tomar una fotografía con la cámara o seleccionar una imagen antes de guardar.');
    return;
  }

  const sectorSelect = document.getElementById('foto-sector');
  const sector = (selectedPhotoSector || (sectorSelect ? sectorSelect.value : '') || '').trim().toUpperCase();

  if (!sector) {
    LorensAlert.warning('Sector obligatorio', 'Debe indicar a qué sector pertenece esta evidencia antes de almacenar.');
    const sectorCard = document.getElementById('foto-sector-card');
    if (sectorCard) {
      sectorCard.style.border = '2px solid #dc2626';
      sectorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { sectorCard.style.border = '1.5px solid #fde68a'; }, 3000);
    }
    return;
  }

  if (!currentCaseId) {
    LorensAlert.error('Sin expediente', 'No hay un expediente activo seleccionado.');
    return;
  }

  const descripcion =
    ((document.getElementById('foto-descripcion') || {}).value || '').trim() ||
    `Evidencia pericial de terreno en sector ${sector}.`;

  const formData = new FormData();
  formData.append('foto', pendingPhotoDraft.file);
  formData.append('sector', sector);
  formData.append('descripcion', descripcion);

  if (currentCaseData && Array.isArray(currentCaseData.sectors)) {
    const matchedSector = currentCaseData.sectors.find(s => s.nombre.toUpperCase() === sector);
    if (matchedSector && matchedSector.id) {
      formData.append('sector_id', matchedSector.id);
    }
  }

  // 1. Mostrar SweetAlert2 con barra de progreso real (0-100%)
  LorensAlert.showUploadProgress('Guardando evidencia fotográfica');

  try {
    // 2. Subir con progreso medible mediante XMLHttpRequest
    const savedPhoto = await ApiService.uploadPhotoWithProgress(currentCaseId, formData, (progress) => {
      if (progress.stage === 'uploading') {
        const msg = progress.percent < 100 
          ? `Transfiriendo archivo al servidor: ${progress.percent}%`
          : 'Procesando y almacenando archivo físico en el servidor...';
        LorensAlert.updateUploadProgress(progress.percent, progress.loaded, progress.total, msg);
      }
    });

    // 3. Etapa: Persistencia y verificación en PostgreSQL
    LorensAlert.updateUploadProgress(100, pendingPhotoDraft.file.size, pendingPhotoDraft.file.size, 'Registrando metadatos y trazabilidad en PostgreSQL...');

    // 4. Etapa: Verificación de imagen (fetch Blob y URL object)
    LorensAlert.updateUploadProgress(100, pendingPhotoDraft.file.size, pendingPhotoDraft.file.size, 'Cargando y verificando disponibilidad de imagen...');
    try {
      await getAuthorizedPhotoUrl(savedPhoto);
    } catch (blobErr) {
      console.warn('Verificación blob preventiva falló:', blobErr.message);
    }

    if (!currentCaseData) currentCaseData = { photos: [] };
    if (!Array.isArray(currentCaseData.photos)) currentCaseData.photos = [];
    currentCaseData.photos.unshift(savedPhoto);

    // Actualizar todas las vistas
    renderPhotos(currentCaseData.photos);
    renderInspectionPhotos(currentCaseData);
    updateInspectionSummaryCards(currentCaseData);
    renderInspectionSectors(currentCaseData);
    renderAdminViews();
    updateDraftBadge();

    const modal = M.Modal.getInstance(document.getElementById('modal-nueva-foto'));
    if (modal) modal.close();

    pendingPhotoDraft = null;
    selectedPhotoSector = '';

    // 5. Notificación de éxito con SweetAlert2
    await LorensAlert.success(
      'Fotografía guardada',
      `La evidencia pericial fue guardada físicamente en el servidor y registrada en el sector "${sector}".`
    );

    const fotosTab = document.getElementById('subtab-fotos');
    if (fotosTab && fotosTab.style.display !== 'none') {
      const grid = document.getElementById('inspection-photos-gallery-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (error) {
    console.error('[FOTOS] Error al subir foto:', error);
    LorensAlert.error('Error al cargar la imagen', error.message || 'No fue posible almacenar la fotografía en el servidor.');
  }
}

async function removePhoto(photoId) {
  const confirmResult = await LorensAlert.confirm(
    '¿Eliminar evidencia fotográfica?',
    'Esta acción eliminará físicamente el archivo del servidor y su registro en la base de datos.',
    'Sí, eliminar evidencia'
  );
  if (!confirmResult.isConfirmed) return;

  try {
    await ApiService.deletePhoto(currentCaseId, photoId);
    if (currentCaseData && Array.isArray(currentCaseData.photos)) {
      currentCaseData.photos = currentCaseData.photos.filter((p) => String(p.id) !== String(photoId));
    }
    // Liberar URL blob de la memoria si existiera
    if (photoBlobCache.has(String(photoId))) {
      URL.revokeObjectURL(photoBlobCache.get(String(photoId)));
      photoBlobCache.delete(String(photoId));
    }

    renderPhotos(currentCaseData ? currentCaseData.photos : []);
    renderInspectionPhotos(currentCaseData || {});
    updateInspectionSummaryCards(currentCaseData || {});
    renderAdminViews();
    updateDraftBadge();
    LorensAlert.success('Evidencia eliminada', 'La fotografía y su archivo físico fueron eliminados.');
  } catch (err) {
    console.error('[removePhoto] Error:', err);
    LorensAlert.error('Error al eliminar evidencia', err.message);
  }
}
// ==============================================================
// VISTAS DEL MÓDULO ADMINISTRADOR (GESTIÓN GLOBAL)
// ==============================================================
const CATALOGO_ESTADOS_DEFAULT = [
  { id: 'activo', nombre: 'Activo', descripcion: 'Expediente en curso de inspección o liquidación activa', color: '#10b981', badge_clase: 'green lighten-5 green-text text-darken-3', orden: 1 },
  { id: 'en_espera', nombre: 'En espera', descripcion: 'Expediente pausado, en espera de documentación o peritaje adicional', color: '#f59e0b', badge_clase: 'amber lighten-5 amber-text text-darken-4', orden: 2 },
  { id: 'procesado', nombre: 'Procesado', descripcion: 'Expediente liquidado, revisado y procesado oficialmente', color: '#3b82f6', badge_clase: 'blue lighten-5 blue-text text-darken-3', orden: 3 }
];

let cachedCasesList = null;

async function renderAdminExpedientesTable() {
  const tableBody = document.getElementById('admin-expedientes-table-body');
  const catalogBody = document.getElementById('admin-estados-catalogo-body');
  const badgeTotal = document.getElementById('admin-badge-total-cases');
  const kpiActivos = document.getElementById('admin-kpi-casos-activos');
  const kpiEspera = document.getElementById('admin-kpi-casos-espera');
  const kpiProcesados = document.getElementById('admin-kpi-casos-procesados');

  if (!tableBody) return;

  let cases = [];
  try {
    cases = await ApiService.getAllCases();
  } catch (err) {
    console.warn('[Admin] Fallback a lista de casos local:', err.message);
  }

  if (!cases || !Array.isArray(cases) || cases.length === 0) {
    cases = [
      {
        id: 'd0000000-0000-0000-0000-000000000001',
        codigo: 'SIS-2026-084',
        cliente_nombre: 'Juan Pérez',
        cliente_rut: '12.345.678-9',
        comuna: 'Alto Hospicio',
        direccion: 'Av. Arturo Prat, 2043, Alto Hospicio',
        liquidador_nombre: 'SEGURED / COOPER',
        inspector_nombre: 'PEDRO PÉREZ',
        fecha_visita: '2026-06-02',
        estado: 'activo'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000002',
        codigo: 'SIS-2026-085',
        cliente_nombre: 'María González',
        cliente_rut: '14.892.123-K',
        comuna: 'Iquique',
        direccion: 'Calle Los Álamos 450, Iquique',
        liquidador_nombre: 'SEGURED / COOPER',
        inspector_nombre: 'PEDRO PÉREZ',
        fecha_visita: '2026-06-03',
        estado: 'en_espera'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000003',
        codigo: 'SIS-2026-086',
        cliente_nombre: 'Roberto Silva',
        cliente_rut: '9.765.432-1',
        comuna: 'Pozo Almonte',
        direccion: 'Pasaje Central 128, Pozo Almonte',
        liquidador_nombre: 'JUAN PABLO VALDIVIESO',
        inspector_nombre: 'PEDRO PÉREZ',
        fecha_visita: '2026-05-22',
        estado: 'procesado'
      }
    ];
  }

  cachedCasesList = cases;
  refreshCaseSelector(cases, currentCaseId);

  // Conteo de estados
  const counts = { activo: 0, en_espera: 0, procesado: 0 };
  cases.forEach(c => {
    const st = (c.estado || 'activo').toLowerCase();
    if (counts[st] !== undefined) counts[st]++;
    else counts.activo++;
  });

  if (badgeTotal) badgeTotal.textContent = `${cases.length} Expedientes Registrados`;
  if (kpiActivos) kpiActivos.textContent = counts.activo;
  if (kpiEspera) kpiEspera.textContent = counts.en_espera;
  if (kpiProcesados) kpiProcesados.textContent = counts.procesado;

  // Renderizar filas de la tabla de expedientes
  tableBody.innerHTML = '';
  cases.forEach((item) => {
    const st = (item.estado || 'activo').toLowerCase();
    let badgeClass = 'green lighten-5 green-text text-darken-3';
    let badgeLabel = 'Activo';
    let badgeIcon = 'play_circle';

    if (st === 'en_espera') {
      badgeClass = 'amber lighten-5 amber-text text-darken-4';
      badgeLabel = 'En espera';
      badgeIcon = 'pause_circle';
    } else if (st === 'procesado') {
      badgeClass = 'blue lighten-5 blue-text text-darken-3';
      badgeLabel = 'Procesado';
      badgeIcon = 'check_circle';
    }

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    if (item.id === currentCaseId) {
      tr.style.backgroundColor = '#f8fafc';
    }

    tr.innerHTML = `
      <td>
        <strong style="color: var(--navy-900); font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">${item.codigo || 'S/C'}</strong>
        ${item.id === currentCaseId ? '<span style="font-size: 0.68rem; font-weight: 700; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">ACTIVO EN ACTA</span>' : ''}
      </td>
      <td>
        <div style="font-weight: 700; color: var(--navy-950);">${item.cliente_nombre || 'Sin titular'}</div>
        <small class="grey-text">${item.cliente_rut || 'Sin RUT'}</small>
      </td>
      <td>
        <div>${item.comuna || item.ciudad || 'Tarapacá'}</div>
        <small class="grey-text">${item.direccion ? item.direccion.substring(0, 24) + '...' : ''}</small>
      </td>
      <td>
        <span style="font-size: 0.8rem; font-weight: 600; color: #0369a1;">${item.liquidador_nombre || 'SEGURED / COOPER'}</span>
      </td>
      <td>
        <div style="font-size: 0.82rem;">${item.inspector_nombre || 'PEDRO PÉREZ'}</div>
      </td>
      <td>
        <span style="font-size: 0.8rem; color: var(--slate-600);">${item.fecha_visita || 'Reciente'}</span>
      </td>
      <td class="center-align">
        <span class="badge ${badgeClass}" style="border-radius: 20px; font-weight: 700; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;">
          <i class="material-icons tiny">${badgeIcon}</i>${badgeLabel}
        </span>
      </td>
      <td class="center-align">
        <select class="browser-default" 
                onchange="window.changeExpedienteEstado('${item.id}', this.value)"
                aria-label="Modificar estado de expediente ${item.codigo}"
                style="height: 32px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; padding: 0 8px; background: white; cursor: pointer;">
          <option value="activo" ${st === 'activo' ? 'selected' : ''}>🟢 Activo</option>
          <option value="en_espera" ${st === 'en_espera' ? 'selected' : ''}>🟡 En espera</option>
          <option value="procesado" ${st === 'procesado' ? 'selected' : ''}>🔵 Procesado</option>
        </select>
      </td>
      <td class="center-align">
        <button type="button" class="btn-flat btn-small waves-effect" 
                onclick="window.selectCaseFromAdmin('${item.id}')"
                title="Abrir este expediente en Acta Oficial"
                style="font-size: 0.78rem; font-weight: 700; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 6px; padding: 0 10px; background: #ffffff;">
          <i class="material-icons left tiny" style="margin-right: 4px;">open_in_browser</i>Cargar
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Renderizar la tabla de catálogo oficial de estados
  if (catalogBody) {
    catalogBody.innerHTML = '';
    CATALOGO_ESTADOS_DEFAULT.forEach(est => {
      const row = document.createElement('tr');
      const countVal = counts[est.id] || 0;
      row.innerHTML = `
        <td style="padding: 8px 12px;"><code style="font-weight: 700; color: #4c1d95;">${est.id}</code></td>
        <td style="padding: 8px 12px;"><strong>${est.nombre}</strong></td>
        <td style="padding: 8px 12px; color: var(--slate-600); text-align: left;">${est.descripcion}</td>
        <td style="padding: 8px 12px;" class="center-align">
          <span class="badge ${est.badge_clase}" style="border-radius: 12px; font-weight: 700; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${est.color};"></span>
            ${est.nombre}
          </span>
        </td>
        <td style="padding: 8px 12px;" class="center-align">
          <strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; color: var(--navy-900);">${countVal}</strong>
        </td>
      `;
      catalogBody.appendChild(row);
    });
  }
}

window.changeExpedienteEstado = async function(caseId, newStatus) {
  try {
    const res = await ApiService.updateCaseStatus(caseId, newStatus);
    const friendlyName = newStatus === 'activo' ? 'Activo' : (newStatus === 'en_espera' ? 'En espera' : 'Procesado');
    M.toast({ html: `Estado de expediente actualizado a: <b>${friendlyName}</b>`, classes: 'green darken-2' });

    // Si el caso modificado es el activo en pantalla, actualizar su estado en memoria
    if (currentCaseData && (currentCaseData.expediente.id === caseId || currentCaseData.expediente.codigo === caseId)) {
      currentCaseData.expediente.estado = newStatus;
      currentCaseData.expediente.estado_nombre = friendlyName;
    }

    // Refrescar tabla y KPIs
    await renderAdminExpedientesTable();
  } catch (err) {
    console.warn('Error al actualizar estado en backend, aplicando localmente:', err.message);
    if (cachedCasesList) {
      const c = cachedCasesList.find(x => x.id === caseId || x.codigo === caseId);
      if (c) c.estado = newStatus;
    }
    const friendlyName = newStatus === 'activo' ? 'Activo' : (newStatus === 'en_espera' ? 'En espera' : 'Procesado');
    M.toast({ html: `Estado actualizado localmente a: <b>${friendlyName}</b>`, classes: 'blue-grey darken-3' });
    await renderAdminExpedientesTable();
  }
};

window.selectCaseFromAdmin = function(caseId) {
  currentCaseId = caseId;
  const caseSelector = document.getElementById('case-selector');
  if (caseSelector) {
    caseSelector.value = caseId;
  }
  switchTab('tab-dashboard');
  loadCase(caseId);
  M.toast({ html: `Expediente seleccionado cargado en Dashboard Gerencial.`, classes: 'purple darken-3' });
};

function refreshCaseSelector(casesList, activeId) {
  const caseSelector = document.getElementById('case-selector');
  if (!caseSelector || !Array.isArray(casesList)) return;

  const currentVal = activeId || caseSelector.value;
  caseSelector.innerHTML = '';
  casesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    const stTag = (c.estado || 'activo').toUpperCase();
    opt.textContent = `${c.codigo || 'S/C'} · ${c.cliente_nombre || 'Expediente'} [${stTag}]`;
    if (c.id === currentVal) opt.selected = true;
    caseSelector.appendChild(opt);
  });
}

function renderAdminViews() {
  if (!currentCaseData) return;

  // 0. Gestión de Expedientes y Control de Estados
  renderAdminExpedientesTable();

  // 1. Tabla de Auditoría de Levantamiento Geométrico (Admin)
  const adminTableBody = document.getElementById('admin-partidas-table-body');
  if (adminTableBody) {
    adminTableBody.innerHTML = '';
    const lines = currentCaseData.lines || [];

    lines.forEach((l, idx) => {
      const finalQty = l.finalQty !== undefined ? l.finalQty : (l.cantidad_medida || 0);
      // Precio vacío = PENDIENTE: nunca se asume 0 ni una tarifa por defecto.
      const pu = toPrecioUnitario(l.precio_unitario_neto);
      const subtotal = pu !== null ? Math.round(finalQty * pu) : 0;
      const isApproved = l.admin_aprobada !== false;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${l.sector}</strong></td>
        <td>${l.elemento}</td>
        <td>${l.reparacion_propuesta}</td>
        <td><code>${l.metodo_calculo}</code></td>
        <td class="amount-col">${BudgetViewer.formatQty(finalQty)} ${l.unidad_id}</td>
        <td class="amount-col">
          <input type="number" min="0" step="1" inputmode="numeric" value="${pu !== null ? pu : ''}"
                 placeholder="Pendiente"
                 aria-label="Precio unitario de ${l.reparacion_propuesta}"
                 onchange="adminUpdateLinePU('${l.id}', this.value)"
                 style="width: 92px; height: 32px; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; text-align: right; margin: 0;">
        </td>
        <td class="amount-col" style="font-weight: 700;">
          ${pu !== null ? BudgetViewer.formatCLP(subtotal) : '<span class="amber-text text-darken-3">Pendiente</span>'}
        </td>
        <td>
          <span class="admin-status-badge ${isApproved ? 'status-approved' : 'status-observed'}">
            ${isApproved ? 'APROBADA' : 'OBSERVADA'}
          </span>
        </td>
        <td class="center-align">
          <button class="btn-flat btn-small green-text" onclick="adminToggleApproval('${l.id}')" title="Alternar Aprobación">
            <i class="material-icons">${isApproved ? 'check_circle' : 'radio_button_unchecked'}</i>
          </button>
        </td>
      `;
      adminTableBody.appendChild(tr);
    });
  }

  // 2. Auditoría Fotográfica (Admin)
  const adminPhotosList = document.getElementById('admin-photos-audit');
  if (adminPhotosList) {
    adminPhotosList.innerHTML = '';
    const photos = currentCaseData.photos && currentCaseData.photos.length > 0 ? currentCaseData.photos : [
      { id: 'p1', sector: 'BAÑO 1', descripcion: 'Fisuras diagonales en revestimiento de muro húmedo.', ruta_almacenamiento: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80', aprobada: true },
      { id: 'p2', sector: 'BAÑO 1', descripcion: 'Detalle de fisuración por cizalle en junta constructiva.', ruta_almacenamiento: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=300&q=80', aprobada: true }
    ];

    photos.forEach(p => {
      const col = document.createElement('div');
      col.className = 'col s12 m4';
      col.innerHTML = `
        <div class="card" style="box-shadow: var(--card-shadow); border-radius: 8px; overflow: hidden;">
          <div class="card-image" style="height: 140px; overflow: hidden; background: #eee;">
            <img src="${photoSource(p) || PHOTO_PLACEHOLDER}" alt="Evidencia del sector ${p.sector || 'general'}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='${PHOTO_PLACEHOLDER}'">
            <span class="card-title" style="padding: 6px 10px; font-size: 0.78rem; background: rgba(0,0,0,0.7);">${p.sector}</span>
          </div>
          <div class="card-content" style="padding: 10px 14px; font-size: 0.8rem;">
            <p>${p.descripcion}</p>
            <div style="margin-top: 8px;">
              <span class="admin-status-badge ${p.aprobada !== false ? 'status-approved' : 'status-observed'}">
                ${p.aprobada !== false ? 'Evidencia Válida' : 'Observada'}
              </span>
            </div>
          </div>
        </div>
      `;
      adminPhotosList.appendChild(col);
    });
  }
}

// Normaliza un precio unitario: vacío, negativo o inválido equivale a PENDIENTE (null).
function toPrecioUnitario(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// Administrador: Actualizar PU directamente desde la tabla de auditoría
function adminUpdateLinePU(lineId, rawValue) {
  if (!isAdminRole()) {
    M.toast({ html: 'Solo un administrador puede modificar tarifas unitarias.', classes: 'red darken-3' });
    renderAdminViews();
    return;
  }

  const line = (currentCaseData.lines || []).find(l => l.id === lineId);
  if (!line) return;

  const newPU = toPrecioUnitario(rawValue);
  const finalQty = line.finalQty !== undefined ? line.finalQty : (line.cantidad_medida || 0);

  line.precio_unitario_neto = newPU;
  // Sin precio no existe valorización: la partida queda pendiente, no en cero.
  line.subtotal_neto = newPU !== null ? Math.round(finalQty * newPU) : 0;

  recalculateLocalSummary();
  BudgetViewer.renderSummary(currentCaseData.summary);
  BudgetViewer.renderTable(currentCaseData.lines, currentCaseData.expenses);
  renderLevantamientoTable(currentCaseData.lines);
  renderAdminViews();
  updateDraftBadge();

  M.toast({
    html: newPU !== null
      ? `Tarifa actualizada para ${line.reparacion_propuesta}.`
      : `Precio vaciado: ${line.reparacion_propuesta} queda como PENDIENTE.`,
    classes: newPU !== null ? 'amber darken-3' : 'blue-grey darken-3'
  });
}

// Administrador: Alternar aprobación de partida
function adminToggleApproval(lineId) {
  const line = (currentCaseData.lines || []).find(l => l.id === lineId);
  if (line) {
    line.admin_aprobada = !line.admin_aprobada;
    renderAdminViews();
    M.toast({ html: `Estado de partida actualizado: ${line.admin_aprobada ? 'Aprobada' : 'Observada'}.`, classes: 'blue-grey darken-3' });
  }
}

// Motor en vivo de fórmulas geométricas y visualización contextual
function setupGeometricCalculator() {
  const metodo = document.getElementById('partida-metodo');
  const largo = document.getElementById('partida-largo');
  const ancho = document.getElementById('partida-ancho');
  const alto = document.getElementById('partida-alto');
  const directa = document.getElementById('partida-directa');
  const descuento = document.getElementById('partida-descuento');
  const afectado = document.getElementById('partida-afectado');
  const reparacion = document.getElementById('partida-reparacion');
  const pu = document.getElementById('partida-pu');

  const inputs = [metodo, largo, ancho, alto, directa, descuento, afectado, reparacion, pu];
  inputs.forEach(el => {
    if (el) {
      el.addEventListener('input', updateFormulaLive);
      el.addEventListener('change', updateFormulaLive);
    }
  });

  if (metodo) {
    metodo.addEventListener('change', adaptInputsForMethod);
  }

  function adaptInputsForMethod() {
    const m = metodo.value;
    const colLargo = document.getElementById('col-partida-largo');
    const colAncho = document.getElementById('col-partida-ancho');
    const colAlto = document.getElementById('col-partida-alto');
    const colDirecta = document.getElementById('col-partida-directa');

    [colLargo, colAncho, colAlto, colDirecta].forEach(c => {
      if (c) c.classList.remove('field-highlighted', 'field-dimmed');
    });

    if (m === 'LH') {
      if (colLargo) colLargo.classList.add('field-highlighted');
      if (colAlto) colAlto.classList.add('field-highlighted');
      if (colAncho) colAncho.classList.add('field-dimmed');
      if (colDirecta) colDirecta.classList.add('field-dimmed');
    } else if (m === 'LW') {
      if (colLargo) colLargo.classList.add('field-highlighted');
      if (colAncho) colAncho.classList.add('field-highlighted');
      if (colAlto) colAlto.classList.add('field-dimmed');
      if (colDirecta) colDirecta.classList.add('field-dimmed');
    } else if (m === 'perimeter') {
      if (colLargo) colLargo.classList.add('field-highlighted');
      if (colAncho) colAncho.classList.add('field-highlighted');
      if (colAlto) colAlto.classList.add('field-highlighted');
      if (colDirecta) colDirecta.classList.add('field-dimmed');
    } else if (m === 'L') {
      if (colLargo) colLargo.classList.add('field-highlighted');
      if (colAncho) colAncho.classList.add('field-dimmed');
      if (colAlto) colAlto.classList.add('field-dimmed');
      if (colDirecta) colDirecta.classList.add('field-dimmed');
    } else if (m === 'direct') {
      if (colDirecta) colDirecta.classList.add('field-highlighted');
      if (colLargo) colLargo.classList.add('field-dimmed');
      if (colAncho) colAncho.classList.add('field-dimmed');
      if (colAlto) colAlto.classList.add('field-dimmed');
    }
  }

  function updateFormulaLive() {
    const m = metodo.value;
    const l = parseFloat(largo.value) || 0;
    const w = parseFloat(ancho.value) || 0;
    const h = parseFloat(alto.value) || 0;
    const dir = parseFloat(directa.value) || 0;
    const desc = parseFloat(descuento.value) || 0;
    const af = parseFloat(afectado.value) !== undefined && !isNaN(parseFloat(afectado.value)) ? parseFloat(afectado.value) : 100;
    const rep = reparacion.value !== '' ? parseFloat(reparacion.value) : null;
    const unitPrice = pu.value !== '' ? parseFloat(pu.value) : null;

    let gross = 0;
    let formulaStr = '';
    switch (m) {
      case 'LH':
        gross = l * h;
        formulaStr = `${l}m × ${h}m = ${gross.toFixed(2)} m² (Muro)`;
        break;
      case 'LW':
        gross = l * w;
        formulaStr = `${l}m × ${w}m = ${gross.toFixed(2)} m² (Piso/Cielo)`;
        break;
      case 'perimeter':
        gross = 2 * (l + w) * h;
        formulaStr = `2 × (${l} + ${w}) × ${h} = ${gross.toFixed(2)} m² (Perímetro × H)`;
        break;
      case 'LWH':
        gross = l * w * h;
        formulaStr = `${l}m × ${w}m × ${h}m = ${gross.toFixed(2)} m³ (Volumen)`;
        break;
      case 'L':
        gross = l;
        formulaStr = `Longitud = ${l.toFixed(2)} ml`;
        break;
      case 'direct':
      default:
        gross = dir;
        formulaStr = `Cantidad directa = ${dir.toFixed(2)}`;
    }

    const measured = Math.max(0, (gross - desc) * (af / 100));
    const finalQty = rep !== null ? rep : measured;
    const subtotal = unitPrice !== null ? Math.round(finalQty * unitPrice) : 0;

    const previewEl = document.getElementById('formula-live-preview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--slate-600); text-transform: uppercase; font-weight: 700;">
          Fórmula: <strong>${m}</strong>
        </div>
        <div class="formula-math-display">
          ${formulaStr} | Deducción vanos: -${desc.toFixed(2)} | Afectación: ${af}%
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <div style="color: var(--navy-900); font-size: 1rem;">
            <strong>Medida Neta:</strong> <span style="font-family: 'JetBrains Mono', monospace; color: var(--primary-dark); font-weight: 800;">${measured.toFixed(2)}</span>
            ${rep !== null ? `<span class="amber-text text-darken-3">(Justif: ${rep.toFixed(2)})</span>` : ''}
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: var(--amber-600);">
            ${unitPrice !== null ? BudgetViewer.formatCLP(subtotal) : 'Precio Pendiente'}
          </div>
        </div>
      `;
    }
  }
}

// Abrir modal en modo edición
function editPartida(lineId) {
  const line = (currentCaseData.lines || []).find(l => l.id === lineId);
  if (!line) return;

  editingLineId = lineId;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== null && val !== undefined ? val : '';
  };

  setVal('partida-sector', line.sector);
  setVal('partida-elemento', line.elemento);
  setVal('partida-dano', line.dano_tipo);
  setVal('partida-desc', line.descripcion_dano);
  setVal('partida-reparacion-propuesta', line.reparacion_propuesta);
  setVal('partida-metodo', line.metodo_calculo || 'direct');
  setVal('partida-unidad', line.unidad_id || 'm²');
  setVal('partida-largo', line.largo);
  setVal('partida-ancho', line.ancho);
  setVal('partida-alto', line.alto);
  setVal('partida-directa', line.cantidad_directa);
  setVal('partida-descuento', line.descuento);
  setVal('partida-afectado', line.porcentaje_afectado);
  setVal('partida-reparacion', line.cantidad_reparacion);
  setVal('partida-pu', line.precio_unitario_neto);
  setVal('partida-justificacion', line.justificacion_reparacion);

  document.getElementById('modal-partida-title').innerHTML = `<i class="material-icons left">edit</i>Modificar Partida de Daño`;
  M.updateTextFields();
  M.FormSelect.init(document.querySelectorAll('#modal-nuevo-dano select'));

  const modal = M.Modal.getInstance(document.getElementById('modal-nuevo-dano'));
  if (modal) modal.open();
}

// Reset modal de partida para nueva creación
function resetPartidaModal() {
  editingLineId = null;

  const form = document.getElementById('form-nueva-partida');
  if (form) form.reset();

  const title = document.getElementById('modal-partida-title');
  if (title) title.innerHTML = `<i class="material-icons left">straighten</i>Levantamiento de Partida y Medición Geométrica`;

  // Recomponer los selects Materialize evita etiquetas duplicadas tras varios usos.
  const selects = document.querySelectorAll('#modal-nuevo-dano select');
  selects.forEach((select) => {
    const instance = M.FormSelect.getInstance(select);
    if (instance) instance.destroy();
  });
  M.FormSelect.init(selects);
  M.updateTextFields();
}

// Apertura táctil del levantamiento (botones de la barra inferior y de la sección).
function openNewPartidaModal() {
  const modalEl = document.getElementById('modal-nuevo-dano');
  if (!modalEl) return;

  resetPartidaModal();
  const instance = M.Modal.getInstance(modalEl) || M.Modal.init(modalEl, { dismissible: true });
  if (instance) instance.open();
}

// Medida bruta según la fórmula geométrica seleccionada.
function grossMeasurement(draft) {
  const largo = Number(draft.largo) || 0;
  const ancho = Number(draft.ancho) || 0;
  const alto = Number(draft.alto) || 0;

  switch (draft.metodo_calculo) {
    case 'LH': return largo * alto;
    case 'LW': return largo * ancho;
    case 'LWH': return largo * ancho * alto;
    case 'perimeter': return 2 * (largo + ancho) * alto;
    case 'L': return largo;
    case 'direct':
    default: return Number(draft.cantidad_directa) || 0;
  }
}

/**
 * Reglas de negocio previas al envío (espejo de las validaciones del servidor):
 * el descuento no puede superar la medida bruta, la afectación se mantiene
 * entre 1 y 100 y la cantidad de reparación exige justificación escrita.
 */
function validatePartidaDraft(draft) {
  const errors = [];

  const requiredMissing = ['sector', 'elemento', 'dano_tipo', 'reparacion_propuesta', 'unidad_id']
    .some((field) => !String(draft[field] || '').trim());
  if (requiredMissing) {
    errors.push('Complete sector, elemento, daño, reparación y unidad de medida.');
  }

  const gross = grossMeasurement(draft);
  const descuento = Number(draft.descuento) || 0;

  if (gross <= 0) {
    errors.push('La medida bruta debe ser mayor que cero: revise las dimensiones capturadas.');
  }
  if (descuento > gross) {
    errors.push(`El descuento (${descuento.toFixed(2)}) no puede superar la medida bruta (${gross.toFixed(2)}).`);
  }
  if (!(draft.porcentaje_afectado > 0 && draft.porcentaje_afectado <= 100)) {
    errors.push('El porcentaje afectado debe estar entre 1 y 100.');
  }
  if (draft.cantidad_reparacion !== null && !(draft.cantidad_reparacion > 0)) {
    errors.push('La cantidad de reparación debe ser mayor que cero.');
  }
  if (draft.cantidad_reparacion !== null && !String(draft.justificacion_reparacion || '').trim()) {
    errors.push('Justifique la cantidad de reparación cuando difiere de la medida calculada.');
  }
  if (draft.precio_unitario_neto !== null && draft.precio_unitario_neto < 0) {
    errors.push('El precio unitario no puede ser negativo; déjelo vacío si sigue pendiente.');
  }

  return errors;
}

// Agregar o actualizar partida
async function handleAddOrUpdatePartida(e) {
  e.preventDefault();
  const getVal = id => document.getElementById(id) ? document.getElementById(id).value : '';

  const partidaData = {
    sector: getVal('partida-sector'),
    elemento: getVal('partida-elemento'),
    dano_tipo: getVal('partida-dano'),
    descripcion_dano: getVal('partida-desc'),
    reparacion_propuesta: getVal('partida-reparacion-propuesta'),
    unidad_id: getVal('partida-unidad'),
    metodo_calculo: getVal('partida-metodo'),
    largo: parseFloat(getVal('partida-largo')) || 0,
    ancho: parseFloat(getVal('partida-ancho')) || 0,
    alto: parseFloat(getVal('partida-alto')) || 0,
    cantidad_directa: parseFloat(getVal('partida-directa')) || 0,
    descuento: parseFloat(getVal('partida-descuento')) || 0,
    porcentaje_afectado: getVal('partida-afectado') === '' ? 100 : parseFloat(getVal('partida-afectado')),
    cantidad_reparacion: getVal('partida-reparacion') !== '' ? parseFloat(getVal('partida-reparacion')) : null,
    justificacion_reparacion: getVal('partida-justificacion'),
    precio_unitario_neto: toPrecioUnitario(getVal('partida-pu')),
    modo_precio: getVal('partida-modo-precio') || 'complete'
  };

  const draftErrors = validatePartidaDraft(partidaData);
  if (draftErrors.length > 0) {
    M.toast({ html: draftErrors[0], classes: 'red darken-3', displayLength: 6000 });
    return;
  }

  try {
    if (editingLineId) {
      await ApiService.deleteLine(editingLineId);
    }
    await ApiService.addLine(currentCaseId, partidaData);
    LorensAlert.success('Partida guardada', 'La partida fue registrada exitosamente en PostgreSQL.');
    const modal = M.Modal.getInstance(document.getElementById('modal-nuevo-dano'));
    if (modal) modal.close();
    resetPartidaModal();
    if (currentCaseId) {
      await openInspectorCase(currentCaseId, 'subtab-danos');
    }
  } catch (err) {
    console.error('[handleAddOrUpdatePartida] Error:', err);
    LorensAlert.error('Error al guardar partida', 'No fue posible registrar la partida: ' + err.message);
  }
}

// Eliminar partida
async function deletePartida(lineId) {
  if (!confirm('¿Confirma la eliminación definitiva de esta partida de daño?')) return;
  try {
    await ApiService.deleteLine(lineId);
    M.toast({ html: 'Partida eliminada.', classes: 'blue-grey darken-3' });
    loadCase(currentCaseId);
  } catch (err) {
    if (currentCaseData && currentCaseData.lines) {
      currentCaseData.lines = currentCaseData.lines.filter(l => l.id !== lineId);
      recalculateLocalSummary();
      renderAll(currentCaseData);
      M.toast({ html: 'Partida eliminada localmente.', classes: 'blue-grey darken-3' });
    }
  }
}

// Recalcular localmente totales para fallback
function recalculateLocalSummary() {
  let directCost = 0;
  (currentCaseData.lines || []).forEach(l => {
    directCost += (l.subtotal_neto || 0);
  });
  let expensesCost = 0;
  (currentCaseData.expenses || []).forEach(e => {
    expensesCost += (e.subtotal_neto || 0);
  });
  const totalDirect = directCost + expensesCost;
  const gg = Math.round(totalDirect * 0.25);
  const profit = 0;
  const netSubtotal = totalDirect + gg + profit;
  const tax = Math.round(netSubtotal * 0.19);
  const grandTotal = netSubtotal + tax;

  currentCaseData.summary = {
    totalDirect,
    directCost,
    expensesCost,
    porcentaje_gg: 25,
    gg,
    porcentaje_utilidad: 0,
    profit,
    netSubtotal,
    tasa_iva: 19,
    tax,
    grandTotal
  };
}

// Abrir modal de Snapshot
function openSnapshotModal() {
  const modalEl = document.getElementById('modal-nuevo-snapshot');
  if (!modalEl) return;
  document.getElementById('snapshot-preview-total').textContent = BudgetViewer.formatCLP(currentCaseData.summary.grandTotal);
  document.getElementById('snapshot-preview-neto').textContent = BudgetViewer.formatCLP(currentCaseData.summary.netSubtotal);
  const instance = M.Modal.getInstance(modalEl);
  if (instance) instance.open();
}

// Confirmar emisión de Snapshot oficial
async function handleConfirmSnapshot(e) {
  e.preventDefault();
  const supervisor = document.getElementById('snapshot-supervisor-input').value || 'Alejandro Vargas (Supervisor Técnico)';

  try {
    const res = await ApiService.createSnapshot(currentCaseId, supervisor);
    M.toast({ html: `Snapshot ${res.correlativo} emitido e inmutable.`, classes: 'green darken-2' });
    loadSnapshotsList(currentCaseId);
  } catch (err) {
    const countSnapshots = (currentCaseData.snapshots || []).length + 1;
    const snap = {
      id: 'snap-' + Date.now(),
      correlativo: `SIS-2026-084-I-00${countSnapshots}`,
      es_valorizado: true,
      total_presupuesto: currentCaseData.summary.grandTotal,
      supervisor_aprobador: supervisor,
      emitido_en: new Date().toLocaleString('es-CL')
    };
    if (!currentCaseData.snapshots) currentCaseData.snapshots = [];
    currentCaseData.snapshots.unshift(snap);
    renderSnapshotItem(snap);
    renderAdminViews();
    M.toast({ html: `Snapshot oficial emitido localmente (${snap.correlativo}).`, classes: 'green darken-2' });
  }

  const modal = M.Modal.getInstance(document.getElementById('modal-nuevo-snapshot'));
  if (modal) modal.close();
}

// Listar snapshots
async function loadSnapshotsList(caseId) {
  const listEl = document.getElementById('snapshots-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  try {
    const snaps = await ApiService.getSnapshots(caseId);
    if (snaps && snaps.length > 0) {
      snaps.forEach(renderSnapshotItem);
      return;
    }
  } catch (err) {}

  renderSnapshotItem({
    correlativo: 'SIS-2026-084-I-001',
    es_valorizado: true,
    total_presupuesto: 2711436,
    supervisor_aprobador: 'Alejandro Vargas (Supervisor Técnico)',
    emitido_en: '02-06-2026 18:30'
  });
}

function renderSnapshotItem(snap) {
  const listEl = document.getElementById('snapshots-list');
  if (!listEl) return;
  const li = document.createElement('li');
  li.className = 'collection-item avatar';
  li.style.borderBottom = '1px solid var(--slate-200)';
  li.innerHTML = `
    <i class="material-icons circle green darken-2" style="font-size: 1.3rem;">verified_user</i>
    <span class="title" style="font-weight: 800; color: var(--navy-900); font-family: 'JetBrains Mono', monospace;">${snap.correlativo}</span>
    <p style="margin-top: 4px; font-size: 0.85rem; color: var(--slate-600);">
      Monto Congelado: <strong style="color: #b45309; font-family: 'JetBrains Mono', monospace;">${BudgetViewer.formatCLP(snap.total_presupuesto)}</strong><br>
      Aprobado por: <strong>${snap.supervisor_aprobador}</strong> · Fecha: ${snap.emitido_en}
    </p>
    <div class="secondary-content">
      <button class="btn-flat waves-effect blue-text text-darken-3 tooltipped" data-tooltip="Imprimir Copia Inmutable" onclick="window.print()">
        <i class="material-icons">print</i>
      </button>
    </div>
  `;
  listEl.appendChild(li);
  M.Tooltip.init(li.querySelectorAll('.tooltipped'));
}

// Cambio de liquidador (Regla Crítica: Aislamiento Tarifario)
async function handleUpdateLiquidador(e) {
  e.preventDefault();

  if (!isAdminRole()) {
    M.toast({
      html: 'El aislamiento tarifario requiere un perfil de administrador o supervisor.',
      classes: 'red darken-3'
    });
    return;
  }

  const select = document.getElementById('select-nuevo-liquidador');
  if (!select || !select.value) {
    M.toast({ html: 'Seleccione el liquidador que asumirá el expediente.', classes: 'amber darken-3' });
    return;
  }

  const liquidadorId = select.value;
  const liquidadorNombre = select.options[select.selectedIndex].text;

  const confirmMsg = `ADVERTENCIA DE AISLAMIENTO TARIFARIO:\n\nCambiar el liquidador a "${liquidadorNombre}" reseteará todos los precios unitarios del presupuesto a PENDIENTE para evitar mezclar tarifas de firmas competidoras, preservando intactas las geometrías y fotos.\n\n¿Desea continuar?`;
  if (!confirm(confirmMsg)) return;

  try {
    await ApiService.updateLiquidador(currentCaseId, liquidadorId, liquidadorNombre);
    M.toast({ html: 'Liquidador actualizado. Tarifas reseteadas.', classes: 'amber darken-3' });
    loadCase(currentCaseId);
  } catch (err) {
    // Permisos o sesión: el estado local del expediente no se altera.
    if (err && (err.status === 403 || err.status === 401)) {
      M.toast({
        html: err.status === 403
          ? 'Su perfil no tiene permisos para cambiar el liquidador.'
          : 'Su sesión expiró. Vuelva a iniciar sesión.',
        classes: 'red darken-3'
      });
      return;
    }

    if (currentCaseData) {
      currentCaseData.expediente.liquidador_nombre = liquidadorNombre;
      currentCaseData.lines.forEach(l => {
        l.precio_unitario_neto = null;
        l.subtotal_neto = 0;
      });
      recalculateLocalSummary();
      renderAll(currentCaseData);
      M.toast({ html: 'Liquidador actualizado localmente. Precios en PENDIENTE.', classes: 'amber darken-3' });
    }
  }

  const modal = M.Modal.getInstance(document.getElementById('modal-cambiar-liquidador'));
  if (modal) modal.close();
}

// Datos de prueba locales (SIS-2026-084)
// Puente para los atributos onclick del HTML estático y del contenido dinámico.
window.openSnapshotModal = openSnapshotModal;
window.resetPartidaModal = resetPartidaModal;
window.openNewPartidaModal = openNewPartidaModal;
window.editPartida = editPartida;
window.deletePartida = deletePartida;
window.openPhotoLightbox = openPhotoLightbox;
window.openPhotoLightboxById = openPhotoLightboxById;
window.triggerPhotoCapture = triggerPhotoCapture;
window.removePhoto = removePhoto;
window.switchTab = switchTab;
window.setActiveChipBySector = setActiveChipBySector;
window.toggleUserRole = toggleUserRole;
window.updateRoleUI = updateRoleUI;
window.adminUpdateLinePU = adminUpdateLinePU;
window.adminToggleApproval = adminToggleApproval;


// Controladores de Sidebar y Navegación SaaS
window.toggleSidebarCollapse = function() {
  const sidebar = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-collapse-icon');
  if (sidebar) {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (icon) icon.textContent = isCollapsed ? 'menu' : 'menu_open';
  }
};

window.toggleMobileSidebar = function(open) {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    if (open) sidebar.classList.add('mobile-open');
    else sidebar.classList.remove('mobile-open');
  }
  if (backdrop) {
    if (open) backdrop.classList.add('active');
    else backdrop.classList.remove('active');
  }
};

window.handleGlobalSearch = function(query) {
  const q = (query || '').toLowerCase().trim();
  const searchInput = document.getElementById('acta-search-input');
  if (searchInput) {
    searchInput.value = q;
    BudgetViewer.activeSearchQuery = q;
  }
  if (q && currentCaseData) {
    switchTab('tab-presupuesto');
    renderAll(currentCaseData);
  }
};

window.refreshWebmasterData = function() {
  M.toast({ html: 'Actualizando diagnóstico de infraestructura...', classes: 'purple darken-2' });
  renderWebmasterDashboard();
};


/* ==========================================================================
   MÓDULO DEL INSPECTOR: EXPEDIENTES ASIGNADOS, FICHA Y CUANTIFICACIÓN (100% POSTGRESQL)
   ========================================================================== */

let inspectorCasesState = {
  page: 1,
  limit: 10,
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  sortBy: 'created_at',
  sortOrder: 'DESC',
  total: 0,
  totalPages: 1
};

let cachedInspectorCasesList = null;
let activeInspectionFilterStatus = 'all';
let customInspectorSectors = ['BAÑO 1', 'LIVING', 'COMEDOR', 'COCINA', 'DORMITORIO 1', 'FACHADA'];

// Obtener la lista de expedientes asignados al inspector desde PostgreSQL
async function getInspectorAssignedCasesList() {
  try {
    const res = await ApiService.getAssignedCases({
      page: 1,
      limit: 100,
      search: '',
      status: 'all'
    });
    return Array.isArray(res) ? res : (res && res.data ? res.data : []);
  } catch (err) {
    console.warn('[getInspectorAssignedCasesList] Error al consultar PostgreSQL:', err.message);
    return [];
  }
}

// ==============================================================
// NAVEGACIÓN Y DASHBOARD DEL INSPECTOR (ARQUITECTURA SPA DINÁMICA)
// ==============================================================

// 1. Mostrar Home del Inspector (Panel de Control + 6 KPIs + Acciones Rápidas + Mis Expedientes)
async function showInspectorHome(targetSection = 'dashboard') {
  const inspectorMain = document.getElementById('inspector-main-content');
  const adminMain = document.getElementById('admin-main-content');
  const homeSec = document.getElementById('inspector-home');
  const caseSec = document.getElementById('inspector-expediente-view');

  if (adminMain) adminMain.style.display = 'none';
  if (inspectorMain) inspectorMain.style.display = 'block';
  if (homeSec) homeSec.style.display = 'block';
  if (caseSec) caseSec.style.display = 'none';

  // Saludo dinámico con el nombre del usuario autenticado
  const user = ApiService.getCurrentUser ? ApiService.getCurrentUser() : (currentUser || {});
  const userNameEl = document.getElementById('inspector-home-user-name');
  if (userNameEl && user && user.nombre) {
    userNameEl.textContent = user.nombre;
  }

  // Ocultar elementos exclusivos de administración y barras de tabs superiores
  const finRow = document.getElementById('admin-financial-metrics-row');
  if (finRow) finRow.style.display = 'none';
  const desktopTabs = document.getElementById('desktop-tabs-bar');
  if (desktopTabs) desktopTabs.style.display = 'none';
  const caseControlBar = document.getElementById('global-case-control-bar');
  if (caseControlBar) caseControlBar.style.display = 'none';
  const topbarBtnAdd = document.getElementById('topbar-btn-add-partida');
  if (topbarBtnAdd) topbarBtnAdd.style.display = 'none';

  // Sincronizar sidebar
  document.querySelectorAll('.sidebar-menu-link').forEach(link => link.classList.remove('active'));
  const activeSelector = targetSection === 'cases' 
    ? '#sidebar-item-inspector-expedientes .sidebar-menu-link' 
    : '.sidebar-menu-link[data-tab="tab-dashboard"]';
  const activeLink = document.querySelector(activeSelector);
  if (activeLink) activeLink.classList.add('active');

  const breadcrumb = document.getElementById('app-breadcrumbs-current');
  if (breadcrumb) {
    breadcrumb.textContent = targetSection === 'cases' ? 'Mis Expedientes Asignados' : 'Panel de Inspección';
  }

  // Cargar métricas del dashboard y listado de casos asignados desde PostgreSQL
  await loadInspectorDashboard();
  await loadAssignedCases(1);

  if (targetSection === 'cases') {
    const tableEl = document.getElementById('inspector-assigned-cases-table-section');
    if (tableEl) {
      setTimeout(() => {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  } else {
    const scrollContainer = document.getElementById('app-main-content-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }
}

// 2. Cargar KPIs operativos reales del Inspector desde PostgreSQL
async function loadInspectorDashboard() {
  showPageLoading("Cargando indicadores...");
  try {
    const kpis = await ApiService.getInspectorKpis();
    const setKpi = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val !== undefined && val !== null ? val : 0;
    };

    setKpi('inspector-kpi-total-casos', kpis.asignados);
    setKpi('inspector-kpi-casos-pendientes', kpis.pendientes);
    setKpi('inspector-kpi-casos-proceso', kpis.en_proceso);
    setKpi('inspector-kpi-casos-completados', kpis.completados);
    setKpi('inspector-kpi-partidas', kpis.danos);
    setKpi('inspector-kpi-fotos', kpis.fotos);

    const user = ApiService.getCurrentUser ? ApiService.getCurrentUser() : (currentUser || {});
    const userNameEl = document.getElementById('inspector-home-user-name');
    if (userNameEl && user && user.nombre) {
      userNameEl.textContent = user.nombre;
    }
  } catch (err) {
    console.warn('[Dashboard Inspector] Error al cargar indicadores desde PostgreSQL:', err.message);
  } finally {
    hidePageLoading();
  }
}

// 3. Cargar expedientes asignados al inspector autenticado con paginación real de PostgreSQL
async function loadAssignedCases(page = 1) {
  showPageLoading("Consultando expedientes...");
  inspectorCasesState.page = page;
  try {
    const res = await ApiService.getAssignedCases({
      page: inspectorCasesState.page,
      limit: inspectorCasesState.limit,
      search: inspectorCasesState.search,
      status: inspectorCasesState.status,
      dateFrom: inspectorCasesState.dateFrom,
      dateTo: inspectorCasesState.dateTo,
      sortBy: inspectorCasesState.sortBy,
      sortOrder: inspectorCasesState.sortOrder
    });

    const cases = Array.isArray(res) ? res : (res && res.data ? res.data : []);
    const pagination = res && res.pagination ? res.pagination : {
      total: cases.length,
      page: inspectorCasesState.page,
      limit: inspectorCasesState.limit,
      totalPages: Math.ceil(cases.length / inspectorCasesState.limit) || 1
    };

    inspectorCasesState.total = pagination.total;
    inspectorCasesState.totalPages = pagination.totalPages;

    renderInspectorCasesDataTable(cases);
    renderInspectorCasesMobileCards(cases);
    renderInspectorCasesPagination(pagination);

    const footerCount = document.getElementById('inspector-cases-footer-count');
    if (footerCount) {
      footerCount.textContent = `Mostrando ${cases.length} de ${pagination.total} expedientes asignados a su cargo`;
    }
    const badgeCount = document.getElementById('inspector-assigned-badge-count');
    if (badgeCount) {
      badgeCount.textContent = `${pagination.total} Casos Asignados`;
    }
  } catch (err) {
    console.error('[loadAssignedCases] Error al consultar expedientes:', err);
    renderInspectorCasesDataTable([]);
    renderInspectorCasesMobileCards([]);
  } finally {
    hidePageLoading();
  }
}

const loadInspectorAssignedCases = loadAssignedCases;

// Ordenamiento reactivo por columnas
function sortInspectorCasesBy(column) {
  if (inspectorCasesState.sortBy === column) {
    inspectorCasesState.sortOrder = inspectorCasesState.sortOrder === 'ASC' ? 'DESC' : 'ASC';
  } else {
    inspectorCasesState.sortBy = column;
    inspectorCasesState.sortOrder = 'ASC';
  }
  updateSortIconsUI(column, inspectorCasesState.sortOrder);
  loadAssignedCases(1);
}

function updateSortIconsUI(activeCol, order) {
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.classList.remove('sorted');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = 'swap_vert';
  });
  const activeTh = document.querySelector(`.sortable-th[data-col="${activeCol}"]`);
  if (activeTh) {
    activeTh.classList.add('sorted');
    const icon = activeTh.querySelector('.sort-icon');
    if (icon) icon.textContent = order === 'ASC' ? 'arrow_upward' : 'arrow_downward';
  }
}

// Filtro por fecha de visita
function filterInspectorCasesByDate() {
  const from = document.getElementById('inspector-case-date-from');
  const to = document.getElementById('inspector-case-date-to');
  inspectorCasesState.dateFrom = from ? from.value : '';
  inspectorCasesState.dateTo = to ? to.value : '';
  loadAssignedCases(1);
}

function resetInspectorCaseDateFilter() {
  const from = document.getElementById('inspector-case-date-from');
  const to = document.getElementById('inspector-case-date-to');
  if (from) from.value = '';
  if (to) to.value = '';
  inspectorCasesState.dateFrom = '';
  inspectorCasesState.dateTo = '';
  loadAssignedCases(1);
}

// Abrir ficha y disparar modal para registrar daño en ese expediente
async function openInspectorCaseAndAddDamage(caseId) {
  await openInspectorCase(caseId, 'subtab-danos');
  setTimeout(() => {
    openAddDamageModalFromInspection();
  }, 350);
}

// ==============================================================
// ACCIONES RÁPIDAS DEL INSPECTOR (CON VALIDACIÓN SWEETALERT2)
// ==============================================================

function quickActionVerExpedientes() {
  switchTab('tab-inspector-expedientes');
  const tableEl = document.getElementById('inspector-assigned-cases-table-section');
  if (tableEl) {
    tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function quickActionContinuarInspeccion() {
  if (currentCaseId && currentCaseData && currentCaseData.expediente) {
    await openInspectorCase(currentCaseId, 'subtab-danos');
  } else {
    promptSelectAssignedCase(async (selectedId) => {
      await openInspectorCase(selectedId, 'subtab-danos');
    }, 'Continuar Inspección', 'Seleccione el expediente sobre el cual desea continuar el levantamiento pericial:');
  }
}

async function quickActionRegistrarDano() {
  if (currentCaseId && currentCaseData && currentCaseData.expediente) {
    await openInspectorCase(currentCaseId, 'subtab-danos');
    setTimeout(() => openAddDamageModalFromInspection(), 350);
  } else {
    promptSelectAssignedCase(async (selectedId) => {
      await openInspectorCase(selectedId, 'subtab-danos');
      setTimeout(() => openAddDamageModalFromInspection(), 400);
    }, 'Registrar Daño', 'Seleccione el expediente al cual desea registrar una nueva partida de daño:');
  }
}

async function quickActionAdjuntarFotos() {
  if (currentCaseId && currentCaseData && currentCaseData.expediente) {
    await openInspectorCase(currentCaseId, 'subtab-fotos');
    setTimeout(() => openPhotoUploadModal(), 350);
  } else {
    promptSelectAssignedCase(async (selectedId) => {
      await openInspectorCase(selectedId, 'subtab-fotos');
      setTimeout(() => openPhotoUploadModal(), 400);
    }, 'Adjuntar Fotografías', 'Seleccione el expediente al cual desea adjuntar evidencia fotográfica de terreno:');
  }
}

async function quickActionConsultarSectores() {
  if (currentCaseId && currentCaseData && currentCaseData.expediente) {
    await openInspectorCase(currentCaseId, 'subtab-sectores');
  } else {
    promptSelectAssignedCase(async (selectedId) => {
      await openInspectorCase(selectedId, 'subtab-sectores');
    }, 'Consultar Sectores', 'Seleccione el expediente para consultar y gestionar los sectores y recintos inspeccionados:');
  }
}

// Selector modal SweetAlert2 de expediente asignado para acciones rápidas
async function promptSelectAssignedCase(callback, title = 'Seleccionar Expediente', subtitle = 'Seleccione un expediente asignado para continuar:') {
  try {
    showPageLoading('Consultando expedientes...');
    const res = await ApiService.getAssignedCases({ limit: 50 });
    hidePageLoading();
    const cases = Array.isArray(res) ? res : (res && res.data ? res.data : []);
    if (!cases || cases.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'Sin Expedientes Asignados',
          text: 'Actualmente no tiene expedientes asignados para realizar esta acción.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#10222F'
        });
      }
      return;
    }

    const optionsHtml = cases.map(c => 
      `<option value="${c.id}">${c.codigo} — ${c.cliente_nombre || 'Asegurado'} (${c.numero_siniestro || 'Siniestro'})</option>`
    ).join('');

    if (typeof Swal !== 'undefined') {
      const { value: selectedId } = await Swal.fire({
        title: title,
        html: `
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 12px; text-align: left;">${subtitle}</p>
          <div style="text-align: left;">
            <select id="swal-select-case" class="browser-default" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 0.88rem; color: #0f172a; background: #f8fafc;">
              ${optionsHtml}
            </select>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Seleccionar y Continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10222F',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
          const select = document.getElementById('swal-select-case');
          return select ? select.value : null;
        }
      });

      if (selectedId && typeof callback === 'function') {
        callback(selectedId);
      }
    }
  } catch (err) {
    hidePageLoading();
    console.error('Error al solicitar expediente:', err);
  }
}

// Renderizar la tabla DataTable de expedientes (Escritorio / Tablet)
function renderInspectorCasesDataTable(cases) {
  const tbody = document.getElementById('inspector-cases-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!cases || cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="center-align grey-text" style="padding: 30px;">
          <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_off</i>
          No existen expedientes asignados
        </td>
      </tr>
    `;
    return;
  }

  cases.forEach(c => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = (e) => {
      if (!e.target.closest('button')) {
        openInspectorCase(c.id, 'subtab-info');
      }
    };

    let badgeClass = 'green lighten-5 green-text text-darken-3';
    let estadoTexto = 'Activo';
    if (c.estado === 'en_espera') {
      badgeClass = 'amber lighten-5 amber-text text-darken-4';
      estadoTexto = 'En Espera';
    } else if (c.estado === 'procesado') {
      badgeClass = 'blue lighten-5 blue-text text-darken-3';
      estadoTexto = 'Procesado';
    }

    const pct = c.avance_porcentaje !== undefined 
      ? c.avance_porcentaje 
      : (c.estado === 'procesado' ? 100 : (c.estado === 'en_espera' ? 15 : 60));

    tr.innerHTML = `
      <td><strong style="color: var(--navy-950); font-weight: 800;">${c.codigo}</strong></td>
      <td><code>${c.numero_siniestro || 'SIN-S/N'}</code></td>
      <td><strong>${c.cliente_nombre || 'Asegurado'}</strong></td>
      <td style="font-size: 0.82rem; color: var(--slate-600);">${c.direccion || c.comuna || 'Sin dirección'}</td>
      <td><span class="badge grey lighten-3 grey-text text-darken-3" style="border-radius: 4px; font-size: 0.75rem;">${c.tipo_evento || 'Sismo'}</span></td>
      <td style="font-size: 0.82rem; white-space: nowrap;">${c.fecha_visita || '02/06/2026'}</td>
      <td><span class="badge ${badgeClass}" style="font-weight: 700; border-radius: 4px; font-size: 0.72rem;">${estadoTexto}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #334155;">${pct}%</span>
          <div class="case-progress-wrap">
            <div class="case-progress-bar" style="width: ${pct}%;"></div>
          </div>
        </div>
      </td>
      <td class="center-align" style="white-space: nowrap;">
        <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-small primary darken-1 waves-effect" title="Ver Ficha de Inspección" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('${c.id}', 'subtab-info');">
            <i class="material-icons tiny">assignment</i> Ver
          </button>
          <button type="button" class="btn btn-small amber darken-3 waves-effect" title="Continuar Inspección / Gestionar Daños" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('${c.id}', 'subtab-danos');">
            <i class="material-icons tiny">play_circle</i> Continuar
          </button>
          <button type="button" class="btn btn-small teal darken-2 waves-effect" title="Registrar Daños" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCaseAndAddDamage('${c.id}');">
            <i class="material-icons tiny">straighten</i> + Daño
          </button>
          <button type="button" class="btn btn-small blue-grey darken-3 waves-effect" title="Consultar Fotografías" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('${c.id}', 'subtab-fotos');">
            <i class="material-icons tiny">photo_camera</i> Fotos
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderizar tarjetas táctiles para Móvil (Mobile-First < 768px)
function renderInspectorCasesMobileCards(cases) {
  const container = document.getElementById('inspector-cases-mobile-cards');
  if (!container) return;

  container.innerHTML = '';
  if (!cases || cases.length === 0) {
    container.innerHTML = `
      <div class="center-align grey-text" style="padding: 30px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_off</i>
        No existen expedientes asignados
      </div>
    `;
    return;
  }

  cases.forEach(c => {
    let badgeClass = 'green lighten-5 green-text text-darken-3';
    let estadoTexto = 'Activo';
    if (c.estado === 'en_espera') {
      badgeClass = 'amber lighten-5 amber-text text-darken-4';
      estadoTexto = 'En Espera';
    } else if (c.estado === 'procesado') {
      badgeClass = 'blue lighten-5 blue-text text-darken-3';
      estadoTexto = 'Procesado';
    }

    const pct = c.avance_porcentaje !== undefined 
      ? c.avance_porcentaje 
      : (c.estado === 'procesado' ? 100 : (c.estado === 'en_espera' ? 15 : 60));

    const card = document.createElement('div');
    card.className = 'case-card-mobile';
    card.innerHTML = `
      <div class="case-card-mobile-header">
        <strong style="color: var(--navy-950); font-size: 1rem;">${c.codigo}</strong>
        <span class="badge ${badgeClass}" style="margin: 0; font-weight: 700; border-radius: 4px; font-size: 0.72rem;">${estadoTexto}</span>
      </div>
      <div class="case-card-mobile-body">
        <div style="font-size: 0.82rem; color: var(--slate-600); margin-bottom: 4px;">
          Siniestro: <code>${c.numero_siniestro || 'SIN-S/N'}</code>
        </div>
        <div style="font-size: 0.92rem; font-weight: 700; color: var(--navy-950);">
          ${c.cliente_nombre || 'Asegurado'}
        </div>
        <div style="font-size: 0.82rem; color: var(--slate-600); margin-top: 2px;">
          <i class="material-icons tiny" style="vertical-align: middle;">location_on</i> ${c.direccion || c.comuna || 'Sin dirección'}
        </div>
        <div style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--slate-600); margin-bottom: 3px;">
            <span>Avance inspección</span>
            <strong>${pct}%</strong>
          </div>
          <div class="case-progress-wrap" style="height: 6px;">
            <div class="case-progress-bar" style="width: ${pct}%;"></div>
          </div>
        </div>
      </div>
      <div class="case-card-mobile-actions" style="display: flex; gap: 4px; flex-wrap: wrap;">
        <button type="button" class="btn btn-small primary darken-1 waves-effect" style="flex: 1; min-width: 70px; padding: 0 4px; font-size: 0.72rem;" onclick="openInspectorCase('${c.id}', 'subtab-info');">
          <i class="material-icons left tiny">assignment</i> Ver
        </button>
        <button type="button" class="btn btn-small amber darken-3 waves-effect" style="flex: 1; min-width: 70px; padding: 0 4px; font-size: 0.72rem;" onclick="openInspectorCase('${c.id}', 'subtab-danos');">
          <i class="material-icons left tiny">play_circle</i> Continuar
        </button>
        <button type="button" class="btn btn-small teal darken-2 waves-effect" style="flex: 1; min-width: 70px; padding: 0 4px; font-size: 0.72rem;" onclick="openInspectorCaseAndAddDamage('${c.id}');">
          <i class="material-icons left tiny">straighten</i> + Daño
        </button>
        <button type="button" class="btn btn-small blue-grey darken-3 waves-effect" style="flex: 1; min-width: 70px; padding: 0 4px; font-size: 0.72rem;" onclick="openInspectorCase('${c.id}', 'subtab-fotos');">
          <i class="material-icons left tiny">photo_camera</i> Fotos
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Paginación de expedientes desde el servidor
function renderInspectorCasesPagination(pagination) {
  const container = document.getElementById('inspector-cases-pagination-container');
  const info = document.getElementById('inspector-pagination-info');
  const btnPrev = document.getElementById('btn-inspector-page-prev');
  const btnNext = document.getElementById('btn-inspector-page-next');
  if (!container || !pagination) return;

  if (pagination.totalPages <= 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  if (info) info.textContent = `Página ${pagination.page} de ${pagination.totalPages}`;

  if (btnPrev) {
    btnPrev.disabled = pagination.page <= 1;
    btnPrev.onclick = () => loadAssignedCases(pagination.page - 1);
  }
  if (btnNext) {
    btnNext.disabled = pagination.page >= pagination.totalPages;
    btnNext.onclick = () => loadAssignedCases(pagination.page + 1);
  }
}

// Filtro en tiempo real por búsqueda de texto (debounced hacia PostgreSQL)
let searchDebounceTimeout = null;
function filterInspectorCasesTable(searchText) {
  inspectorCasesState.search = (searchText || '').trim();
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    loadAssignedCases(1);
  }, 300);
}

// Filtro por estado en PostgreSQL
function filterInspectorCasesByStatus(status, btnElement) {
  inspectorCasesState.status = status;
  document.querySelectorAll('.case-filter-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  loadAssignedCases(1);
}

// 4. Abrir la Ficha de Inspección dentro del contenedor content (SPA sin recarga)
async function openInspectorCase(caseId, initialSection = "subtab-info") {
  showPageLoading("Abriendo ficha de inspección...");
  currentCaseId = caseId;

  try {
    const data = await ApiService.getCaseDetails(caseId);
    currentCaseData = data;
  } catch (err) {
    console.error('[openInspectorCase] Error al cargar expediente:', err);
    M.toast({ html: 'Error al consultar expediente desde el servidor: ' + err.message, classes: 'red darken-3' });
    return;
  }

  // Ocultar Home y mostrar Ficha dentro del content
  const homeSec = document.getElementById('inspector-home');
  const caseSec = document.getElementById('inspector-expediente-view');
  if (homeSec) homeSec.style.display = 'none';
  if (caseSec) caseSec.style.display = 'block';

  // Renderizar datos del expediente
  renderInspectorCase(currentCaseData);

  // Activar la sección interna indicada
  showInspectorCaseSection(initialSection);

  // Sincronizar selector de expedientes si existe
  const caseSelector = document.getElementById('case-selector');
  if (caseSelector) caseSelector.value = caseId;

  // Mostrar ítem en sidebar
  const sidebarFicha = document.getElementById('sidebar-item-ficha-inspeccion');
  if (sidebarFicha) sidebarFicha.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  hidePageLoading();
}

const openCaseInspectionSheet = openInspectorCase;

// 5. Renderizar datos del expediente en el encabezado y sub-paneles
function renderInspectorCase(caseData) {
  if (!caseData) return;
  const exp = caseData.expediente || {};

  // Rellenar encabezado de la ficha
  const elCodigo = document.getElementById('ficha-case-codigo');
  const elBadge = document.getElementById('ficha-case-estado-badge');
  const elCliente = document.getElementById('ficha-case-cliente');
  const elDireccion = document.getElementById('ficha-case-direccion');
  const elSiniestro = document.getElementById('ficha-case-siniestro');
  const elPoliza = document.getElementById('ficha-case-poliza');
  const elAseguradora = document.getElementById('ficha-case-aseguradora');
  const elInspector = document.getElementById('ficha-case-inspector');
  const elTipoEvento = document.getElementById('ficha-case-tipo-evento');
  const elFechaVisita = document.getElementById('ficha-case-fecha-visita');

  if (elCodigo) elCodigo.textContent = exp.codigo || 'SIS-S/N';
  if (elCliente) elCliente.textContent = exp.cliente_nombre || 'Cliente';
  if (elDireccion) elDireccion.textContent = exp.direccion || 'Dirección de visita';
  if (elSiniestro) elSiniestro.textContent = exp.numero_siniestro || 'SIN-S/N';
  if (elPoliza) elPoliza.textContent = exp.numero_poliza || 'POL-S/N';
  if (elAseguradora) elAseguradora.textContent = exp.aseguradora || 'Compañía de Seguros';
  const inspectorName = (currentUser && currentUser.rol === 'inspector' && currentUser.nombre) ? currentUser.nombre : (exp.inspector_nombre || 'PEDRO PÉREZ');
  if (elInspector) elInspector.textContent = inspectorName;
  if (elTipoEvento) elTipoEvento.textContent = exp.tipo_evento || 'Sismo';
  if (elFechaVisita) elFechaVisita.textContent = exp.fecha_visita || '02/06/2026';

  if (elBadge) {
    const estado = (exp.estado || 'activo').toUpperCase();
    elBadge.textContent = estado;
    elBadge.style.background = exp.estado === 'procesado' ? '#3b82f6' : (exp.estado === 'en_espera' ? '#f59e0b' : '#10b981');
  }

  // Rellenar Sub-Panel 1: Información
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
  setEl('info-cliente-nombre', exp.cliente_nombre);
  setEl('info-cliente-rut', exp.cliente_rut);
  setEl('info-cliente-telefono', exp.cliente_telefono);
  setEl('info-cliente-direccion', exp.direccion);
  setEl('info-cliente-comuna', `${exp.comuna || ''}, ${exp.region || ''}`);
  setEl('info-inmueble-tipo', `${exp.tipo_inmueble || 'Casa'} · ${exp.sistema_constructivo || 'Albañilería'}`);
  setEl('info-fecha-evento', exp.fecha_evento || '31/05/2026');
  setEl('info-fecha-visita', exp.fecha_visita || '02/06/2026');
  setEl('info-tipo-evento', exp.tipo_evento || 'Sismo');

  // Rellenar Sub-Panel 2: Sectores
  renderInspectionSectors(caseData);

  // Rellenar Sub-Panel 3: Daños Registrados
  renderInspectionDamages(caseData);

  // Rellenar Sub-Panel 4: Fotografías
  renderInspectionPhotos(caseData);

  // Rellenar Sub-Panel 5: Observaciones
  const obsArea = document.getElementById('inspection-observaciones-text');
  if (obsArea) obsArea.value = exp.observaciones_generales || '';

  // Rellenar Sub-Panel 6: Resumen
  updateInspectionSummaryCards(caseData);
}

// Alternar entre las sub-secciones internas de la Ficha
function showInspectorCaseSection(sectionId, clickedElement = null) {
  if (clickedElement && typeof clickedElement.blur === 'function') {
    clickedElement.blur();
  }
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  document.querySelectorAll('.case-tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.inspection-subtab-pane').forEach(p => p.style.display = 'none');
  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  document.querySelectorAll('.case-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.inspection-subtab-btn').forEach(b => b.classList.remove('active'));
  
  const activeBtn = (clickedElement && clickedElement.classList) 
    ? clickedElement 
    : (document.querySelector(`.case-tab-btn[data-subtab="${sectionId}"]`) || document.querySelector(`.inspection-subtab-btn[data-subtab="${sectionId}"]`));
  if (activeBtn) activeBtn.classList.add('active');
}

const switchInspectionSubTab = showInspectorCaseSection;

// Volver al Home del Inspector
async function backToInspectorHome() {
  const homeSec = document.getElementById('inspector-home');
  const caseSec = document.getElementById('inspector-expediente-view');
  if (homeSec) homeSec.style.display = 'block';
  if (caseSec) caseSec.style.display = 'none';

  const sidebarFicha = document.getElementById('sidebar-item-ficha-inspeccion');
  if (sidebarFicha) sidebarFicha.style.display = 'none';

  await loadAssignedCases(1);
  await loadInspectorDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Desplazar carrusel miniatura de fotos horizontalmente
function scrollSectorCarousel(trackId, direction) {
  const track = document.getElementById(trackId);
  if (!track) return;
  const scrollAmount = 180;
  track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}
window.scrollSectorCarousel = scrollSectorCarousel;

// Renderizar las tarjetas de sectores del expediente desde PostgreSQL con carrusel miniatura
function renderInspectionSectors(caseData) {
  const container = document.getElementById('ficha-sectores-grid');
  if (!container) return;

  const lines = caseData.lines || [];
  const photos = caseData.photos || [];
  const dbSectors = caseData.sectors || [];

  const sectorMap = new Map();
  dbSectors.forEach(s => {
    sectorMap.set(s.nombre.toUpperCase(), {
      id: s.id,
      nombre: s.nombre.toUpperCase(),
      descripcion: s.descripcion || ''
    });
  });

  lines.forEach(l => {
    if (l.sector) {
      const key = l.sector.toUpperCase();
      if (!sectorMap.has(key)) {
        sectorMap.set(key, { id: null, nombre: key, descripcion: '' });
      }
    }
  });

  photos.forEach(p => {
    if (p.sector) {
      const key = p.sector.toUpperCase();
      if (!sectorMap.has(key)) {
        sectorMap.set(key, { id: null, nombre: key, descripcion: '' });
      }
    }
  });

  const sectorList = Array.from(sectorMap.values());
  const badgeCount = document.getElementById('ficha-badge-sectores-count');
  if (badgeCount) badgeCount.textContent = sectorList.length;

  // Actualizar también el carrusel superior del inmueble (visión general de todas las fotos)
  const overviewCard = document.getElementById('ficha-inmueble-photos-carousel-card');
  const overviewTrack = document.getElementById('inmueble-overview-carousel-track');
  const overviewBadge = document.getElementById('inmueble-carousel-total-badge');

  if (overviewCard && overviewTrack) {
    if (photos.length > 0) {
      overviewCard.style.display = 'block';
      if (overviewBadge) overviewBadge.textContent = `${photos.length} foto${photos.length !== 1 ? 's' : ''}`;
      overviewTrack.innerHTML = photos.map((p, idx) => {
        const pId = `ov-${p.id || idx}`;
        const secTag = (p.sector || 'GENERAL').toUpperCase();
        return `
          <div class="sector-carousel-thumb inmueble-overview-thumb" data-overview-photo-id="${pId}" title="${(p.descripcion || secTag).replace(/"/g, '&quot;')}">
            <span class="sector-thumb-sector-tag">${secTag}</span>
            <div class="sector-thumb-loader" id="ov-loader-${pId}">
              <div class="preloader-wrapper tiny active" style="width: 18px; height: 18px;">
                <div class="spinner-layer spinner-amber-only">
                  <div class="circle-clipper left"><div class="circle"></div></div>
                  <div class="gap-patch"><div class="circle"></div></div>
                  <div class="circle-clipper right"><div class="circle"></div></div>
                </div>
              </div>
            </div>
            <img id="ov-img-${pId}"
                 src="${photoSource(p) || PHOTO_PLACEHOLDER}"
                 alt="Foto ${idx + 1}"
                 loading="lazy"
                 onload="const l = document.getElementById('ov-loader-${pId}'); if(l) l.style.display='none'; this.style.opacity='1';"
                 onerror="const l = document.getElementById('ov-loader-${pId}'); if(l) l.style.display='none'; this.src='${PHOTO_PLACEHOLDER}'; this.style.opacity='1';"
                 style="opacity: 0; transition: opacity 0.3s ease;">
            <span class="sector-thumb-zoom-badge"><i class="material-icons">zoom_in</i></span>
          </div>
        `;
      }).join('');

      photos.forEach((p, idx) => {
        const pId = `ov-${p.id || idx}`;
        const secTag = (p.sector || 'GENERAL').toUpperCase();
        const el = overviewTrack.querySelector(`[data-overview-photo-id="${pId}"]`);
        if (el) {
          el.addEventListener('click', async (e) => {
            e.stopPropagation();
            let src = (document.getElementById(`ov-img-${pId}`)?.src) || photoSource(p) || PHOTO_PLACEHOLDER;
            if (!src || src === PHOTO_PLACEHOLDER) {
              try { src = await getAuthorizedPhotoUrl(p); } catch (_) {}
            }
            openPhotoLightbox(src, secTag, p.descripcion || `Evidencia fotográfica en ${secTag}`);
          });
        }
        getAuthorizedPhotoUrl(p).then(authUrl => {
          const img = document.getElementById(`ov-img-${pId}`);
          const loader = document.getElementById(`ov-loader-${pId}`);
          if (img && authUrl) {
            img.src = authUrl;
            if (loader) loader.style.display = 'none';
            img.style.opacity = '1';
          }
        }).catch(() => {});
      });
    } else {
      overviewCard.style.display = 'none';
    }
  }

  container.innerHTML = '';
  if (sectorList.length === 0) {
    container.innerHTML = `
      <div class="col s12 center-align grey-text" style="padding: 30px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">meeting_room</i>
        No se registran sectores en este expediente. Presione <strong>"+ Nuevo Sector"</strong> para comenzar.
      </div>
    `;
    return;
  }

  sectorList.forEach(sec => {
    const sectorName = sec.nombre;
    const sectorLines = lines.filter(l => (l.sector || '').toUpperCase() === sectorName);
    const sectorPhotos = photos.filter(p => (p.sector || '').toUpperCase() === sectorName);

    let metrajeSector = 0;
    sectorLines.forEach(l => { metrajeSector += parseFloat(l.cantidad_medida || 0); });

    const safeId = sectorName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const trackId = `sector-track-${safeId}`;

    let carouselHtml = '';
    if (sectorPhotos.length > 0) {
      carouselHtml = `
        <div class="sector-photos-carousel-container">
          <div class="sector-carousel-header">
            <span class="sector-carousel-title">
              <i class="material-icons tiny" style="font-size: 15px; color: var(--navy-800);">collections</i>
              Evidencias (${sectorPhotos.length})
            </span>
            ${sectorPhotos.length > 2 ? `
              <div class="sector-carousel-controls">
                <button type="button" class="sector-carousel-btn" onclick="scrollSectorCarousel('${trackId}', -1)" title="Foto anterior" aria-label="Foto anterior">
                  <i class="material-icons">chevron_left</i>
                </button>
                <button type="button" class="sector-carousel-btn" onclick="scrollSectorCarousel('${trackId}', 1)" title="Foto siguiente" aria-label="Foto siguiente">
                  <i class="material-icons">chevron_right</i>
                </button>
              </div>
            ` : ''}
          </div>
          <div class="sector-carousel-track" id="${trackId}">
            ${sectorPhotos.map((p, pIdx) => {
              const pId = String(p.id || `${safeId}-${pIdx}`);
              return `
                <div class="sector-carousel-thumb" data-carousel-photo-id="${pId}" title="${(p.descripcion || `Evidencia ${pIdx + 1} en ${sectorName}`).replace(/"/g, '&quot;')}">
                  <div class="sector-thumb-loader" id="sector-loader-${pId}">
                    <div class="preloader-wrapper tiny active" style="width: 18px; height: 18px;">
                      <div class="spinner-layer spinner-amber-only">
                        <div class="circle-clipper left"><div class="circle"></div></div>
                        <div class="gap-patch"><div class="circle"></div></div>
                        <div class="circle-clipper right"><div class="circle"></div></div>
                      </div>
                    </div>
                  </div>
                  <img id="sector-thumb-img-${pId}"
                       src="${photoSource(p) || PHOTO_PLACEHOLDER}"
                       alt="Evidencia ${pIdx + 1}"
                       loading="lazy"
                       onload="const l = document.getElementById('sector-loader-${pId}'); if(l) l.style.display='none'; this.style.opacity='1';"
                       onerror="const l = document.getElementById('sector-loader-${pId}'); if(l) l.style.display='none'; this.src='${PHOTO_PLACEHOLDER}'; this.style.opacity='1';"
                       style="opacity: 0; transition: opacity 0.3s ease;">
                  <span class="sector-thumb-zoom-badge"><i class="material-icons">zoom_in</i></span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      carouselHtml = `
        <div class="sector-photos-carousel-container" style="padding: 6px 8px; background: transparent; border-style: dashed;">
          <div class="sector-carousel-empty" onclick="openPhotoUploadModal('${sectorName}')" title="Capturar o subir fotografía en ${sectorName}">
            <i class="material-icons tiny">add_a_photo</i>
            <span>Sin fotos en este sector · Toca para agregar</span>
          </div>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'sector-card';
    card.innerHTML = `
      <div class="sector-card-header">
        <h6 class="sector-card-title">
          <i class="material-icons tiny" style="color: var(--amber-500);">meeting_room</i>
          ${sectorName}
        </h6>
        <span class="badge ${sectorLines.length > 0 ? 'green lighten-5 green-text text-darken-3' : 'grey lighten-4 grey-text'}" style="font-weight: 700; border-radius: 4px; font-size: 0.72rem;">
          ${sectorLines.length > 0 ? `${sectorLines.length} daños` : 'Sin daños'}
        </span>
      </div>
      <div style="font-size: 0.82rem; color: var(--slate-600); margin: 6px 0;">
        Metraje levantado: <strong>${metrajeSector.toFixed(2)} m²</strong>
      </div>
      <div class="sector-stats-row">
        <span class="sector-stat-badge">
          <i class="material-icons tiny">straighten</i> ${sectorLines.length} partidas
        </span>
        <span class="sector-stat-badge">
          <i class="material-icons tiny">photo_camera</i> ${sectorPhotos.length} fotos
        </span>
      </div>

      <!-- Carrusel miniatura de imágenes del sector -->
      ${carouselHtml}

      <div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="btn btn-small btn-add-partida amber darken-3" style="flex: 1; min-height: 36px; font-size: 0.76rem;" onclick="openAddDamageModalWithSector('${sectorName}')">
          <i class="material-icons" style="font-size: 16px;">add_circle</i>+ Partida
        </button>
        <button type="button" class="btn btn-small waves-effect teal darken-2" title="Tomar evidencia fotográfica en ${sectorName}" style="border-radius: 8px; padding: 0 10px; min-height: 36px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem;" onclick="openPhotoUploadModal('${sectorName}')">
          <i class="material-icons tiny">camera_alt</i>+ Foto
        </button>
        <button type="button" class="btn btn-small waves-effect blue-grey darken-3" title="Filtrar daños de este sector" style="border-radius: 8px; padding: 0 10px; min-height: 36px;" onclick="viewSectorDamages('${sectorName}')">
          <i class="material-icons tiny">visibility</i>
        </button>
        ${sec.id && sectorLines.length === 0 ? `
          <button type="button" class="btn btn-small btn-flat red-text waves-effect" title="Eliminar sector vacío" style="border-radius: 8px; padding: 0 6px; min-height: 36px;" onclick="deleteSector('${sec.id}', '${sectorName}')">
            <i class="material-icons tiny">delete</i>
          </button>
        ` : ''}
      </div>
    `;

    // Vincular eventos de apertura en lightbox y carga autorizada para cada miniatura del sector
    sectorPhotos.forEach((p, pIdx) => {
      const pId = String(p.id || `${safeId}-${pIdx}`);
      const thumbEl = card.querySelector(`[data-carousel-photo-id="${pId}"]`);
      if (thumbEl) {
        thumbEl.addEventListener('click', async (e) => {
          e.stopPropagation();
          let src = (document.getElementById(`sector-thumb-img-${pId}`)?.src) || photoSource(p) || PHOTO_PLACEHOLDER;
          if (!src || src === PHOTO_PLACEHOLDER) {
            try { src = await getAuthorizedPhotoUrl(p); } catch (_) {}
          }
          openPhotoLightbox(src, sectorName, p.descripcion || `Evidencia fotográfica en ${sectorName}`);
        });
      }

      getAuthorizedPhotoUrl(p).then(authUrl => {
        const img = document.getElementById(`sector-thumb-img-${pId}`);
        const loader = document.getElementById(`sector-loader-${pId}`);
        if (img && authUrl) {
          img.src = authUrl;
          if (loader) loader.style.display = 'none';
          img.style.opacity = '1';
        }
      }).catch(() => {});
    });

    container.appendChild(card);
  });
}

// Modal interactivo para añadir nuevo sector
function promptAddNewSector() {
  const modalEl = document.getElementById('modal-nuevo-sector');
  if (!modalEl) {
    const name = prompt('Ingrese el nombre del nuevo sector (Ej: "Living", "Cocina", "Terraza"):');
    if (name && name.trim()) {
      handleCreateSectorDirect(name.trim());
    }
    return;
  }
  const nameInput = document.getElementById('nuevo-sector-nombre');
  const descInput = document.getElementById('nuevo-sector-descripcion');
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  const instance = M.Modal.getInstance(modalEl);
  if (instance) instance.open();
  M.updateTextFields();
}

async function handleCreateSector(event) {
  event.preventDefault();
  if (!currentCaseId) {
    M.toast({ html: 'Seleccione un expediente primero.', classes: 'red darken-3' });
    return;
  }
  const nameInput = document.getElementById('nuevo-sector-nombre');
  const descInput = document.getElementById('nuevo-sector-descripcion');
  const nombre = nameInput ? nameInput.value.trim().toUpperCase() : '';
  const descripcion = descInput ? descInput.value.trim() : '';

  if (!nombre) {
    M.toast({ html: 'El nombre del sector es requerido.', classes: 'amber darken-3' });
    return;
  }

  try {
    const newSector = await ApiService.createSector(currentCaseId, { nombre, descripcion });
    if (!currentCaseData) currentCaseData = {};
    if (!Array.isArray(currentCaseData.sectors)) currentCaseData.sectors = [];
    currentCaseData.sectors.push(newSector);

    renderInspectionSectors(currentCaseData);
    M.toast({ html: `Sector <b>"${nombre}"</b> registrado en PostgreSQL.`, classes: 'green darken-2' });

    const modal = M.Modal.getInstance(document.getElementById('modal-nuevo-sector'));
    if (modal) modal.close();
  } catch (err) {
    console.error('[handleCreateSector] Error:', err);
    M.toast({ html: 'Error al registrar sector: ' + err.message, classes: 'red darken-3' });
  }
}

async function handleCreateSectorDirect(nombre) {
  if (!currentCaseId || !nombre) return;
  try {
    const newSector = await ApiService.createSector(currentCaseId, { nombre });
    if (!currentCaseData) currentCaseData = {};
    if (!Array.isArray(currentCaseData.sectors)) currentCaseData.sectors = [];
    currentCaseData.sectors.push(newSector);
    renderInspectionSectors(currentCaseData);
    M.toast({ html: `Sector <b>"${nombre}"</b> registrado en PostgreSQL.`, classes: 'green darken-2' });
  } catch (err) {
    M.toast({ html: 'Error al registrar sector: ' + err.message, classes: 'red darken-3' });
  }
}

async function deleteSector(sectorId, sectorName) {
  if (!confirm(`¿Eliminar el sector "${sectorName}" de este expediente?`)) return;
  try {
    await ApiService.deleteSector(currentCaseId, sectorId);
    if (currentCaseData && Array.isArray(currentCaseData.sectors)) {
      currentCaseData.sectors = currentCaseData.sectors.filter(s => s.id !== sectorId);
    }
    renderInspectionSectors(currentCaseData);
    M.toast({ html: `Sector "${sectorName}" eliminado de la base de datos.`, classes: 'green darken-2' });
  } catch (err) {
    M.toast({ html: 'Error al eliminar sector: ' + err.message, classes: 'red darken-3' });
  }
}

// Renderizar la tabla de partidas de daño dentro de la ficha de inspección
function renderInspectionDamages(caseData) {
  const tbody = document.getElementById('inspection-danos-table-body');
  if (!tbody) return;

  const lines = caseData.lines || [];
  const badgeCount = document.getElementById('ficha-badge-danos-count');
  if (badgeCount) badgeCount.textContent = lines.length;

  tbody.innerHTML = '';
  if (lines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="center-align grey-text" style="padding: 24px;">
          No hay partidas registradas en este expediente. Presione <strong>"+ Partida"</strong> para cuantificar los daños.
        </td>
      </tr>
    `;
    return;
  }

  lines.forEach((l, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${idx + 1}</strong></td>
      <td><span class="badge blue lighten-5 blue-text text-darken-4 font-weight-bold" style="border-radius: 4px;">${l.sector || 'GENERAL'}</span></td>
      <td><strong>${l.elemento || '-'}</strong></td>
      <td><span style="color: #b91c1c; font-weight: 600;">${l.dano_tipo || '-'}</span></td>
      <td><small style="color: var(--slate-700);">${l.reparacion_propuesta || l.descripcion_dano || '-'}</small></td>
      <td><code>${l.metodo_calculo || 'direct'}</code></td>
      <td style="text-align: right; font-weight: 700; color: var(--navy-950);">
        ${BudgetViewer.formatQty(l.cantidad_medida || 0)} ${l.unidad_id || 'm²'}
      </td>
      <td class="center-align" style="white-space: nowrap;">
        <button type="button" class="btn-flat waves-effect red-text" title="Eliminar partida" onclick="deleteInspectionDamage('${l.id}')" style="padding: 0 4px;">
          <i class="material-icons tiny">delete</i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderizar las fotos dentro de la ficha de inspección (con streaming real desde el backend)
function renderInspectionPhotos(caseData) {
  const grid = document.getElementById('inspection-photos-gallery-grid');
  const filterChipsContainer = document.getElementById('inspection-photos-filter-chips');
  const totalLabel = document.getElementById('inspection-photos-total-label');
  if (!grid) return;

  const allPhotos = (caseData && caseData.photos) || [];
  const badgeCount = document.getElementById('ficha-badge-fotos-count');
  if (badgeCount) badgeCount.textContent = allPhotos.length;
  if (totalLabel) totalLabel.textContent = `Total: ${allPhotos.length} evidencia${allPhotos.length === 1 ? '' : 's'}`;

  // 1. Renderizar chips de filtro por sector arriba de la galería
  if (filterChipsContainer) {
    filterChipsContainer.innerHTML = '';
    const sectorsMap = new Map();
    allPhotos.forEach(p => {
      const s = (p.sector || 'GENERAL').toUpperCase();
      sectorsMap.set(s, (sectorsMap.get(s) || 0) + 1);
    });

    // Chip "Todas"
    const allChip = document.createElement('span');
    allChip.className = 'gallery-sector-filter-btn' + (activePhotoFilterSector === 'all' ? ' active' : '');
    allChip.innerHTML = `Todas (${allPhotos.length})`;
    allChip.onclick = () => {
      activePhotoFilterSector = 'all';
      renderInspectionPhotos(currentCaseData);
    };
    filterChipsContainer.appendChild(allChip);

    // Chip por cada sector con fotos
    sectorsMap.forEach((count, sName) => {
      const chip = document.createElement('span');
      chip.className = 'gallery-sector-filter-btn' + (activePhotoFilterSector === sName ? ' active' : '');
      chip.innerHTML = `${sName} (${count})`;
      chip.onclick = () => {
        activePhotoFilterSector = sName;
        renderInspectionPhotos(currentCaseData);
      };
      filterChipsContainer.appendChild(chip);
    });
  }

  // 2. Filtrar fotos según sector activo
  const photos = activePhotoFilterSector === 'all' 
    ? allPhotos 
    : allPhotos.filter(p => (p.sector || 'GENERAL').toUpperCase() === activePhotoFilterSector);

  grid.innerHTML = '';
  if (photos.length === 0) {
    grid.innerHTML = `
      <div class="col s12 center-align grey-text" style="padding: 36px 20px; background: #fff; border-radius: 12px; border: 1.5px dashed #cbd5e1; margin: 10px 0;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">add_a_photo</i>
        ${allPhotos.length === 0 
          ? 'No hay fotografías registradas aún en este expediente. Utilice los botones superiores <strong>"Tomar con Cámara"</strong> o <strong>"Cargar de Galería"</strong> para adjuntar evidencias.' 
          : `No hay fotografías asociadas al sector <strong>"${activePhotoFilterSector}"</strong>.`}
      </div>
    `;
    return;
  }

  // 3. Renderizar todas las imágenes almacenadas de las evidencias
  photos.forEach((p, idx) => {
    const col = document.createElement('div');
    col.className = 'col s12 m6 l4';
    col.style.marginBottom = '18px';
    const photoUrl = photoSource(p) || PHOTO_PLACEHOLDER;
    const sectorName = (p.sector || 'GENERAL').toUpperCase();
    const desc = p.descripcion || 'Evidencia pericial de terreno';
    const dateStr = p.created_at || p.fecha || p.fecha_captura;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleString('es-CL') : 'Captura Terreno';

    col.innerHTML = `
      <div class="card" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; transition: transform 0.2s ease;">
        <div class="photo-img-wrapper" title="Haga clic para ampliar a pantalla completa">
          <!-- Spinner de carga individual mientras se transmite la imagen -->
          <div class="photo-card-loader" id="loader-img-${p.id}">
            <div class="preloader-wrapper small active" style="width: 24px; height: 24px;">
              <div class="spinner-layer spinner-amber-only">
                <div class="circle-clipper left"><div class="circle"></div></div>
                <div class="gap-patch"><div class="circle"></div></div>
                <div class="circle-clipper right"><div class="circle"></div></div>
              </div>
            </div>
            <span style="font-size: 0.68rem; color: #94a3b8; font-weight: 600;">Cargando evidencia...</span>
          </div>

          <img id="img-evidence-${p.id}" src="${photoUrl}" alt="Evidencia ${idx + 1}"
               onload="const l = document.getElementById('loader-img-${p.id}'); if(l) l.style.display='none'; this.style.opacity='1';"
               onerror="const l = document.getElementById('loader-img-${p.id}'); if(l) l.style.display='none'; this.style.opacity='1'; this.src='${PHOTO_PLACEHOLDER}';"
               style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.35s ease; cursor: pointer;"
               onclick="const imgEl = document.getElementById('img-evidence-${p.id}'); openPhotoLightbox(imgEl ? imgEl.src : '${photoUrl}', '${sectorName}', '${desc.replace(/'/g, "\\'")}')">
          
          <span style="position: absolute; top: 10px; left: 10px; background: rgba(15, 23, 42, 0.85); color: #fbbf24; font-weight: 800; font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; border: 1px solid rgba(251, 191, 36, 0.4); display: inline-flex; align-items: center; gap: 4px; z-index: 3;">
            <i class="material-icons tiny" style="font-size: 14px;">meeting_room</i> ${sectorName}
          </span>

          <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; z-index: 3; cursor: pointer;" onclick="const imgEl = document.getElementById('img-evidence-${p.id}'); openPhotoLightbox(imgEl ? imgEl.src : '${photoUrl}', '${sectorName}', '${desc.replace(/'/g, "\\'")}')">
            <i class="material-icons tiny">zoom_in</i>
          </span>
        </div>
        
        <div class="card-content" style="padding: 12px 14px; font-size: 0.82rem; min-height: 72px;">
          <p style="margin: 0; color: #1e293b; font-weight: 600; line-height: 1.35;">${desc}</p>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
            <i class="material-icons tiny" style="font-size: 14px;">schedule</i> ${formattedDate}
          </div>
        </div>

        <div class="card-action" style="padding: 8px 12px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-flat waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; color: #2563eb; display: inline-flex; align-items: center; gap: 3px;" onclick="const imgEl = document.getElementById('img-evidence-${p.id}'); openPhotoLightbox(imgEl ? imgEl.src : '${photoUrl}', '${sectorName}', '${desc.replace(/'/g, "\\'")}')" title="Ver imagen en tamaño completo">
              <i class="material-icons tiny">fullscreen</i> Ver foto
            </button>
            <button type="button" class="btn-flat waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; color: #7c3aed; display: inline-flex; align-items: center; gap: 3px;" onclick="openPhotoTimeline('${p.id}')" title="Ver historial y línea de tiempo">
              <i class="material-icons tiny">history</i> Historial
            </button>
          </div>
          <button type="button" class="btn-flat red-text text-darken-2 waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; display: inline-flex; align-items: center; gap: 3px;" onclick="removePhoto('${p.id}')" title="Eliminar evidencia">
            <i class="material-icons tiny">delete</i> Eliminar
          </button>
        </div>
      </div>
    `;
    grid.appendChild(col);

    // Cargar imagen de forma autorizada mediante Blob
    getAuthorizedPhotoUrl(p).then((authUrl) => {
      const img = document.getElementById(`img-evidence-${p.id}`);
      if (img && authUrl) {
        img.src = authUrl;
        const loader = document.getElementById(`loader-img-${p.id}`);
        if (loader) loader.style.display = 'none';
        img.style.opacity = '1';
      }
    }).catch(() => {});
  });
}
// Actualizar las métricas del resumen de inspección
function updateInspectionSummaryCards(caseData) {
  const lines = caseData.lines || [];
  const photos = caseData.photos || [];
  const dbSectors = caseData.sectors || [];
  const sectorNames = new Set(dbSectors.map(s => s.nombre.toUpperCase()));
  lines.forEach(l => { if (l.sector) sectorNames.add(l.sector.toUpperCase()); });

  let totalMetraje = 0;
  lines.forEach(l => { totalMetraje += parseFloat(l.cantidad_medida || 0); });

  const elSectores = document.getElementById('resumen-kpi-sectores');
  const elPartidas = document.getElementById('resumen-kpi-partidas');
  const elFotos = document.getElementById('resumen-kpi-fotos');
  const elMetraje = document.getElementById('resumen-kpi-metraje');

  if (elSectores) elSectores.textContent = sectorNames.size;
  if (elPartidas) elPartidas.textContent = lines.length;
  if (elFotos) elFotos.textContent = photos.length;
  if (elMetraje) elMetraje.textContent = `${totalMetraje.toFixed(2)} m²`;
}

// Abrir modal de partida desde la ficha de inspección
function openAddDamageModalFromInspection() {
  resetPartidaModal();
  const sectorSelect = document.getElementById('partida-sector');
  if (sectorSelect) {
    const sectors = new Set(SECTOR_CATALOG);
    if (currentCaseData && Array.isArray(currentCaseData.sectors)) {
      currentCaseData.sectors.forEach(s => sectors.add(s.nombre.toUpperCase()));
    }
    sectorSelect.innerHTML = Array.from(sectors).map(s => `<option value="${s}">${s}</option>`).join('');
    M.FormSelect.init(sectorSelect);
  }
  const modalEl = document.getElementById('modal-nuevo-dano');
  if (modalEl) {
    const inst = M.Modal.getInstance(modalEl);
    if (inst) inst.open();
  }
}

// Abrir modal de partida preseleccionando un sector
function openAddDamageModalWithSector(sectorName) {
  openAddDamageModalFromInspection();
  const sectorSelect = document.getElementById('partida-sector');
  if (sectorSelect) {
    sectorSelect.value = sectorName;
    M.FormSelect.init(sectorSelect);
  }
}

// Abrir modal de partida desde el listado de casos
function openAddDamageModalFromCase(caseId) {
  openCaseInspectionSheet(caseId, 'subtab-danos').then(() => {
    openAddDamageModalFromInspection();
  });
}

// Abrir pestaña de fotos desde el listado de casos
function openPhotosFromCase(caseId) {
  openCaseInspectionSheet(caseId, 'subtab-fotos');
}

// Ver daños de un sector específico
function viewSectorDamages(sectorName) {
  switchInspectionSubTab('subtab-danos');
  M.toast({ html: `Filtrando daños del sector: <b>${sectorName}</b>`, classes: 'blue-grey darken-3' });
}

// Guardar observaciones técnicas de la inspección en PostgreSQL
async function saveInspectionObservations() {
  const obsArea = document.getElementById('inspection-observaciones-text');
  const text = obsArea ? obsArea.value : '';

  if (!currentCaseId) {
    M.toast({ html: 'No hay expediente seleccionado.', classes: 'red darken-3' });
    return;
  }

  try {
    await ApiService.saveObservations(currentCaseId, text);
    if (currentCaseData && currentCaseData.expediente) {
      currentCaseData.expediente.observaciones_generales = text;
    }
    M.toast({
      html: '<i class="material-icons left">check_circle</i>Observaciones técnicas guardadas en base de datos.',
      classes: 'green darken-2'
    });
  } catch (err) {
    console.error('[saveInspectionObservations] Error:', err);
    M.toast({ html: 'Error al guardar observaciones: ' + err.message, classes: 'red darken-3' });
  }
}

// Completar la inspección técnica en terreno en PostgreSQL
async function finalizeCaseInspection() {
  const confirmResult = await LorensAlert.confirm(
    '¿Finalizar inspección de terreno?',
    '¿Confirma que ha completado la visita técnica presencial y la cuantificación pericial de este expediente?',
    'Sí, finalizar inspección'
  );
  if (!confirmResult.isConfirmed) return;
  if (!currentCaseId) return;

  try {
    await ApiService.finalizeInspection(currentCaseId);
    if (currentCaseData && currentCaseData.expediente) {
      currentCaseData.expediente.estado = 'procesado';
      currentCaseData.expediente.avance_porcentaje = 100;
    }

    await LorensAlert.success(
      'Inspección finalizada',
      '¡Inspección de terreno completada y enviada a liquidación oficial!'
    );

    await loadAssignedCases(1);
    await loadInspectorDashboard();
    backToInspectorHome();
  } catch (err) {
    console.error('[finalizeCaseInspection] Error:', err);
    LorensAlert.error('Error al finalizar inspección', err.message);
  }
}

// Eliminar partida de daño de la inspección en PostgreSQL
async function deleteInspectionDamage(lineId) {
  const confirmResult = await LorensAlert.confirm(
    '¿Eliminar partida de daño?',
    '¿Confirma que desea eliminar esta partida cuantificada en terreno?',
    'Sí, eliminar partida'
  );
  if (!confirmResult.isConfirmed) return;

  try {
    await ApiService.deleteLine(lineId);
    if (currentCaseData && Array.isArray(currentCaseData.lines)) {
      currentCaseData.lines = currentCaseData.lines.filter(l => l.id !== lineId);
    }
    renderInspectionDamages(currentCaseData);
    renderInspectionSectors(currentCaseData);
    updateInspectionSummaryCards(currentCaseData);
    LorensAlert.success('Partida eliminada', 'La partida fue removida de la base de datos.');
  } catch (err) {
    console.error('[deleteInspectionDamage] Error:', err);
    LorensAlert.error('Error al eliminar partida', err.message);
  }
}

// Exponer en window para eventos HTML
window.triggerDirectCameraCapture = triggerDirectCameraCapture;
window.triggerDirectGalleryCapture = triggerDirectGalleryCapture;
window.selectPhotoSector = selectPhotoSector;
window.promptQuickNewSectorFromPhoto = promptQuickNewSectorFromPhoto;
window.renderModalStoredPhotos = renderModalStoredPhotos;
window.showInspectorHome = showInspectorHome;
window.loadInspectorDashboard = loadInspectorDashboard;
window.loadAssignedCases = loadAssignedCases;
window.openInspectorCase = openInspectorCase;
window.renderInspectorCase = renderInspectorCase;
window.showInspectorCaseSection = showInspectorCaseSection;
window.backToInspectorHome = backToInspectorHome;
window.getInspectorAssignedCasesList = getInspectorAssignedCasesList;
window.loadInspectorAssignedCases = loadInspectorAssignedCases;
window.renderInspectorCasesDataTable = renderInspectorCasesDataTable;
window.renderInspectorCasesMobileCards = renderInspectorCasesMobileCards;
window.renderInspectorCasesPagination = renderInspectorCasesPagination;
window.filterInspectorCasesTable = filterInspectorCasesTable;
window.filterInspectorCasesByStatus = filterInspectorCasesByStatus;
window.openCaseInspectionSheet = openCaseInspectionSheet;
window.switchInspectionSubTab = switchInspectionSubTab;
window.renderInspectionSectors = renderInspectionSectors;
window.promptAddNewSector = promptAddNewSector;
window.handleCreateSector = handleCreateSector;
window.deleteSector = deleteSector;
window.renderInspectionDamages = renderInspectionDamages;
window.renderInspectionPhotos = renderInspectionPhotos;
window.openPhotoUploadModal = openPhotoUploadModal;
window.openPhotoCaptureModal = openPhotoCaptureModal;
window.openAddDamageModalFromInspection = openAddDamageModalFromInspection;
window.openAddDamageModalWithSector = openAddDamageModalWithSector;
window.openAddDamageModalFromCase = openAddDamageModalFromCase;
window.openPhotosFromCase = openPhotosFromCase;
window.viewSectorDamages = viewSectorDamages;
window.saveInspectionObservations = saveInspectionObservations;
window.finalizeCaseInspection = finalizeCaseInspection;
window.deleteInspectionDamage = deleteInspectionDamage;

window.quickActionVerExpedientes = quickActionVerExpedientes;
window.quickActionContinuarInspeccion = quickActionContinuarInspeccion;
window.quickActionRegistrarDano = quickActionRegistrarDano;
window.quickActionAdjuntarFotos = quickActionAdjuntarFotos;
window.quickActionConsultarSectores = quickActionConsultarSectores;
window.sortInspectorCasesBy = sortInspectorCasesBy;
window.filterInspectorCasesByDate = filterInspectorCasesByDate;
window.resetInspectorCaseDateFilter = resetInspectorCaseDateFilter;
window.openInspectorCaseAndAddDamage = openInspectorCaseAndAddDamage;

window.showPageLoading = showPageLoading;
window.hidePageLoading = hidePageLoading;
window.controlMenuFocus = controlMenuFocus;


// ==============================================================
// GESTIÓN DEL TIMELINE CRONOLÓGICO DE CADA EVIDENCIA FOTOGRÁFICA
// ==============================================================
async function openPhotoTimeline(photoId) {
  if (!currentCaseId || !photoId) return;

  const modalEl = document.getElementById('modal-foto-timeline');
  if (!modalEl) return;

  const spinner = document.getElementById('timeline-loading-spinner');
  const container = document.getElementById('timeline-events-container');
  const thumbImg = document.getElementById('timeline-thumb-img');
  const sectorEl = document.getElementById('timeline-foto-sector');
  const nombreEl = document.getElementById('timeline-foto-nombre');

  if (spinner) spinner.style.display = 'block';
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }

  const inst = M.Modal.getInstance(modalEl);
  if (inst) inst.open();

  try {
    const data = await ApiService.getPhotoTimeline(currentCaseId, photoId);
    const photo = data.fotografia || {};
    const eventos = data.eventos || [];

    if (sectorEl) sectorEl.textContent = (photo.sector || 'GENERAL').toUpperCase();
    if (nombreEl) nombreEl.textContent = photo.nombre_original || 'evidencia.jpg';

    // Obtener miniatura autorizada para el modal de timeline
    if (thumbImg) {
      thumbImg.src = await getAuthorizedPhotoUrl(photo);
    }

    if (container) {
      if (eventos.length === 0) {
        container.innerHTML = '<p class="grey-text center-align" style="padding: 20px;">No se registran eventos de auditoría para esta fotografía.</p>';
      } else {
        eventos.forEach(ev => {
          let badgeColor = 'blue';
          let badgeIcon = 'info';

          switch (ev.tipo_evento) {
            case 'FOTO_REGISTRADA':
              badgeColor = 'blue';
              badgeIcon = 'camera_alt';
              break;
            case 'ARCHIVO_ALMACENADO':
              badgeColor = 'green';
              badgeIcon = 'save';
              break;
            case 'SECTOR_ASOCIADO':
              badgeColor = 'amber';
              badgeIcon = 'meeting_room';
              break;
            case 'DANO_VINCULADO':
              badgeColor = 'amber';
              badgeIcon = 'construction';
              break;
            case 'EVIDENCIA_REVISADA':
              badgeColor = 'green';
              badgeIcon = 'verified';
              break;
            case 'DESCRIPCION_ACTUALIZADA':
              badgeColor = 'grey';
              badgeIcon = 'edit';
              break;
            default:
              badgeColor = 'grey';
              badgeIcon = 'circle';
          }

          const evDate = new Date(ev.created_at);
          const formattedDate = evDate.toLocaleDateString('es-CL');
          const formattedTime = evDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const item = document.createElement('div');
          item.className = 'timeline-event-item';
          item.innerHTML = `
            <div class="timeline-event-badge ${badgeColor}">
              <i class="material-icons" style="font-size: 11px;">${badgeIcon}</i>
            </div>
            <div class="timeline-event-content">
              <div class="timeline-event-header">
                <span class="timeline-event-title">
                  ${ev.tipo_evento.replace(/_/g, ' ')}
                </span>
                <span class="timeline-event-time">
                  ${formattedDate} · ${formattedTime}
                </span>
              </div>
              <p class="timeline-event-desc">${ev.descripcion}</p>
              <div class="timeline-event-user">
                <i class="material-icons tiny" style="font-size: 13px;">person</i>
                <span>${ev.usuario_nombre} (${ev.usuario_rol})</span>
              </div>
            </div>
          `;
          container.appendChild(item);
        });
      }
      container.style.display = 'block';
    }
  } catch (err) {
    console.error('[openPhotoTimeline] Error:', err);
    if (container) {
      container.innerHTML = `<p class="red-text center-align" style="padding: 20px;">Error al cargar historial: ${err.message}</p>`;
      container.style.display = 'block';
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

window.LorensAlert = LorensAlert;
window.openPhotoTimeline = openPhotoTimeline;
window.getAuthorizedPhotoUrl = getAuthorizedPhotoUrl;


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
      `Si el correo "${email}" se encuentra registrado como titular de un expediente en Lorens, recibirá un enlace con instrucciones y su token temporal de acceso.`
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
        `Bienvenido al Portal del Cliente, ${res.user.nombre}.`
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

  const breadcrumbCurrent = document.getElementById('app-breadcrumbs-current');

  if (viewName === 'tracking') {
    if (dashView) dashView.style.display = 'none';
    if (trackView) trackView.style.display = 'block';
    if (linkTrack) linkTrack.classList.add('active');
    const trackItem = document.getElementById('sidebar-item-client-tracking');
    if (trackItem) trackItem.style.display = '';
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Portal del Cliente · Seguimiento';
  } else {
    if (dashView) dashView.style.display = 'block';
    if (trackView) trackView.style.display = 'none';
    if (viewName === 'cases') {
      if (linkCases) linkCases.classList.add('active');
      const tableCard = document.querySelector('#client-view-dashboard .card');
      if (tableCard) tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Portal del Cliente · Mis Expedientes';
    } else {
      if (linkDash) linkDash.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Portal del Cliente · Dashboard';
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
      container.innerHTML = `<div class="card-panel red lighten-5 red-text text-darken-3 center-align">
        <i class="material-icons medium" style="margin-bottom: 8px;">error_outline</i>
        <div style="font-weight: 700;">Error al cargar sus expedientes</div>
        <div style="font-size: 0.85rem;">${err.message || 'Compruebe su conexión o intente nuevamente.'}</div>
        <button class="btn btn-small blue darken-1" style="margin-top: 12px; border-radius: 6px;" onclick="loadClientPortalData()">Reintentar</button>
      </div>`;
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
    container.innerHTML = `
      <div class="center-align grey-text" style="padding: 40px 20px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_open</i>
        <div style="font-size: 1rem; font-weight: 700; color: #475569;">No registra expedientes asignados</div>
        <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #94a3b8;">
          Si contrató una póliza y declaró un siniestro, contacte a su compañía aseguradora para verificar la vinculación.
        </p>
      </div>
    `;
    container.style.display = 'block';
    return;
  }

  // Vista Tabla para pantallas medianas y grandes + Tarjetas para móvil
  let html = `
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
  `;

  cases.forEach(c => {
    const avance = c.avance_porcentaje || 0;
    const fecha = c.fecha_evento || c.created_at;
    const formattedDate = fecha ? new Date(fecha).toLocaleDateString('es-CL') : '-';
    const etapaPillClass = c.timeline_habilitado ? 'completada' : 'observada';

    html += `
      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
        <td style="padding: 12px 14px; font-weight: 800; color: #0284c7;">${c.codigo}</td>
        <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">${c.numero_siniestro || '-'}</td>
        <td style="padding: 12px 14px; color: #334155;">${c.tipo_evento || 'Sismo'}</td>
        <td style="padding: 12px 14px; color: #334155;">${c.direccion || '-'}, ${c.comuna || ''}</td>
        <td style="padding: 12px 14px; color: #64748b; font-size: 0.8rem;">${formattedDate}</td>
        <td style="padding: 12px 14px;">
          <span class="client-stage-status-pill ${etapaPillClass}" style="display: inline-block;">
            ${c.etapa_nombre || 'En trámite'}
          </span>
        </td>
        <td style="padding: 12px 14px; min-width: 110px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${avance}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #0284c7;">${avance}%</span>
          </div>
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <button type="button" class="btn btn-small waves-effect waves-light" style="background: #0284c7; border-radius: 6px; font-weight: 700; text-transform: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;" onclick="openClientCaseTracking('${c.id}')">
            <i class="material-icons tiny">timeline</i> Consultar seguimiento
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;

  // Tarjetas para móviles
  html += `<div class="hide-on-med-and-up">`;
  cases.forEach(c => {
    const avance = c.avance_porcentaje || 0;
    const fecha = c.fecha_evento || c.created_at;
    const formattedDate = fecha ? new Date(fecha).toLocaleDateString('es-CL') : '-';
    const etapaPillClass = c.timeline_habilitado ? 'completada' : 'observada';

    html += `
      <div class="card" style="border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04); margin-bottom: 14px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">EXPEDIENTE</span>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0284c7;">${c.codigo}</div>
          </div>
          <span class="client-stage-status-pill ${etapaPillClass}">${c.etapa_nombre || 'En trámite'}</span>
        </div>

        <div style="font-size: 0.8rem; color: #334155; margin-bottom: 6px;">
          <strong>Siniestro:</strong> ${c.numero_siniestro || '-'} · <strong>Tipo:</strong> ${c.tipo_evento || 'Sismo'}
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 10px;">
          <i class="material-icons tiny" style="vertical-align: middle;">place</i> ${c.direccion}, ${c.comuna}
        </div>

        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">
            <span>Avance del Proceso</span>
            <span style="color: #0284c7;">${avance}%</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${avance}%; height: 100%; background: #0284c7; border-radius: 4px;"></div>
          </div>
        </div>

        <button type="button" class="btn waves-effect waves-light" style="width: 100%; background: #0284c7; border-radius: 8px; font-weight: 700; text-transform: none; font-size: 0.85rem;" onclick="openClientCaseTracking('${c.id}')">
          <i class="material-icons left tiny">timeline</i> Consultar seguimiento
        </button>
      </div>
    `;
  });
  html += `</div>`;

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
    if (dirEl) dirEl.textContent = `${caseData.direccion}, ${caseData.comuna || ''}`;
    if (avanceEl) avanceEl.textContent = `${caseData.avance_porcentaje || 0}%`;
    if (siniestroEl) siniestroEl.textContent = caseData.numero_siniestro || 'Sin N° registrado';
    if (polizaEl) polizaEl.textContent = caseData.numero_poliza || 'Póliza Hogar Estándar';
    if (eventoEl) eventoEl.textContent = caseData.tipo_evento || 'Sismo';
    if (aseguradoraEl) aseguradoraEl.textContent = caseData.aseguradora || 'ASESORÍAS LORENS';
    if (fechaEvEl) fechaEvEl.textContent = caseData.fecha_evento ? new Date(caseData.fecha_evento).toLocaleDateString('es-CL') : 'No informada';
    if (fechaVisEl) fechaVisEl.textContent = caseData.fecha_visita ? new Date(caseData.fecha_visita).toLocaleDateString('es-CL') : 'Coordinada en terreno';
    if (etapaActEl) etapaActEl.textContent = caseData.etapa_nombre || 'En Proceso';

    if (badgeEl) {
      badgeEl.textContent = `EXPEDIENTE ${(caseData.estado || 'ACTIVO').toUpperCase()}`;
    }

    if (estadoPill) {
      estadoPill.textContent = (caseData.estado || 'Activo').toUpperCase();
      estadoPill.className = `client-stage-status-pill ${caseData.estado === 'procesado' ? 'completada' : 'en_curso'}`;
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
      fechasHtml = `<span><i class="material-icons tiny" style="vertical-align: middle;">event</i> ${fechaIni} al ${fechaFin}</span>`;
    } else if (fechaIni) {
      fechasHtml = `<span><i class="material-icons tiny" style="vertical-align: middle;">play_circle</i> Iniciada el ${fechaIni}</span>`;
    } else {
      fechasHtml = `<span><i class="material-icons tiny" style="vertical-align: middle;">hourglass_empty</i> Pendiente de inicio</span>`;
    }

    const node = document.createElement('div');
    node.className = 'client-stage-node';
    node.innerHTML = `
      <div class="client-stage-icon-badge ${etapa.estado}">
        <i class="material-icons" style="font-size: 18px;">${iconName}</i>
      </div>
      <div class="client-stage-card-box ${etapa.es_etapa_actual ? 'active-stage' : ''}" onclick="showStageDetailDialog('${etapa.nombre}', '${etapa.estado}', '${fechasHtml.replace(/'/g, "\'")}', '${(etapa.descripcion_publica || '').replace(/'/g, "\'")}', '${(etapa.responsable || '').replace(/'/g, "\'")}')">
        <div class="client-stage-topbar">
          <div class="client-stage-title">
            ${etapa.orden}. ${etapa.nombre}
            ${etapa.es_etapa_actual ? '<span style="font-size: 0.68rem; background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">ETAPA ACTUAL</span>' : ''}
          </div>
          <span class="client-stage-status-pill ${etapa.estado}">${etapa.estado.replace(/_/g, ' ')}</span>
        </div>
        <div class="client-stage-dates">
          ${fechasHtml}
        </div>
        <p class="client-stage-desc">${etapa.descripcion_publica}</p>
        <div class="client-stage-footer">
          <span><i class="material-icons tiny" style="vertical-align: middle;">verified</i> ${etapa.responsable}</span>
          <span class="blue-text text-darken-2" style="font-weight: 700; cursor: pointer;">Ver detalles →</span>
        </div>
      </div>
    `;
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
    html: `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.5; color: #334155; margin-top: 10px;">
        <p><strong>Estado oficial:</strong> <span class="client-stage-status-pill ${estado}">${estado.toUpperCase()}</span></p>
        <p><strong>Descripción:</strong> ${desc}</p>
        <p><strong>Responsable:</strong> ${responsable}</p>
      </div>
    `,
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
    if (countBadge) countBadge.textContent = `${photos.length} fotografías`;

    if (!photos || photos.length === 0) {
      if (grid) {
        grid.innerHTML = `
          <div class="col s12 center-align grey-text" style="padding: 30px 10px;">
            <i class="material-icons medium" style="color: #cbd5e1; display: block; margin-bottom: 6px;">no_photography</i>
            <div style="font-size: 0.88rem; font-weight: 600; color: #64748b;">No hay fotografías publicadas aún para este expediente.</div>
            <p style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0 0 0;">
              Las evidencias periciales autorizadas se mostrarán aquí una vez completada la revisión técnica.
            </p>
          </div>
        `;
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

      col.innerHTML = `
        <div class="client-evidence-card">
          <div class="client-evidence-media" onclick="openClientPhotoLightbox('${caseId}', '${photoId}', '${sector}', '${desc.replace(/'/g, "\'")}')">
            <img id="client-img-${photoId}" src="${PHOTO_PLACEHOLDER}" alt="Evidencia ${idx + 1}" loading="lazy">
            <span class="client-evidence-sector-tag">
              <i class="material-icons tiny">meeting_room</i> ${sector}
            </span>
            <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              <i class="material-icons tiny">zoom_in</i>
            </span>
          </div>
          <div class="client-evidence-body">
            <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 0.82rem; line-height: 1.35;">${desc}</p>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
              <i class="material-icons tiny" style="font-size: 14px;">calendar_today</i> ${formattedDate}
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);

      // Cargar imagen de forma autorizada con token
      ApiService.fetchClientPhotoBlob(caseId, photoId)
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const imgEl = document.getElementById(`client-img-${photoId}`);
          if (imgEl) imgEl.src = blobUrl;
        })
        .catch(() => {
          const token = ApiService.getToken();
          const imgEl = document.getElementById(`client-img-${photoId}`);
          if (imgEl && token) {
            imgEl.src = `/api/client/cases/${caseId}/photos/${photoId}/file?token=${encodeURIComponent(token)}`;
          }
        });
    });
  } catch (err) {
    console.error('[LOAD CLIENT EVIDENCE ERROR]', err);
    if (grid) {
      grid.innerHTML = `<div class="col s12 red-text center-align" style="padding: 20px;">Error al cargar fotografías autorizadas: ${err.message}</div>`;
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
    photoUrl = `/api/client/cases/${caseId}/photos/${photoId}/file?token=${encodeURIComponent(token)}`;
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

// ==============================================================
// MÓDULO EXCLUSIVO DEL AJUSTADOR (CUANTIFICACIÓN Y PRESUPUESTOS)
// Basado en EJEMPLO PRESUPUESTO INSPECCION SISMO.xlsx
// ==============================================================

let currentAdjusterCase = null;
let currentAdjusterCaseId = null;
let currentAdjusterBudget = null;
let currentAdjusterItems = [];
let currentAdjusterInspectorDamages = [];
let adjusterCatalogProcesses = [];
let adjusterCasesList = [];

// Cambiar vistas internas del ajustador
window.switchAdjusterView = function(viewName) {
  const homeSec = document.getElementById('adjuster-home');
  const cuantiSec = document.getElementById('adjuster-cuantificacion-view');
  const navDash = document.getElementById('sidebar-item-adjuster-dashboard');
  const navCases = document.getElementById('sidebar-item-adjuster-cases');
  const navCuanti = document.getElementById('sidebar-item-adjuster-cuantificacion');

  document.querySelectorAll('#sidebar-menu-list .sidebar-menu-link').forEach(a => a.classList.remove('active'));

  if (viewName === 'dashboard' || viewName === 'cases') {
    if (homeSec) homeSec.style.display = 'block';
    if (cuantiSec) cuantiSec.style.display = 'none';
    const activeLink = (viewName === 'dashboard' ? navDash : navCases)?.querySelector('a');
    if (activeLink) activeLink.classList.add('active');
    loadAdjusterDashboard();
  } else if (viewName === 'cuantificacion') {
    if (!currentAdjusterCaseId) {
      Swal.fire({
        icon: 'info',
        title: 'Seleccione un Expediente',
        text: 'Por favor seleccione un caso de la lista para cuantificar.',
        confirmButtonColor: '#059669'
      });
      switchAdjusterView('cases');
      return;
    }
    if (homeSec) homeSec.style.display = 'none';
    if (cuantiSec) cuantiSec.style.display = 'block';
    const activeLink = navCuanti?.querySelector('a');
    if (activeLink) activeLink.classList.add('active');
  }
};

// Cargar indicadores dinámicos (6 KPIs) y listado de casos del Ajustador
window.loadAdjusterDashboard = async function() {
  try {
    const data = await ApiService.getAdjusterDashboard();
    if (!data) return;

    // Actualizar nombre
    const userNameEl = document.getElementById('adjuster-hero-user-name');
    if (userNameEl) {
      userNameEl.textContent = (data.ajustador && data.ajustador.nombre) || (currentUser && currentUser.nombre) || 'Ajustador';
    }

    // 6 KPIs dinámicos
    const k = data.kpis || {};
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(val || 0).toLocaleString('es-CL');
    };
    setVal('adjuster-kpi-asignados', k.expedientes_asignados);
    setVal('adjuster-kpi-pendientes', k.pendientes_cuantificacion);
    setVal('adjuster-kpi-en-cuantificacion', k.en_cuantificacion);
    setVal('adjuster-kpi-terminados', k.presupuestos_terminados);
    setVal('adjuster-kpi-partidas', k.partidas_valorizadas);
    setVal('adjuster-kpi-observados', k.presupuestos_observados);

    // Cargar casos en el DataTable
    await loadAdjusterCases();
  } catch (err) {
    console.error('[LOAD ADJUSTER DASHBOARD ERROR]', err);
    Swal.fire({
      icon: 'error',
      title: 'Error de Conexión',
      text: 'No fue posible cargar las métricas del ajustador desde PostgreSQL: ' + err.message,
      confirmButtonColor: '#059669'
    });
  }
};

// Cargar DataTable de expedientes asignados
window.loadAdjusterCases = async function() {
  const loader = document.getElementById('adjuster-cases-loading');
  const table = document.getElementById('adjuster-cases-table');
  const tbody = document.getElementById('adjuster-cases-tbody');
  const filterStatus = document.getElementById('adjuster-filter-status')?.value || '';
  const searchQ = document.getElementById('adjuster-search-input')?.value || '';

  if (loader) loader.style.display = 'block';
  if (table) table.style.display = 'none';

  try {
    const res = await ApiService.getAdjusterCases({ estado: filterStatus, q: searchQ });
    adjusterCasesList = res?.data || [];

    if (!tbody) return;
    tbody.innerHTML = '';

    if (adjusterCasesList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="center-align grey-text" style="padding: 30px;">
            <i class="material-icons" style="font-size: 2.2rem; color: #94a3b8; display: block; margin-bottom: 6px;">folder_open</i>
            No se encontraron expedientes asignados para los filtros seleccionados.
          </td>
        </tr>
      `;
    } else {
      adjusterCasesList.forEach(c => {
        const tr = document.createElement('tr');
        
        // Formatear badge de estado del presupuesto
        let estadoBadge = '';
        switch(c.estado_presupuesto) {
          case 'aprobado':
            estadoBadge = '<span class="badge-tag green lighten-4 green-text text-darken-4">Aprobado</span>';
            break;
          case 'enviado_revision':
            estadoBadge = '<span class="badge-tag blue lighten-4 blue-text text-darken-4">En Revisión</span>';
            break;
          case 'observado':
            estadoBadge = '<span class="badge-tag amber lighten-4 brown-text text-darken-4">Observado</span>';
            break;
          case 'en_cuantificacion':
            estadoBadge = '<span class="badge-tag teal lighten-4 teal-text text-darken-4">En Cuantificación</span>';
            break;
          default:
            estadoBadge = '<span class="badge-tag grey lighten-3 grey-text text-darken-3">Pendiente</span>';
        }

        // Formatear estado levantamiento
        const levantamientoBadge = (c.estado_caso === 'visita_completada' || c.estado_levantamiento === 'visita_completada' || c.estado_caso === 'cuantificacion' || c.estado_caso === 'cerrado')
          ? '<span class="badge-tag green lighten-5 green-text text-darken-3">Completado</span>'
          : '<span class="badge-tag amber lighten-5 amber-text text-darken-4">En Curso</span>';

        tr.innerHTML = `
          <td><strong style="color: #059669;">${c.expediente_codigo || c.codigo}</strong></td>
          <td><strong>${c.cliente_nombre || '-'}</strong></td>
          <td>${c.direccion || '-'}</td>
          <td>${c.tipo_siniestro || c.tipo_evento || '-'}</td>
          <td>${c.inspector_nombre || '<span class="grey-text">Sin asignar</span>'}</td>
          <td class="center-align"><strong>${c.total_sectores || 0}</strong></td>
          <td class="center-align"><strong>${c.total_danos || 0}</strong></td>
          <td class="center-align">${levantamientoBadge}</td>
          <td class="center-align">${estadoBadge}</td>
          <td class="center-align">
            <button type="button" class="btn-small waves-effect" 
                    style="background: #059669; border-radius: 6px; font-weight: 700; text-transform: none; display: inline-flex; align-items: center; gap: 4px;" 
                    onclick="openAdjusterCuantificacion('${c.id}')">
              <i class="material-icons tiny">calculate</i> Cuantificar
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    if (loader) loader.style.display = 'none';
    if (table) table.style.display = 'table';
  } catch (err) {
    console.error('[LOAD ADJUSTER CASES ERROR]', err);
    if (loader) loader.style.display = 'none';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="red-text center-align" style="padding: 20px;">Error al cargar expedientes: ${err.message}</td></tr>`;
    }
  }
};

window.handleAdjusterSearch = debounce(function(val) {
  loadAdjusterCases();
}, 300);

// Abrir Ficha de Cuantificación para un caso específico
window.openAdjusterCuantificacion = async function(caseId) {
  try {
    const res = await ApiService.getAdjusterCase(caseId);
    if (!res || !res.case) {
      throw new Error('No se recibieron datos del expediente.');
    }

    currentAdjusterCase = res.case;
    currentAdjusterCaseId = caseId;
    currentAdjusterBudget = res.budget;
    currentAdjusterItems = res.items || [];
    currentAdjusterInspectorDamages = res.inspector_damages || [];

    // 1. Llenar Encabezado del Presupuesto (según Excel)
    const c = currentAdjusterCase;
    const b = currentAdjusterBudget || {};
    const setT = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };

    setT('adj-header-liquidador', c.liquidador_compania || c.liquidador_nombre || 'Asesorías Lorens');
    setT('adj-header-caso', c.codigo || c.expediente_codigo);
    setT('adj-header-cliente', c.cliente_nombre);
    setT('adj-header-rut', c.cliente_rut);
    setT('adj-header-email', c.cliente_email);
    setT('adj-header-telefono', c.cliente_telefono);
    setT('adj-header-direccion', c.direccion);
    setT('adj-header-comuna', `${c.comuna || ''} ${c.region || ''}`);
    setT('adj-header-fecha-evento', c.fecha_siniestro ? new Date(c.fecha_siniestro).toLocaleDateString('es-CL') : '-');
    setT('adj-header-fecha-inspeccion', (c.fecha_inspeccion || c.fecha_visita) ? new Date(c.fecha_inspeccion || c.fecha_visita).toLocaleDateString('es-CL') : '-');
    setT('adj-header-tipo-siniestro', c.tipo_evento || c.tipo_siniestro);
    setT('adj-header-inspector', c.inspector_nombre || 'Inspector Oficial');
    setT('adj-header-ajustador', (b.ajustador_nombre || c.ajustador_nombre || (currentUser && currentUser.nombre) || 'Carlos Mendoza (Ajustador)'));

    // Badge de estado presupuesto
    const statusBadge = document.getElementById('adjuster-badge-presupuesto-estado');
    if (statusBadge) {
      statusBadge.textContent = (b.estado || 'en_cuantificacion').replace(/_/g, ' ').toUpperCase();
    }

    // Alerta de observaciones del Administrador
    const obsAlert = document.getElementById('adjuster-observation-alert');
    const obsText = document.getElementById('adjuster-observation-text');
    if (b.estado === 'observado' && b.observaciones_supervisor) {
      if (obsAlert) obsAlert.style.display = 'block';
      if (obsText) obsText.textContent = b.observaciones_supervisor;
    } else {
      if (obsAlert) obsAlert.style.display = 'none';
    }

    // 2. Renderizar ZONA A: Levantamiento Inspector (Solo Lectura)
    renderAdjusterZoneA(currentAdjusterInspectorDamages);

    // 3. Renderizar ZONA B: Partidas del Ajustador
    renderAdjusterZoneB(currentAdjusterItems);

    // 4. Renderizar ZONA C: Resumen Financiero
    recalculateAdjusterTotals();

    // Habilitar enlace de cuantificación en el sidebar
    const navCuanti = document.getElementById('sidebar-item-adjuster-cuantificacion');
    if (navCuanti) navCuanti.style.display = '';

    // Cambiar a la vista de cuantificación
    switchAdjusterView('cuantificacion');
  } catch (err) {
    console.error('[OPEN ADJUSTER CUANTIFICACION ERROR]', err);
    Swal.fire({
      icon: 'error',
      title: 'Error al abrir cuantificación',
      text: err.message || 'No fue posible recuperar los datos del expediente.',
      confirmButtonColor: '#059669'
    });
  }
};

// Renderizar ZONA A: Levantamiento Inspector (Solo Lectura)
function renderAdjusterZoneA(damages) {
  const container = document.getElementById('adjuster-inspector-damages-list');
  if (!container) return;
  container.innerHTML = '';

  if (!damages || damages.length === 0) {
    container.innerHTML = `
      <div class="center-align grey-text" style="padding: 24px 10px;">
        <i class="material-icons" style="font-size: 2rem; color: #cbd5e1; display: block; margin-bottom: 4px;">assignment_late</i>
        No se registran daños en el levantamiento de terreno de este caso.
      </div>
    `;
    return;
  }

  damages.forEach((d, idx) => {
    const card = document.createElement('div');
    card.className = 'inspector-damage-readonly-card';

    // Medidas geométricas físicas
    const l = Number(d.largo_l || 0).toFixed(2);
    const a = Number(d.ancho_a || 0).toFixed(2);
    const h = Number(d.alto_h || 0).toFixed(2);
    const area = Number(d.area_afectada_m2 || 0).toFixed(2);
    const vol = Number(d.volumen_afectado_m3 || 0).toFixed(2);

    let photosHtml = '';
    if (Array.isArray(d.fotos) && d.fotos.length > 0) {
      photosHtml = `
        <div class="inspector-damage-photos-row">
          ${d.fotos.map(f => {
            const token = ApiService.getToken();
            const photoUrl = `/api/cases/${currentAdjusterCaseId}/photos/${f.id}/file?token=${encodeURIComponent(token || '')}`;
            return `
              <img src="${photoUrl}" 
                   class="inspector-damage-photo-thumb" 
                   title="${f.descripcion || d.tipo_dano || 'Evidencia'}" 
                   alt="Evidencia" 
                   onclick="Swal.fire({imageUrl: '${photoUrl}', imageAlt: 'Evidencia', title: '${d.sector_nombre || 'Sector'} · ${d.tipo_dano || 'Daño'}', showConfirmButton: false, showCloseButton: true})">
            `;
          }).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="inspector-damage-title">
        <span>#${idx + 1} · ${d.sector_nombre || 'Sector General'}</span>
        <span class="badge-tag" style="background: #e0f2fe; color: #0369a1; font-size: 0.68rem;">${d.tipo_dano || 'Daño'}</span>
      </div>
      <div style="font-size: 0.8rem; color: #334155; margin-bottom: 6px;">
        ${d.descripcion_dano || d.observacion_terreno || 'Sin observaciones adicionales del inspector.'}
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <span class="inspector-damage-geom-badge">L: ${l}m</span>
        <span class="inspector-damage-geom-badge">A: ${a}m</span>
        <span class="inspector-damage-geom-badge">H: ${h}m</span>
        <span class="inspector-damage-geom-badge" style="background: #ecfdf5; color: #047857;">Área: ${area} m²</span>
        ${vol > 0 ? `<span class="inspector-damage-geom-badge">Vol: ${vol} m³</span>` : ''}
      </div>
      ${photosHtml}
    `;
    container.appendChild(card);
  });
}

// Renderizar ZONA B: Partidas del Ajustador
function renderAdjusterZoneB(items) {
  const tbody = document.getElementById('adjuster-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="center-align grey-text" style="padding: 30px;">
          <i class="material-icons" style="font-size: 2.2rem; color: #cbd5e1; display: block; margin-bottom: 4px;">post_add</i>
          Aún no se han cuantificado partidas para este presupuesto. Haga clic en "+ Partida" para agregar.
        </td>
      </tr>
    `;
    return;
  }

  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.id = `adjuster-item-row-${item.id}`;
    if (item.tipo === 'gasto_general') {
      tr.className = 'budget-table-gg-row';
    }

    const subtotal = Math.round(Number(item.cantidad || 0) * Number(item.precio_unitario || 0));

    tr.innerHTML = `
      <td class="center-align" style="font-weight: 700; color: #64748b;">${item.item_numero || (idx + 1)}</td>
      <td><strong>${item.sector_nombre || '-'}</strong></td>
      <td>
        <div style="font-weight: 700; color: #0f172a;">${item.proceso_constructivo}</div>
        <div style="font-size: 0.74rem; color: #64748b;">${item.dano_asociado || item.justificacion_tecnica || ''}</div>
      </td>
      <td class="center-align"><span class="badge-tag" style="background: #f1f5f9; color: #334155;">${item.unidad_medida}</span></td>
      <td class="right-align">
        <input type="number" 
               step="0.01" 
               min="0" 
               class="budget-input-inline" 
               value="${Number(item.cantidad || 0)}" 
               onchange="handleAdjusterItemInlineChange('${item.id}', 'cantidad', this.value)">
      </td>
      <td class="right-align">
        <input type="number" 
               step="1" 
               min="0" 
               class="budget-input-inline" 
               value="${Math.round(Number(item.precio_unitario || 0))}" 
               onchange="handleAdjusterItemInlineChange('${item.id}', 'precio_unitario', this.value)">
      </td>
      <td class="right-align" id="adjuster-item-subtotal-${item.id}" style="font-weight: 800; color: #059669;">
        $ ${subtotal.toLocaleString('es-CL')}
      </td>
      <td class="center-align">
        <button type="button" class="btn-flat btn-small red-text waves-effect" 
                style="padding: 0 4px; min-width: 28px;" 
                onclick="deleteAdjusterBudgetItem('${item.id}')" 
                title="Eliminar Partida">
          <i class="material-icons tiny">delete</i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Edición en línea reactiva de Cantidad o Precio Unitario
window.handleAdjusterItemInlineChange = async function(itemId, field, val) {
  const numVal = Number(val) || 0;
  const item = currentAdjusterItems.find(i => String(i.id) === String(itemId));
  if (item) {
    item[field] = numVal;
    item.subtotal = Math.round(Number(item.cantidad || 0) * Number(item.precio_unitario || 0));
    
    // Actualizar celda subtotal instantáneamente
    const subtotalEl = document.getElementById(`adjuster-item-subtotal-${itemId}`);
    if (subtotalEl) {
      subtotalEl.textContent = `$ ${item.subtotal.toLocaleString('es-CL')}`;
    }

    // Recalcular Zona C de inmediato
    recalculateAdjusterTotals();
  }

  // Persistir en backend
  try {
    await ApiService.updateAdjusterBudgetItem(itemId, { [field]: numVal });
  } catch (err) {
    console.error('[UPDATE ITEM INLINE ERROR]', err);
    Swal.fire({
      icon: 'error',
      title: 'Error al actualizar partida',
      text: err.message,
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false
    });
  }
};

// Recalcular Totales de ZONA C en tiempo real (según fórmulas del Excel)
function recalculateAdjusterTotals() {
  let costoDirecto = 0;
  currentAdjusterItems.forEach(item => {
    const cant = Number(item.cantidad || 0);
    const pu = Number(item.precio_unitario || 0);
    costoDirecto += Math.round(cant * pu);
  });

  const factorGG = currentAdjusterBudget?.factor_gg ? Number(currentAdjusterBudget.factor_gg) : 0.25;
  const gastosGenerales = Math.round(costoDirecto * factorGG);
  const neto = costoDirecto + gastosGenerales;
  const iva = Math.round(neto * 0.19);
  const total = neto + iva;

  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `$ ${Number(val).toLocaleString('es-CL')}`;
  };

  setT('adj-resumen-costo-directo', costoDirecto);
  setT('adj-resumen-gg', gastosGenerales);
  setT('adj-resumen-neto', neto);
  setT('adj-resumen-iva', iva);
  setT('adj-resumen-total', total);
}

// Abrir Modal para agregar partida
window.promptAddBudgetItem = async function(tipo = 'partida') {
  if (!currentAdjusterCaseId) return;

  const modalEl = document.getElementById('modal-add-budget-item');
  if (!modalEl) return;

  // Llenar sectores del caso
  const sectorSelect = document.getElementById('modal-item-sector');
  if (sectorSelect) {
    sectorSelect.innerHTML = '<option value="" disabled selected>-- Seleccione Sector / Recinto --</option>';
    const sectors = currentAdjusterCase?.sectores || [];
    if (sectors.length === 0) {
      const uniqueSectors = [...new Set(currentAdjusterInspectorDamages.map(d => d.sector_nombre).filter(Boolean))];
      uniqueSectors.forEach(s => {
        sectorSelect.innerHTML += `<option value="${s}">${s}</option>`;
      });
    } else {
      sectors.forEach(s => {
        sectorSelect.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`;
      });
    }
    sectorSelect.innerHTML += '<option value="General / Toda la Propiedad">General / Toda la Propiedad</option>';
  }

  // Cargar catálogo de procesos constructivos si está vacío
  if (adjusterCatalogProcesses.length === 0) {
    try {
      const res = await ApiService.getAdjusterCatalogProcesses();
      adjusterCatalogProcesses = res?.data || [];
    } catch (e) {
      console.warn('Error cargando catálogo de procesos:', e);
    }
  }

  const catSelect = document.getElementById('modal-item-catalog');
  if (catSelect) {
    catSelect.innerHTML = '<option value="" selected>-- Seleccione Proceso del Catálogo (Opcional) --</option>';
    adjusterCatalogProcesses.forEach(p => {
      catSelect.innerHTML += `<option value="${p.id}">${p.nombre} (${p.unidad_id}) - $${Number(p.precio_unitario_sugerido || 0).toLocaleString('es-CL')}</option>`;
    });
  }

  // Reset inputs
  document.getElementById('modal-item-id').value = '';
  document.getElementById('modal-item-tipo').value = tipo;
  document.getElementById('modal-item-proceso').value = '';
  document.getElementById('modal-item-dano').value = '';
  document.getElementById('modal-item-unidad').value = tipo === 'gasto_general' ? 'gl' : 'm²';
  document.getElementById('modal-item-cantidad').value = '1.00';
  document.getElementById('modal-item-unitario').value = '0';
  document.getElementById('modal-item-subtotal-display').textContent = '$0';

  const modalTitle = document.getElementById('modal-budget-item-title');
  if (modalTitle) {
    modalTitle.textContent = tipo === 'gasto_general' ? 'Agregar Gasto General' : 'Agregar Partida Constructiva';
  }

  // Inicializar y abrir Materialize Modal
  const instance = M.Modal.getInstance(modalEl) || M.Modal.init(modalEl);
  instance.open();
};

window.onCatalogProcessSelected = function(procId) {
  const p = adjusterCatalogProcesses.find(x => String(x.id) === String(procId));
  if (p) {
    const procInput = document.getElementById('modal-item-proceso');
    const unitInput = document.getElementById('modal-item-unidad');
    const unitPriceInput = document.getElementById('modal-item-unitario');
    if (procInput) procInput.value = p.nombre;
    if (unitInput) unitInput.value = p.unidad_id || 'm²';
    if (unitPriceInput) unitPriceInput.value = p.precio_unitario_sugerido || 0;
    calculateModalSubtotal();
  }
};

window.calculateModalSubtotal = function() {
  const cant = Number(document.getElementById('modal-item-cantidad')?.value) || 0;
  const pu = Number(document.getElementById('modal-item-unitario')?.value) || 0;
  const subtotal = Math.round(cant * pu);
  const display = document.getElementById('modal-item-subtotal-display');
  if (display) display.textContent = `$ ${subtotal.toLocaleString('es-CL')}`;
};

window.submitBudgetItemForm = async function() {
  const sector = document.getElementById('modal-item-sector')?.value;
  const proceso = document.getElementById('modal-item-proceso')?.value;
  const dano = document.getElementById('modal-item-dano')?.value;
  const unidad = document.getElementById('modal-item-unidad')?.value;
  const cantidad = Number(document.getElementById('modal-item-cantidad')?.value);
  const unitario = Number(document.getElementById('modal-item-unitario')?.value);
  const tipo = document.getElementById('modal-item-tipo')?.value || 'partida';

  if (!sector) {
    Swal.fire({ icon: 'warning', title: 'Sector requerido', text: 'Seleccione el sector afectado.', confirmButtonColor: '#059669' });
    return;
  }
  if (!proceso) {
    Swal.fire({ icon: 'warning', title: 'Proceso requerido', text: 'Ingrese la descripción del proceso constructivo.', confirmButtonColor: '#059669' });
    return;
  }
  if (isNaN(cantidad) || cantidad <= 0) {
    Swal.fire({ icon: 'warning', title: 'Cantidad inválida', text: 'Ingrese una cantidad mayor a 0.', confirmButtonColor: '#059669' });
    return;
  }

  try {
    const itemData = {
      sector_nombre: sector,
      proceso_constructivo: proceso,
      dano_asociado: dano,
      unidad_medida: unidad,
      cantidad,
      precio_unitario: unitario,
      tipo
    };

    const res = await ApiService.addAdjusterBudgetItem(currentAdjusterCaseId, itemData);
    if (res && res.data) {
      currentAdjusterItems.push(res.data);
      renderAdjusterZoneB(currentAdjusterItems);
      recalculateAdjusterTotals();

      const modalEl = document.getElementById('modal-add-budget-item');
      const instance = M.Modal.getInstance(modalEl);
      if (instance) instance.close();

      Swal.fire({
        icon: 'success',
        title: 'Partida Agregada',
        text: 'La partida fue registrada exitosamente en el presupuesto.',
        timer: 1800,
        showConfirmButton: false
      });
    }
  } catch (err) {
    console.error('[ADD BUDGET ITEM ERROR]', err);
    Swal.fire({ icon: 'error', title: 'Error al agregar partida', text: err.message, confirmButtonColor: '#059669' });
  }
};

window.deleteAdjusterBudgetItem = async function(itemId) {
  const result = await Swal.fire({
    title: '¿Eliminar Partida?',
    text: 'Esta partida constructiva será eliminada del presupuesto.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b'
  });

  if (!result.isConfirmed) return;

  try {
    await ApiService.deleteAdjusterBudgetItem(itemId);
    currentAdjusterItems = currentAdjusterItems.filter(i => String(i.id) !== String(itemId));
    renderAdjusterZoneB(currentAdjusterItems);
    recalculateAdjusterTotals();

    Swal.fire({
      icon: 'success',
      title: 'Partida Eliminada',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error('[DELETE BUDGET ITEM ERROR]', err);
    Swal.fire({ icon: 'error', title: 'Error al eliminar partida', text: err.message, confirmButtonColor: '#059669' });
  }
};

// Guardar Borrador
window.saveAdjusterCurrentDraft = async function() {
  if (!currentAdjusterCaseId) return;
  try {
    await ApiService.saveAdjusterDraft(currentAdjusterCaseId, { factor_gg: 0.25 });
    Swal.fire({
      icon: 'success',
      title: 'Borrador Guardado',
      text: 'El estado actual del presupuesto fue guardado exitosamente en PostgreSQL.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#059669'
    });
  } catch (err) {
    console.error('[SAVE DRAFT ERROR]', err);
    Swal.fire({ icon: 'error', title: 'Error al guardar', text: err.message, confirmButtonColor: '#059669' });
  }
};

// Enviar a Revisión
window.submitAdjusterCurrentReview = async function() {
  if (!currentAdjusterCaseId) return;

  if (!currentAdjusterItems || currentAdjusterItems.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Presupuesto Vacío',
      text: 'Debe ingresar al menos una partida constructiva antes de enviar a revisión.',
      confirmButtonColor: '#059669'
    });
    return;
  }

  const result = await Swal.fire({
    title: '¿Enviar a Revisión?',
    text: 'El presupuesto será enviado al Administrador para su validación pericial y aprobación.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, Enviar a Revisión',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b'
  });

  if (!result.isConfirmed) return;

  try {
    await ApiService.submitAdjusterReview(currentAdjusterCaseId);
    
    // Actualizar badge
    const badge = document.getElementById('adjuster-badge-presupuesto-estado');
    if (badge) badge.textContent = 'EN REVISIÓN';

    Swal.fire({
      icon: 'success',
      title: 'Presupuesto Enviado',
      text: 'El presupuesto fue enviado exitosamente para revisión administrativa.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#059669'
    });
  } catch (err) {
    console.error('[SUBMIT REVIEW ERROR]', err);
    Swal.fire({ icon: 'error', title: 'Error al enviar', text: err.message, confirmButtonColor: '#059669' });
  }
};

// Exportar a Excel (.xlsx) nativo
window.triggerAdjusterExcelExport = async function() {
  if (!currentAdjusterCaseId) return;
  try {
    Swal.fire({
      title: 'Generando Excel...',
      text: 'Preparando libro de cálculo conforme a Acta Preinspección.',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
    await ApiService.downloadAdjusterExcel(currentAdjusterCaseId, currentAdjusterCase?.expediente_codigo);
    Swal.close();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error de exportación', text: err.message, confirmButtonColor: '#059669' });
  }
};

// Exportar a PDF pericial
window.triggerAdjusterPdfExport = async function() {
  if (!currentAdjusterCaseId) return;
  try {
    Swal.fire({
      title: 'Generando PDF...',
      text: 'Estructurando informe técnico pericial de presupuesto.',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
    await ApiService.downloadAdjusterPdf(currentAdjusterCaseId, currentAdjusterCase?.expediente_codigo);
    Swal.close();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error de exportación', text: err.message, confirmButtonColor: '#059669' });
  }
};

// Exportar funciones globalmente
window.loadAdjusterDashboard = loadAdjusterDashboard;
window.loadAdjusterCases = loadAdjusterCases;
window.openAdjusterCuantificacion = openAdjusterCuantificacion;
window.handleAdjusterItemInlineChange = handleAdjusterItemInlineChange;
window.promptAddBudgetItem = promptAddBudgetItem;
window.onCatalogProcessSelected = onCatalogProcessSelected;
window.calculateModalSubtotal = calculateModalSubtotal;
window.submitBudgetItemForm = submitBudgetItemForm;
window.deleteAdjusterBudgetItem = deleteAdjusterBudgetItem;
window.saveAdjusterCurrentDraft = saveAdjusterCurrentDraft;
window.submitAdjusterCurrentReview = submitAdjusterCurrentReview;
window.triggerAdjusterExcelExport = triggerAdjusterExcelExport;
window.triggerAdjusterPdfExport = triggerAdjusterPdfExport;
