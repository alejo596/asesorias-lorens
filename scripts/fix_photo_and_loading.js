const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'app-custom.css');

// =========================================================================
// 1. UPDATE CSS (app-custom.css)
// =========================================================================
let css = fs.readFileSync(cssPath, 'utf8');

const loadingAndFocusCss = `
/* ==========================================================================
   LOADER GLOBAL DE PÁGINAS Y CONTROL DE FOCUS EN MENÚ
   ========================================================================== */

/* Barra de progreso global en la parte superior */
.global-page-loader {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3.5px;
  z-index: 99999;
  background: rgba(245, 158, 11, 0.2);
  overflow: hidden;
}

.page-loader-progress-bar {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #d97706, #b45309);
  animation: globalLoadingAnim 1.2s infinite ease-in-out;
  transform-origin: 0% 50%;
}

@keyframes globalLoadingAnim {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0%); }
  100% { transform: translateX(100%); }
}

/* Indicador flotante sutil de carga */
.global-loading-indicator {
  position: fixed;
  top: 70px;
  right: 24px;
  z-index: 99998;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
  border: 1px solid #cbd5e1;
  border-radius: 30px;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.global-loading-indicator.hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px);
}

/* Overlay de subida de fotos */
.photo-upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(4px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: white;
  text-align: center;
  padding: 20px;
}

/* Control estricto de focus en navegación para evitar halos y bloqueos visuales */
.sidebar-menu-link,
.case-tab-btn,
.inspection-subtab-btn,
.topbar-action-btn,
.btn-flat {
  outline: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

.sidebar-menu-link:focus,
.sidebar-menu-link:focus-visible,
.sidebar-menu-link:active,
.case-tab-btn:focus,
.case-tab-btn:focus-visible,
.case-tab-btn:active,
.inspection-subtab-btn:focus,
.inspection-subtab-btn:focus-visible,
.topbar-action-btn:focus,
.topbar-action-btn:active {
  outline: none !important;
  box-shadow: none !important;
}

/* Indicador de carga sobre imágenes */
.photo-img-wrapper {
  position: relative;
  width: 100%;
  height: 195px;
  background: #0f172a;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-card-loader {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #0f172a;
  z-index: 2;
  transition: opacity 0.25s ease;
}
`;

if (!css.includes('.global-page-loader')) {
  css += '\n' + loadingAndFocusCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✓ Added loading and focus CSS to public/css/app-custom.css');
}

// =========================================================================
// 2. UPDATE HTML (index.html)
// =========================================================================
let html = fs.readFileSync(htmlPath, 'utf8');

// Add global loading indicator near top of body
if (!html.includes('id="global-page-loader"')) {
  const bodyStart = html.indexOf('<body>');
  if (bodyStart !== -1) {
    const loaderMarkup = `<body>
    <!-- INDICADORES GLOBALES DE CARGA (PÁGINAS Y CONTENIDOS) -->
    <div id="global-page-loader" class="global-page-loader" style="display: none;">
        <div class="page-loader-progress-bar"></div>
    </div>
    <div id="global-loading-indicator" class="global-loading-indicator hidden" style="display: none;">
        <div class="preloader-wrapper small active" style="width: 20px; height: 20px;">
            <div class="spinner-layer spinner-amber-only">
                <div class="circle-clipper left"><div class="circle"></div></div>
                <div class="gap-patch"><div class="circle"></div></div>
                <div class="circle-clipper right"><div class="circle"></div></div>
            </div>
        </div>
        <span id="global-loading-text" style="font-size: 0.8rem; font-weight: 700; color: #1e293b;">Cargando...</span>
    </div>`;
    html = html.substring(0, bodyStart) + loaderMarkup + html.substring(bodyStart + 6);
    console.log('✓ Added #global-page-loader markup to public/index.html');
  }
}

