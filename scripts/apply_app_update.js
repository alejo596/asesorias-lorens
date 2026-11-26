const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. In setupEventListeners, bind form-nuevo-sector
if (!code.includes("bindFormSubmit('form-nuevo-sector'")) {
  code = code.replace(
    "bindFormSubmit('form-nueva-foto', handleConfirmPhotoCapture);",
    "bindFormSubmit('form-nueva-foto', handleConfirmPhotoCapture);\n    bindFormSubmit('form-nuevo-sector', handleCreateSector);"
  );
}

// 2. Update loadCase to remove getLocalFallbackData and mergeLocalEvidence
const oldLoadCaseRegex = /async function loadCase\(caseId\)[\s\S]*?renderAll\(currentCaseData\);\s*\}/;
const newLoadCase = `async function loadCase(caseId) {
  try {
    const data = await ApiService.getCaseDetails(caseId);
    currentCaseData = data;
    renderAll(currentCaseData);
  } catch (err) {
    console.error('[loadCase] Error al cargar expediente desde PostgreSQL:', err.message);
    M.toast({ html: 'No fue posible cargar el expediente desde la base de datos.', classes: 'red darken-3' });
  }
}`;
code = code.replace(oldLoadCaseRegex, newLoadCase);

// 3. Update renderPhotos to remove mock Unsplash photos
const oldRenderPhotosRegex = /function renderPhotos\(photos = \[\]\)[\s\S]*?galleryPhotos\.forEach\(photo => \{/;
const newRenderPhotosHead = `function renderPhotos(photos = []) {
  const container = document.getElementById('photos-container');
  if (!container) return;
  container.innerHTML = '';
  photoRegistry.clear();

  if (!photos || photos.length === 0) {
    container.innerHTML = \`
      <div class="col s12 center-align grey-text" style="padding: 24px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">add_a_photo</i>
        No se registran fotografías para este expediente.
      </div>
    \`;
    return;
  }

  const galleryPhotos = photos;
  galleryPhotos.forEach(photo => {`;
code = code.replace(oldRenderPhotosRegex, newRenderPhotosHead);

// 4. Update photo helpers: photoSource, setupPhotoCapture, openPhotoUploadModal, handlePhotoFileSelected, populatePhotoSectorOptions, handleConfirmPhotoCapture, removePhoto
const oldPhotoSectionRegex = /function photoSource\(photo\)[\s\S]*?M\.toast\(\{ html: 'Evidencia eliminada del expediente\.', classes: 'blue-grey darken-3' \}\);\s*\}/;

const newPhotoSection = `function photoSource(photo) {
  if (!photo) return '';
  if (photo.url) return photo.url;
  if (typeof photo.data_url === 'string' && photo.data_url.startsWith('data:')) return photo.data_url;
  const stored = photo.ruta_almacenamiento || '';
  if (stored && !stored.startsWith('local://')) {
    if (stored.startsWith('http://') || stored.startsWith('https://') || stored.startsWith('/')) {
      return stored;
    }
    const cId = photo.expediente_id || currentCaseId;
    return \`/api/cases/\${cId}/photos/\${photo.id}/file\`;
  }
  return photo.data_url || '';
}

function setupPhotoCapture() {
  const cameraInput = document.getElementById('input-foto-camera');
  const galleryInput = document.getElementById('input-foto-gallery');
  const fileInput = document.getElementById('input-foto-file');
  const btnCamera = document.getElementById('btn-trigger-camera');
  const btnGallery = document.getElementById('btn-trigger-gallery');

  if (btnCamera && cameraInput) {
    btnCamera.onclick = (e) => { e.preventDefault(); cameraInput.click(); };
  }
  if (btnGallery && galleryInput) {
    btnGallery.onclick = (e) => { e.preventDefault(); galleryInput.click(); };
  }

  if (cameraInput) cameraInput.addEventListener('change', handlePhotoFileSelected);
  if (galleryInput) galleryInput.addEventListener('change', handlePhotoFileSelected);
  if (fileInput) fileInput.addEventListener('change', handlePhotoFileSelected);
}

function triggerPhotoCapture() {
  openPhotoUploadModal();
}

function openPhotoUploadModal(presetSector = null) {
  pendingPhotoDraft = null;
  const modalEl = document.getElementById('modal-nueva-foto');
  if (!modalEl) return;

  const preview = document.getElementById('foto-preview');
  const previewContainer = document.getElementById('foto-preview-container');
  if (preview) preview.src = '';
  if (previewContainer) previewContainer.style.display = 'none';

  const cameraInput = document.getElementById('input-foto-camera');
  const galleryInput = document.getElementById('input-foto-gallery');
  const fileInput = document.getElementById('input-foto-file');
  if (cameraInput) cameraInput.value = '';
  if (galleryInput) galleryInput.value = '';
  if (fileInput) fileInput.value = '';

  const meta = document.getElementById('foto-meta');
  if (meta) meta.textContent = 'Seleccione Cámara o Galería para adjuntar evidencia física.';

  const desc = document.getElementById('foto-descripcion');
  if (desc) desc.value = '';

  populatePhotoSectorOptions(presetSector);

  const instance = M.Modal.getInstance(modalEl);
  if (instance) instance.open();
  M.updateTextFields();
}
const openPhotoCaptureModal = openPhotoUploadModal;

function handlePhotoFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!PHOTO_ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    M.toast({ html: 'Formato no admitido. Use JPG, PNG o WebP.', classes: 'red darken-3' });
    return;
  }

  if (file.size > PHOTO_MAX_BYTES) {
    M.toast({
      html: \`La imagen pesa \${formatFileSize(file.size)} y supera el límite de 10 MB.\`,
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
      nombre_archivo: file.name || \`evidencia_\${Date.now()}.jpg\`,
      mime_type: file.type || 'image/jpeg',
      tamano_bytes: file.size,
      data_url: loadEvent.target.result,
    };

    const preview = document.getElementById('foto-preview');
    const previewContainer = document.getElementById('foto-preview-container');
    if (preview) preview.src = pendingPhotoDraft.data_url;
    if (previewContainer) previewContainer.style.display = 'block';

    const meta = document.getElementById('foto-meta');
    if (meta) {
      meta.textContent = \`\${pendingPhotoDraft.nombre_archivo} · \${formatFileSize(pendingPhotoDraft.tamano_bytes)} · Captura lista para subir\`;
    }
  };
  reader.readAsDataURL(file);
}

function populatePhotoSectorOptions(presetSector = null) {
  const select = document.getElementById('foto-sector');
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

  select.innerHTML = '';
  sectors.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  const targetSector = presetSector || (currentCaseData && currentCaseData.activeSector);
  if (targetSector && sectors.has(targetSector.toUpperCase())) {
    select.value = targetSector.toUpperCase();
  }

  const existing = M.FormSelect.getInstance(select);
  if (existing) existing.destroy();
  M.FormSelect.init(select);
}

async function handleConfirmPhotoCapture(event) {
  event.preventDefault();

  if (!pendingPhotoDraft || !pendingPhotoDraft.file) {
    M.toast({ html: 'No hay una imagen seleccionada para subir.', classes: 'amber darken-3' });
    return;
  }
  if (!currentCaseId) {
    M.toast({ html: 'No hay un expediente activo seleccionado.', classes: 'red darken-3' });
    return;
  }

  const sectorSelect = document.getElementById('foto-sector');
  const sector = (sectorSelect && sectorSelect.value ? sectorSelect.value : 'GENERAL').toUpperCase();
  const descripcion =
    ((document.getElementById('foto-descripcion') || {}).value || '').trim() ||
    'Evidencia pericial capturada en terreno.';

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

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left spin">refresh</i> Subiendo...';
  }

  try {
    const savedPhoto = await ApiService.uploadPhoto(currentCaseId, formData);

    if (!currentCaseData) currentCaseData = { photos: [] };
    if (!Array.isArray(currentCaseData.photos)) currentCaseData.photos = [];
    currentCaseData.photos.unshift(savedPhoto);

    renderPhotos(currentCaseData.photos);
    renderInspectionPhotos(currentCaseData);
    updateInspectionSummaryCards(currentCaseData);
    renderAdminViews();
    updateDraftBadge();

    const modal = M.Modal.getInstance(document.getElementById('modal-nueva-foto'));
    if (modal) modal.close();

    M.toast({ html: 'Evidencia fotográfica física guardada en el servidor.', classes: 'green darken-2' });
    pendingPhotoDraft = null;
  } catch (error) {
    console.error('[FOTOS] Error al subir foto:', error);
    M.toast({ html: 'Error al subir fotografía: ' + error.message, classes: 'red darken-3' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="material-icons left">cloud_upload</i> Guardar Evidencia';
    }
  }
}

async function removePhoto(photoId) {
  if (!confirm('¿Eliminar esta evidencia fotográfica del expediente y del servidor físico?')) return;

  try {
    await ApiService.deletePhoto(currentCaseId, photoId);
    if (currentCaseData && Array.isArray(currentCaseData.photos)) {
      currentCaseData.photos = currentCaseData.photos.filter((p) => String(p.id) !== String(photoId));
    }
    renderPhotos(currentCaseData ? currentCaseData.photos : []);
    renderInspectionPhotos(currentCaseData || {});
    updateInspectionSummaryCards(currentCaseData || {});
    renderAdminViews();
    updateDraftBadge();
    M.toast({ html: 'Evidencia fotográfica eliminada del servidor.', classes: 'green darken-2' });
  } catch (err) {
    console.error('[removePhoto] Error:', err);
    M.toast({ html: 'Error al eliminar evidencia: ' + err.message, classes: 'red darken-3' });
  }
}`;
code = code.replace(oldPhotoSectionRegex, newPhotoSection);

// 5. Update handleAddOrUpdatePartida to strictly save to PostgreSQL without mock pushes
const oldAddPartidaRegex = /async function handleAddOrUpdatePartida\(e\)[\s\S]*?loadCase\(currentCaseId\);\s*\}/;
const newAddPartida = `async function handleAddOrUpdatePartida(e) {
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
    M.toast({ html: 'Partida guardada con éxito en PostgreSQL.', classes: 'green darken-2' });
    const modal = M.Modal.getInstance(document.getElementById('modal-nuevo-dano'));
    if (modal) modal.close();
    resetPartidaModal();
    if (currentCaseId) {
      await openInspectorCase(currentCaseId, 'subtab-danos');
    }
  } catch (err) {
    console.error('[handleAddOrUpdatePartida] Error:', err);
    M.toast({ html: 'Error al guardar partida en base de datos: ' + err.message, classes: 'red darken-3' });
  }
}`;
code = code.replace(oldAddPartidaRegex, newAddPartida);