// Add photo upload overlay inside modal-nueva-foto
if (!html.includes('id="photo-upload-loading-overlay"')) {
  const modalFormStart = html.indexOf('<form id="form-nueva-foto"');
  if (modalFormStart !== -1) {
    const overlayMarkup = `<div id="photo-upload-loading-overlay" class="photo-upload-overlay" style="display: none;">
                <div class="preloader-wrapper medium active" style="width: 44px; height: 44px; margin-bottom: 12px;">
                    <div class="spinner-layer spinner-amber-only">
                        <div class="circle-clipper left"><div class="circle"></div></div>
                        <div class="gap-patch"><div class="circle"></div></div>
                        <div class="circle-clipper right"><div class="circle"></div></div>
                    </div>
                </div>
                <strong style="font-size: 0.95rem; color: #f8fafc; margin-bottom: 4px;">Guardando evidencia en servidor...</strong>
                <span style="font-size: 0.78rem; color: #cbd5e1;">Almacenando archivo físico y registrando metadatos en PostgreSQL</span>
            </div>
            `;
    const formTagEnd = html.indexOf('>', modalFormStart) + 1;
    html = html.substring(0, formTagEnd) + '\n            ' + overlayMarkup + html.substring(formTagEnd);
    console.log('✓ Added #photo-upload-loading-overlay inside modal-nueva-foto');
  }
}

// Ensure Lightbox has an image loader
if (html.includes('id="modal-lightbox"') && !html.includes('id="lightbox-loader"')) {
  const imgTag = '<img id="lightbox-img"';
  const imgIdx = html.indexOf(imgTag);
  if (imgIdx !== -1) {
    const lightboxLoader = `<div id="lightbox-loader" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: #94a3b8; gap: 8px;">
          <div class="preloader-wrapper small active">
              <div class="spinner-layer spinner-amber-only">
                  <div class="circle-clipper left"><div class="circle"></div></div>
                  <div class="gap-patch"><div class="circle"></div></div>
                  <div class="circle-clipper right"><div class="circle"></div></div>
              </div>
          </div>
          <span style="font-size: 0.78rem;">Cargando imagen a resolución completa...</span>
      </div>\n      `;
    html = html.substring(0, imgIdx) + lightboxLoader + html.substring(imgIdx);
    console.log('✓ Added #lightbox-loader inside modal-lightbox');
  }
}

fs.writeFileSync(htmlPath, html, 'utf8');

// =========================================================================
// 3. UPDATE JAVASCRIPT (app.js)
// =========================================================================
let js = fs.readFileSync(appJsPath, 'utf8');

// 3.1 Global Loading Helpers and Focus Management
const globalLoadingCode = `
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
`;

if (!js.includes('function showPageLoading')) {
  js = globalLoadingCode + '\n' + js;
  console.log('✓ Added showPageLoading and controlMenuFocus to public/js/app.js');
}

// 3.2 Update photoSource to ALWAYS append authentication token to /file URLs
const oldPhotoSourceStart = js.indexOf('function photoSource(photo) {');
const oldPhotoSourceEnd = js.indexOf('let selectedPhotoSector =');

if (oldPhotoSourceStart !== -1 && oldPhotoSourceEnd !== -1) {
  const newPhotoSource = `function photoSource(photo) {
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
    raw = \`/api/cases/\${cId}/photos/\${photo.id}/file\`;
  }
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (!raw.startsWith('/')) {
    const cId = photo.expediente_id || currentCaseId;
    raw = \`/api/cases/\${cId}/photos/\${photo.id}/file\`;
  }

  // Adjuntar siempre el token JWT para evitar 'Acceso no autorizado: Token no proporcionado.' en tags <img>
  if (raw.includes('/photos/') && raw.includes('/file')) {
    if (!raw.includes('token=') && token) {
      raw += (raw.includes('?') ? '&' : '?') + \`token=\${encodeURIComponent(token)}\`;
    }
  }
  return raw;
}
`;

  js = js.substring(0, oldPhotoSourceStart) + newPhotoSource + '\n' + js.substring(oldPhotoSourceEnd);
  console.log('✓ Updated photoSource in public/js/app.js with token query attachment');
}