// 6. Replace Inspector Module at the bottom of the file
const inspectorIndex = code.indexOf('/* ==========================================================================\n   MÓDULO DEL INSPECTOR:');
if (inspectorIndex === -1) {
  console.error('Could not find inspector header in app.js!');
  process.exit(1);
}

const beforeInspector = code.substring(0, inspectorIndex);

const newInspectorModule = `/* ==========================================================================
   MÓDULO DEL INSPECTOR: EXPEDIENTES ASIGNADOS, FICHA Y CUANTIFICACIÓN (100% POSTGRESQL)
   ========================================================================== */

let inspectorCasesState = {
  page: 1,
  limit: 10,
  search: '',
  status: 'all',
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

// 1. Mostrar Home del Inspector (Panel de Control + 6 KPIs + Mis Expedientes)
async function showInspectorHome() {
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
  const activeLink = document.querySelector('.sidebar-menu-link[data-tab="tab-dashboard"]') ||
                     document.querySelector('#sidebar-item-inspector-expedientes .sidebar-menu-link');
  if (activeLink) activeLink.classList.add('active');

  // Cargar métricas del dashboard y listado de casos asignados desde PostgreSQL
  await loadInspectorDashboard();
  await loadAssignedCases(1);
}

// 2. Cargar KPIs operativos reales del Inspector desde PostgreSQL
async function loadInspectorDashboard() {
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
  }
}

// 3. Cargar expedientes asignados al inspector autenticado con paginación real de PostgreSQL
async function loadAssignedCases(page = 1) {
  inspectorCasesState.page = page;
  try {
    const res = await ApiService.getAssignedCases({
      page: inspectorCasesState.page,
      limit: inspectorCasesState.limit,
      search: inspectorCasesState.search,
      status: inspectorCasesState.status
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
      footerCount.textContent = \`Mostrando \${cases.length} de \${pagination.total} expedientes asignados a su cargo\`;
    }
  } catch (err) {
    console.error('[loadAssignedCases] Error al consultar expedientes:', err);
    renderInspectorCasesDataTable([]);
    renderInspectorCasesMobileCards([]);
  }
}

const loadInspectorAssignedCases = loadAssignedCases;

// Renderizar la tabla DataTable de expedientes (Escritorio / Tablet)
function renderInspectorCasesDataTable(cases) {
  const tbody = document.getElementById('inspector-cases-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!cases || cases.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="9" class="center-align grey-text" style="padding: 30px;">
          <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_off</i>
          No existen expedientes asignados
        </td>
      </tr>
    \`;
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

    tr.innerHTML = \`
      <td><strong style="color: var(--navy-950); font-weight: 800;">\${c.codigo}</strong></td>
      <td><code>\${c.numero_siniestro || 'SIN-S/N'}</code></td>
      <td><strong>\${c.cliente_nombre || 'Asegurado'}</strong></td>
      <td style="font-size: 0.82rem; color: var(--slate-600);">\${c.direccion || c.comuna || 'Sin dirección'}</td>
      <td><span class="badge grey lighten-3 grey-text text-darken-3" style="border-radius: 4px; font-size: 0.75rem;">\${c.tipo_evento || 'Sismo'}</span></td>
      <td style="font-size: 0.82rem; white-space: nowrap;">\${c.fecha_visita || '02/06/2026'}</td>
      <td><span class="badge \${badgeClass}" style="font-weight: 700; border-radius: 4px; font-size: 0.72rem;">\${estadoTexto}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #334155;">\${pct}%</span>
          <div class="case-progress-wrap">
            <div class="case-progress-bar" style="width: \${pct}%;"></div>
          </div>
        </div>
      </td>
      <td class="center-align" style="white-space: nowrap;">
        <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-small primary darken-1 waves-effect" title="Ver Ficha de Inspección" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('\${c.id}', 'subtab-info');">
            <i class="material-icons tiny">assignment</i> Ver ficha
          </button>
          <button type="button" class="btn btn-small amber darken-3 waves-effect" title="Continuar Inspección / Gestionar Daños" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('\${c.id}', 'subtab-danos');">
            <i class="material-icons tiny">construction</i> Inspección
          </button>
          <button type="button" class="btn btn-small blue-grey darken-3 waves-effect" title="Consultar Fotografías" style="border-radius: 6px; font-size: 0.72rem; text-transform: none; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); openInspectorCase('\${c.id}', 'subtab-fotos');">
            <i class="material-icons tiny">photo_camera</i> Fotos
          </button>
        </div>
      </td>
    \`;
    tbody.appendChild(tr);
  });
}

// Renderizar tarjetas táctiles para Móvil (Mobile-First < 768px)
function renderInspectorCasesMobileCards(cases) {
  const container = document.getElementById('inspector-cases-mobile-cards');
  if (!container) return;

  container.innerHTML = '';
  if (!cases || cases.length === 0) {
    container.innerHTML = \`
      <div class="center-align grey-text" style="padding: 30px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">folder_off</i>
        No existen expedientes asignados
      </div>
    \`;
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
    card.innerHTML = \`
      <div class="case-card-mobile-header">
        <strong style="color: var(--navy-950); font-size: 1rem;">\${c.codigo}</strong>
        <span class="badge \${badgeClass}" style="margin: 0; font-weight: 700; border-radius: 4px; font-size: 0.72rem;">\${estadoTexto}</span>
      </div>
      <div class="case-card-mobile-body">
        <div style="font-size: 0.82rem; color: var(--slate-600); margin-bottom: 4px;">
          Siniestro: <code>\${c.numero_siniestro || 'SIN-S/N'}</code>
        </div>
        <div style="font-size: 0.92rem; font-weight: 700; color: var(--navy-950);">
          \${c.cliente_nombre || 'Asegurado'}
        </div>
        <div style="font-size: 0.82rem; color: var(--slate-600); margin-top: 2px;">
          <i class="material-icons tiny" style="vertical-align: middle;">location_on</i> \${c.direccion || c.comuna || 'Sin dirección'}
        </div>
        <div style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--slate-600); margin-bottom: 3px;">
            <span>Avance inspección</span>
            <strong>\${pct}%</strong>
          </div>
          <div class="case-progress-wrap" style="height: 6px;">
            <div class="case-progress-bar" style="width: \${pct}%;"></div>
          </div>
        </div>
      </div>
      <div class="case-card-mobile-actions">
        <button type="button" class="btn btn-small primary darken-1 waves-effect" style="flex: 1;" onclick="openInspectorCase('\${c.id}', 'subtab-info');">
          <i class="material-icons left tiny">assignment</i> Ficha
        </button>
        <button type="button" class="btn btn-small amber darken-3 waves-effect" style="flex: 1;" onclick="openInspectorCase('\${c.id}', 'subtab-danos');">
          <i class="material-icons left tiny">construction</i> Daños
        </button>
        <button type="button" class="btn btn-small blue-grey darken-3 waves-effect" style="flex: 1;" onclick="openInspectorCase('\${c.id}', 'subtab-fotos');">
          <i class="material-icons left tiny">photo_camera</i> Fotos
        </button>
      </div>
    \`;
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
  if (info) info.textContent = \`Página \${pagination.page} de \${pagination.totalPages}\`;

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
async function openInspectorCase(caseId, initialSection = 'subtab-info') {
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
  setEl('info-cliente-comuna', \`\${exp.comuna || ''}, \${exp.region || ''}\`);
  setEl('info-inmueble-tipo', \`\${exp.tipo_inmueble || 'Casa'} · \${exp.sistema_constructivo || 'Albañilería'}\`);
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
function showInspectorCaseSection(sectionId) {
  document.querySelectorAll('.inspection-subtab-pane').forEach(p => p.style.display = 'none');
  const target = document.getElementById(sectionId);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.inspection-subtab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(\`.inspection-subtab-btn[data-subtab="\${sectionId}"]\`);
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

// Renderizar las tarjetas de sectores del expediente desde PostgreSQL
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

  const sectorList = Array.from(sectorMap.values());
  const badgeCount = document.getElementById('ficha-badge-sectores-count');
  if (badgeCount) badgeCount.textContent = sectorList.length;

  container.innerHTML = '';
  if (sectorList.length === 0) {
    container.innerHTML = \`
      <div class="col s12 center-align grey-text" style="padding: 30px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">meeting_room</i>
        No se registran sectores en este expediente. Presione <strong>"+ Nuevo Sector"</strong> para comenzar.
      </div>
    \`;
    return;
  }

  sectorList.forEach(sec => {
    const sectorName = sec.nombre;
    const sectorLines = lines.filter(l => (l.sector || '').toUpperCase() === sectorName);
    const sectorPhotos = photos.filter(p => (p.sector || '').toUpperCase() === sectorName);

    let metrajeSector = 0;
    sectorLines.forEach(l => { metrajeSector += parseFloat(l.cantidad_medida || 0); });

    const card = document.createElement('div');
    card.className = 'sector-card';
    card.innerHTML = \`
      <div class="sector-card-header">
        <h6 class="sector-card-title">
          <i class="material-icons tiny" style="color: var(--amber-500);">meeting_room</i>
          \${sectorName}
        </h6>
        <span class="badge \${sectorLines.length > 0 ? 'green lighten-5 green-text text-darken-3' : 'grey lighten-4 grey-text'}" style="font-weight: 700; border-radius: 4px; font-size: 0.72rem;">
          \${sectorLines.length > 0 ? \`\${sectorLines.length} daños\` : 'Sin daños'}
        </span>
      </div>
      <div style="font-size: 0.82rem; color: var(--slate-600); margin: 6px 0;">
        Metraje levantado: <strong>\${metrajeSector.toFixed(2)} m²</strong>
      </div>
      <div class="sector-stats-row">
        <span class="sector-stat-badge">
          <i class="material-icons tiny">straighten</i> \${sectorLines.length} partidas
        </span>
        <span class="sector-stat-badge">
          <i class="material-icons tiny">photo_camera</i> \${sectorPhotos.length} fotos
        </span>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="btn btn-small btn-add-partida amber darken-3" style="flex: 1; min-height: 36px; font-size: 0.76rem;" onclick="openAddDamageModalWithSector('\${sectorName}')">
          <i class="material-icons" style="font-size: 16px;">add_circle</i>+ Partida
        </button>
        <button type="button" class="btn btn-small waves-effect blue-grey darken-3" title="Filtrar daños de este sector" style="border-radius: 8px; padding: 0 10px; min-height: 36px;" onclick="viewSectorDamages('\${sectorName}')">
          <i class="material-icons tiny">visibility</i>
        </button>
        \${sec.id && sectorLines.length === 0 ? \`
          <button type="button" class="btn btn-small btn-flat red-text waves-effect" title="Eliminar sector vacío" style="border-radius: 8px; padding: 0 6px; min-height: 36px;" onclick="deleteSector('\${sec.id}', '\${sectorName}')">
            <i class="material-icons tiny">delete</i>
          </button>
        \` : ''}
      </div>
    \`;
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
    M.toast({ html: \`Sector <b>"\${nombre}"</b> registrado en PostgreSQL.\`, classes: 'green darken-2' });

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
    M.toast({ html: \`Sector <b>"\${nombre}"</b> registrado en PostgreSQL.\`, classes: 'green darken-2' });
  } catch (err) {
    M.toast({ html: 'Error al registrar sector: ' + err.message, classes: 'red darken-3' });
  }
}

async function deleteSector(sectorId, sectorName) {
  if (!confirm(\`¿Eliminar el sector "\${sectorName}" de este expediente?\`)) return;
  try {
    await ApiService.deleteSector(currentCaseId, sectorId);
    if (currentCaseData && Array.isArray(currentCaseData.sectors)) {
      currentCaseData.sectors = currentCaseData.sectors.filter(s => s.id !== sectorId);
    }
    renderInspectionSectors(currentCaseData);
    M.toast({ html: \`Sector "\${sectorName}" eliminado de la base de datos.\`, classes: 'green darken-2' });
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
    tbody.innerHTML = \`
      <tr>
        <td colspan="8" class="center-align grey-text" style="padding: 24px;">
          No hay partidas registradas en este expediente. Presione <strong>"+ Partida"</strong> para cuantificar los daños.
        </td>
      </tr>
    \`;
    return;
  }

  lines.forEach((l, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td><strong>#\${idx + 1}</strong></td>
      <td><span class="badge blue lighten-5 blue-text text-darken-4 font-weight-bold" style="border-radius: 4px;">\${l.sector || 'GENERAL'}</span></td>
      <td><strong>\${l.elemento || '-'}</strong></td>
      <td><span style="color: #b91c1c; font-weight: 600;">\${l.dano_tipo || '-'}</span></td>
      <td><small style="color: var(--slate-700);">\${l.reparacion_propuesta || l.descripcion_dano || '-'}</small></td>
      <td><code>\${l.metodo_calculo || 'direct'}</code></td>
      <td style="text-align: right; font-weight: 700; color: var(--navy-950);">
        \${BudgetViewer.formatQty(l.cantidad_medida || 0)} \${l.unidad_id || 'm²'}
      </td>
      <td class="center-align" style="white-space: nowrap;">
        <button type="button" class="btn-flat waves-effect red-text" title="Eliminar partida" onclick="deleteInspectionDamage('\${l.id}')" style="padding: 0 4px;">
          <i class="material-icons tiny">delete</i>
        </button>
      </td>
    \`;
    tbody.appendChild(tr);
  });
}

// Renderizar las fotos dentro de la ficha de inspección (con streaming real desde el backend)
function renderInspectionPhotos(caseData) {
  const grid = document.getElementById('inspection-photos-gallery-grid');
  if (!grid) return;

  const photos = caseData.photos || [];
  const badgeCount = document.getElementById('ficha-badge-fotos-count');
  if (badgeCount) badgeCount.textContent = photos.length;

  grid.innerHTML = '';
  if (photos.length === 0) {
    grid.innerHTML = \`
      <div class="col s12 center-align grey-text" style="padding: 30px;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">add_a_photo</i>
        Sin fotografías registradas en este expediente. Utilice el botón <strong>"Subir / Tomar Fotografía"</strong> para registrar evidencias de terreno.
      </div>
    \`;
    return;
  }

  photos.forEach((p, idx) => {
    const col = document.createElement('div');
    col.className = 'col s12 m6 l4';
    col.style.marginBottom = '16px';
    const photoUrl = p.url || photoSource(p) || PHOTO_PLACEHOLDER;
    const sectorName = p.sector || 'General';
    const desc = p.descripcion || 'Evidencia de terreno';
    const dateStr = p.created_at || p.fecha || p.fecha_captura;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleString('es-CL') : 'Captura Terreno';

    col.innerHTML = \`
      <div class="card" style="border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <div class="card-image" style="height: 180px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer;" onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')">
          <img src="\${photoUrl}" alt="Foto \${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='\${PHOTO_PLACEHOLDER}'">
          <span class="card-title" style="font-size: 0.8rem; padding: 4px 8px; background: rgba(0,0,0,0.65); border-radius: 4px; bottom: 8px; left: 8px;">
            \${sectorName}
          </span>
        </div>
        <div class="card-content" style="padding: 12px 14px; font-size: 0.82rem;">
          <p style="margin: 0; color: #334155; font-weight: 600; line-height: 1.3;">\${desc}</p>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 6px;">
            <i class="material-icons tiny" style="vertical-align: middle;">schedule</i> \${formattedDate}
          </div>
        </div>
        <div class="card-action right-align" style="padding: 6px 12px; background: #f8fafc; border-top: 1px solid #f1f5f9;">
          <button type="button" class="btn-flat red-text waves-effect" style="padding: 0 4px; font-size: 0.78rem; text-transform: none; display: inline-flex; align-items: center; gap: 4px;" onclick="removePhoto('\${p.id}')">
            <i class="material-icons tiny">delete</i> Eliminar
          </button>
        </div>
      </div>
    \`;
    grid.appendChild(col);
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
  if (elMetraje) elMetraje.textContent = \`\${totalMetraje.toFixed(2)} m²\`;
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
    sectorSelect.innerHTML = Array.from(sectors).map(s => \`<option value="\${s}">\${s}</option>\`).join('');
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
  M.toast({ html: \`Filtrando daños del sector: <b>\${sectorName}</b>\`, classes: 'blue-grey darken-3' });
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
  if (!confirm('¿Confirma que ha completado la visita técnica presencial y la cuantificación pericial de este expediente?')) {
    return;
  }

  if (!currentCaseId) return;

  try {
    const updated = await ApiService.finalizeInspection(currentCaseId);
    if (currentCaseData && currentCaseData.expediente) {
      currentCaseData.expediente.estado = 'procesado';
      currentCaseData.expediente.avance_porcentaje = 100;
    }

    M.toast({
      html: '<i class="material-icons left">verified</i>¡Inspección de terreno completada y enviada a liquidación!',
      classes: 'green darken-3'
    });

    await loadAssignedCases(1);
    await loadInspectorDashboard();
    backToInspectorHome();
  } catch (err) {
    console.error('[finalizeCaseInspection] Error:', err);
    M.toast({ html: 'Error al finalizar inspección: ' + err.message, classes: 'red darken-3' });
  }
}

// Eliminar partida de daño de la inspección en PostgreSQL
async function deleteInspectionDamage(lineId) {
  if (!confirm('¿Desea eliminar esta partida de daño registrada en terreno?')) return;

  try {
    await ApiService.deleteLine(lineId);
    if (currentCaseData && Array.isArray(currentCaseData.lines)) {
      currentCaseData.lines = currentCaseData.lines.filter(l => l.id !== lineId);
    }
    renderInspectionDamages(currentCaseData);
    renderInspectionSectors(currentCaseData);
    updateInspectionSummaryCards(currentCaseData);
    M.toast({ html: 'Partida eliminada de la base de datos.', classes: 'green darken-2' });
  } catch (err) {
    console.error('[deleteInspectionDamage] Error:', err);
    M.toast({ html: 'Error al eliminar partida: ' + err.message, classes: 'red darken-3' });
  }
}

// Exponer en window para eventos HTML
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
`;

const updatedCode = beforeInspector + newInspectorModule;
fs.writeFileSync(appJsPath, updatedCode, 'utf8');
console.log('Successfully updated public/js/app.js!');