// 3.3 Update openPhotoLightbox to show spinner while loading image
const oldLightboxStart = js.indexOf('function openPhotoLightbox(src, sector, desc) {');
if (oldLightboxStart !== -1) {
  const oldLightboxEnd = js.indexOf('}', oldLightboxStart) + 1;
  const newLightbox = `function openPhotoLightbox(src, sector, desc) {
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
}`;
  js = js.substring(0, oldLightboxStart) + newLightbox + js.substring(oldLightboxEnd);
  console.log('✓ Updated openPhotoLightbox in public/js/app.js with loading spinner');
}

// 3.4 Update switchTab to control focus, blur clicked element, and show page loading
const oldSwitchTabStart = js.indexOf('function switchTab(tabId) {');
if (oldSwitchTabStart !== -1) {
  const oldSwitchTabEnd = js.indexOf('// Restricción administrativa', oldSwitchTabStart);
  // Let's replace the top of switchTab
  const switchTabHead = `function switchTab(tabId, clickedElement = null) {
  if (!tabId) return;

  // Controlar foco inmediatamente
  controlMenuFocus(null, document.getElementById(tabId));

  const targetPanel = document.getElementById(tabId);
  if (!targetPanel) {
    console.warn(\`[NAV] Sección solicitada inexistente: \${tabId}\`);
    return;
  }

  showPageLoading('Cargando sección...');
  setTimeout(() => hidePageLoading(), 400);
`;
  const originalHeadEnd = js.indexOf('const targetPanel = document.getElementById(tabId);', oldSwitchTabStart);
  if (originalHeadEnd !== -1) {
    const afterCheck = js.indexOf('// RESTRICCIÓN ESTRICTA', originalHeadEnd);
    if (afterCheck !== -1) {
      js = js.substring(0, oldSwitchTabStart) + switchTabHead + '\n  ' + js.substring(afterCheck);
      console.log('✓ Updated switchTab in public/js/app.js with focus control and page loading');
    }
  }
}

// 3.5 Update handleConfirmPhotoCapture to display upload loading overlay
if (js.includes("submitBtn.innerHTML = '<i class=\"material-icons left spin\">refresh</i> Guardando en servidor...';")) {
  js = js.replace(
    "submitBtn.innerHTML = '<i class=\"material-icons left spin\">refresh</i> Guardando en servidor...';",
    `submitBtn.innerHTML = '<i class="material-icons left spin">refresh</i> Guardando en servidor...';
    const uploadOverlay = document.getElementById('photo-upload-loading-overlay');
    if (uploadOverlay) uploadOverlay.style.display = 'flex';`
  );
  js = js.replace(
    "updateSavePhotoButtonLabel();\n    }",
    `updateSavePhotoButtonLabel();
    }
    const uploadOverlay = document.getElementById('photo-upload-loading-overlay');
    if (uploadOverlay) uploadOverlay.style.display = 'none';`
  );
  console.log('✓ Connected #photo-upload-loading-overlay in handleConfirmPhotoCapture');
}

// 3.6 Update renderInspectionPhotos to render individual photo card loaders
const renderPhotosFuncStart = js.indexOf('function renderInspectionPhotos(caseData) {');
if (renderPhotosFuncStart !== -1) {
  const photoCardHtmlIdx = js.indexOf('col.innerHTML = `', renderPhotosFuncStart);
  if (photoCardHtmlIdx !== -1) {
    const photoCardHtmlEnd = js.indexOf('grid.appendChild(col);', photoCardHtmlIdx);
    if (photoCardHtmlEnd !== -1) {
      const newCardHtml = `col.innerHTML = \`
      <div class="card" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; transition: transform 0.2s ease;">
        <div class="photo-img-wrapper" title="Haga clic para ampliar a pantalla completa">
          <!-- Spinner de carga individual mientras se transmite la imagen -->
          <div class="photo-card-loader" id="loader-img-\${p.id}">
            <div class="preloader-wrapper small active" style="width: 24px; height: 24px;">
              <div class="spinner-layer spinner-amber-only">
                <div class="circle-clipper left"><div class="circle"></div></div>
                <div class="gap-patch"><div class="circle"></div></div>
                <div class="circle-clipper right"><div class="circle"></div></div>
              </div>
            </div>
            <span style="font-size: 0.68rem; color: #94a3b8; font-weight: 600;">Cargando evidencia...</span>
          </div>

          <img src="\${photoUrl}" alt="Evidencia \${idx + 1}"
               onload="const l = document.getElementById('loader-img-\${p.id}'); if(l) l.style.display='none'; this.style.opacity='1';"
               onerror="const l = document.getElementById('loader-img-\${p.id}'); if(l) l.style.display='none'; this.style.opacity='1'; this.src='\${PHOTO_PLACEHOLDER}';"
               style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.35s ease; cursor: pointer;"
               onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')">
          
          <span style="position: absolute; top: 10px; left: 10px; background: rgba(15, 23, 42, 0.85); color: #fbbf24; font-weight: 800; font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; border: 1px solid rgba(251, 191, 36, 0.4); display: inline-flex; align-items: center; gap: 4px; z-index: 3;">
            <i class="material-icons tiny" style="font-size: 14px;">meeting_room</i> \${sectorName}
          </span>

          <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; z-index: 3; cursor: pointer;" onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')">
            <i class="material-icons tiny">zoom_in</i>
          </span>
        </div>
        
        <div class="card-content" style="padding: 12px 14px; font-size: 0.82rem; min-height: 72px;">
          <p style="margin: 0; color: #1e293b; font-weight: 600; line-height: 1.35;">\${desc}</p>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
            <i class="material-icons tiny" style="font-size: 14px;">schedule</i> \${formattedDate}
          </div>
        </div>

        <div class="card-action right-align" style="padding: 6px 12px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <button type="button" class="btn-flat waves-effect" style="padding: 0 4px; font-size: 0.75rem; text-transform: none; color: #2563eb; display: inline-flex; align-items: center; gap: 3px;" onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')">
            <i class="material-icons tiny">fullscreen</i> Ampliar
          </button>
          <button type="button" class="btn-flat red-text text-darken-2 waves-effect" style="padding: 0 4px; font-size: 0.75rem; text-transform: none; display: inline-flex; align-items: center; gap: 3px;" onclick="removePhoto('\${p.id}')">
            <i class="material-icons tiny">delete</i> Eliminar
          </button>
        </div>
      </div>
    \`;\n    `;
      js = js.substring(0, photoCardHtmlIdx) + newCardHtml + js.substring(photoCardHtmlEnd);
      console.log('✓ Added per-image loaders in renderInspectionPhotos');
    }
  }
}

// 3.7 Add showPageLoading in loadInspectorDashboard, loadAssignedCases, openInspectorCase
js = js.replace(
  'async function loadInspectorDashboard() {',
  'async function loadInspectorDashboard() {\n  showPageLoading("Cargando indicadores...");'
);
js = js.replace(
  "console.warn('[Dashboard Inspector] Error al cargar indicadores desde PostgreSQL:', err.message);\n  }",
  "console.warn('[Dashboard Inspector] Error al cargar indicadores desde PostgreSQL:', err.message);\n  } finally {\n    hidePageLoading();\n  }"
);

js = js.replace(
  'async function loadAssignedCases(page = 1) {',
  'async function loadAssignedCases(page = 1) {\n  showPageLoading("Consultando expedientes...");'
);
js = js.replace(
  'renderInspectorCasesMobileCards([]);\n  }',
  'renderInspectorCasesMobileCards([]);\n  } finally {\n    hidePageLoading();\n  }'
);

js = js.replace(
  'async function openInspectorCase(caseId, initialSection = \'subtab-info\') {',
  'async function openInspectorCase(caseId, initialSection = "subtab-info") {\n  showPageLoading("Abriendo ficha de inspección...");'
);
js = js.replace(
  "window.scrollTo({ top: 0, behavior: 'smooth' });\n}",
  "window.scrollTo({ top: 0, behavior: 'smooth' });\n  hidePageLoading();\n}"
);

// 3.8 Expose new helpers on window
js += `
window.showPageLoading = showPageLoading;
window.hidePageLoading = hidePageLoading;
window.controlMenuFocus = controlMenuFocus;
`;

fs.writeFileSync(appJsPath, js, 'utf8');
console.log('✓ Successfully updated public/js/app.js');
