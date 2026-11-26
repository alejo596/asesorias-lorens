const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'app-custom.css');

// =========================================================================
// 1. UPDATE CSS (app-custom.css)
// =========================================================================
let css = fs.readFileSync(cssPath, 'utf8');

const photoWorkflowCss = `
/* ==========================================================================
   ESTILOS PARA FLUJO FOTOGRÁFICO INTERACTIVO: CAPTURA, SECTOR Y GALERÍA
   ========================================================================== */
.foto-sector-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  transition: all 0.15s ease-in-out;
  user-select: none;
}

.foto-sector-pill:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.foto-sector-pill.active {
  background: var(--amber-500) !important;
  border-color: var(--amber-600) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  transform: scale(1.03);
}

.modal-stored-photo-thumb {
  width: 76px;
  height: 76px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  border: 2px solid #e2e8f0;
  transition: all 0.2s ease;
}

.modal-stored-photo-thumb:hover {
  border-color: var(--amber-500);
  transform: scale(1.05);
}

.modal-stored-photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-stored-photo-thumb .thumb-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 23, 42, 0.85);
  color: #f8fafc;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 4px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gallery-sector-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  transition: all 0.15s ease;
}

.gallery-sector-filter-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.gallery-sector-filter-btn.active {
  background: #0f172a !important;
  color: #ffffff !important;
  border-color: #0f172a !important;
}
`;

if (!css.includes('.foto-sector-pill')) {
  css += '\n' + photoWorkflowCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✓ Added photo workflow CSS to public/css/app-custom.css');
}

// =========================================================================
// 2. UPDATE HTML (index.html)
// =========================================================================
let html = fs.readFileSync(htmlPath, 'utf8');

// 2.1 Update #subtab-fotos with direct capture buttons and filter chips
const subtabFotosStart = html.indexOf('<div id="subtab-fotos" class="case-tab-panel">');
const subtabFotosEnd = html.indexOf('<!-- SUB-PANEL 5: OBSERVACIONES -->');

if (subtabFotosStart !== -1 && subtabFotosEnd !== -1) {
  const newSubtabFotos = `<div id="subtab-fotos" class="case-tab-panel">
                        <div class="acta-sheet">
                            <!-- Encabezado y Acciones Directas de Captura -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                                <div>
                                    <h5 style="margin: 0; font-weight: 800; color: var(--navy-900); font-size: 1.18rem; display: flex; align-items: center; gap: 8px;">
                                        <i class="material-icons" style="color: var(--amber-500);">photo_camera</i>
                                        Evidencias Fotográficas de Terreno
                                    </h5>
                                    <p style="margin: 3px 0 0 0; color: var(--slate-600); font-size: 0.85rem;">
                                        Tome o suba la fotografía, confirme a qué sector pertenece antes de almacenar y consulte abajo todas las evidencias registradas.
                                    </p>
                                </div>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" class="btn amber darken-3 waves-effect font-weight-bold" style="border-radius: 8px; text-transform: none; display: inline-flex; align-items: center; gap: 6px; min-height: 40px;" onclick="triggerDirectCameraCapture();">
                                        <i class="material-icons left">camera_alt</i>Tomar con Cámara
                                    </button>
                                    <button type="button" class="btn blue-grey darken-3 waves-effect font-weight-bold" style="border-radius: 8px; text-transform: none; display: inline-flex; align-items: center; gap: 6px; min-height: 40px;" onclick="triggerDirectGalleryCapture();">
                                        <i class="material-icons left">photo_library</i>Cargar de Galería
                                    </button>
                                </div>
                            </div>

                            <!-- Barra de Filtros por Sector de las Evidencias Almacenadas -->
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--slate-700); text-transform: uppercase;">
                                        <i class="material-icons tiny" style="vertical-align: middle;">filter_list</i> Filtrar por sector:
                                    </span>
                                    <div id="inspection-photos-filter-chips" style="display: flex; gap: 6px; flex-wrap: wrap;">
                                        <!-- Generado dinámicamente: Todas (X), Baño 1 (Y), Living (Z)... -->
                                    </div>
                                </div>
                                <span style="font-size: 0.78rem; font-weight: 600; color: var(--slate-500);" id="inspection-photos-total-label">
                                    Total: 0 evidencias
                                </span>
                            </div>

                            <!-- Galería: Todas las imágenes almacenadas abajo -->
                            <div class="row" id="inspection-photos-gallery-grid">
                                <!-- Fotos renderizadas dinámicamente -->
                            </div>
                        </div>
                    </div>

                    `;

  html = html.substring(0, subtabFotosStart) + newSubtabFotos + html.substring(subtabFotosEnd);
  console.log('✓ Updated #subtab-fotos in public/index.html');
}

// 2.2 Update #modal-nueva-foto with immediate preview, sector question, and stored photos strip
const modalStart = html.indexOf('<div id="modal-nueva-foto"');
const modalEnd = html.indexOf('<!-- ============================================================== -->\n    <!-- MODAL 1: LEVANTAMIENTO');

if (modalStart !== -1 && modalEnd !== -1) {
  const newModal = `<div id="modal-nueva-foto" class="modal modal-fixed-footer modal-medium-corporate" style="border-radius: 14px; max-width: 600px; width: 94%;">
        <form id="form-nueva-foto" enctype="multipart/form-data">
            <div class="modal-content" style="padding: 20px 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <div>
                        <h5 style="margin: 0; font-weight: 800; color: var(--navy-900); font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                            <i class="material-icons" style="color: var(--amber-500);">photo_camera</i>
                            Captura de Evidencia Fotográfica
                        </h5>
                        <small style="color: var(--slate-500);">Fotografía pericial para liquidación de siniestro</small>
                    </div>
                    <button type="button" class="modal-close btn-flat waves-effect" style="padding: 0; min-width: 32px;">
                        <i class="material-icons">close</i>
                    </button>
                </div>

                <!-- Inputs de captura (Cámara / Galería) -->
                <input type="file" id="foto-input-camera" accept="image/jpeg,image/png,image/webp" capture="environment" style="display: none;">
                <input type="file" id="foto-input-gallery" accept="image/jpeg,image/png,image/webp" style="display: none;">

                <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                    <button type="button" class="btn amber darken-3 waves-effect flex-grow-1" style="border-radius: 8px; font-weight: 700; text-transform: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px;" onclick="triggerDirectCameraCapture();">
                        <i class="material-icons">camera_alt</i>
                        Usar Cámara Móvil
                    </button>
                    <button type="button" class="btn blue-grey darken-3 waves-effect flex-grow-1" style="border-radius: 8px; font-weight: 700; text-transform: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px;" onclick="triggerDirectGalleryCapture();">
                        <i class="material-icons">photo_library</i>
                        Elegir de Galería
                    </button>
                </div>

                <!-- 1. PREVISUALIZACIÓN INMEDIATA ("Al tomar la fotografía la debe mostrar") -->
                <div id="foto-preview-container" style="text-align: center; margin-bottom: 14px; background: #0f172a; border-radius: 10px; overflow: hidden; min-height: 200px; max-height: 280px; display: flex; align-items: center; justify-content: center; position: relative;">
                    <img id="foto-preview" src="" alt="Vista previa de la fotografía tomada" style="max-width: 100%; max-height: 280px; object-fit: contain; display: none;">
                    
                    <div id="foto-preview-placeholder" style="color: #94a3b8; text-align: center; padding: 24px;">
                        <i class="material-icons large" style="color: #475569; display: block; margin-bottom: 6px;">add_a_photo</i>
                        <strong style="color: #cbd5e1; font-size: 0.95rem; display: block; margin-bottom: 4px;">Tome una foto o elija de la galería</strong>
                        <span style="font-size: 0.8rem;">La imagen se mostrará aquí de inmediato para su confirmación.</span>
                    </div>

                    <div id="foto-meta-bar" style="display: none; position: absolute; bottom: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span id="foto-meta" style="background: rgba(0,0,0,0.75); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem;"></span>
                        <button type="button" class="btn-small amber darken-3 waves-effect" style="border-radius: 4px; font-size: 0.72rem; padding: 0 8px; text-transform: none;" onclick="triggerDirectCameraCapture();">
                            <i class="material-icons left tiny" style="margin-right: 3px;">refresh</i>Retomar
                        </button>
                    </div>
                </div>

                <!-- 2. PREGUNTA DEL SECTOR ("Debe preguntar a qué sector pertenece antes de almacenar") -->
                <div id="foto-sector-card" style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="font-weight: 800; color: #92400e; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
                            <i class="material-icons tiny" style="color: #d97706;">meeting_room</i>
                            ¿A qué sector pertenece esta evidencia? *
                        </label>
                        <button type="button" class="btn-flat waves-effect" style="font-size: 0.74rem; text-transform: none; color: #b45309; padding: 0 4px; font-weight: 700;" onclick="promptQuickNewSectorFromPhoto()">
                            <i class="material-icons left tiny">add</i>+ Nuevo Sector
                        </button>
                    </div>
                    <p style="margin: 0 0 8px 0; font-size: 0.78rem; color: #b45309;">
                        Toque el sector correspondiente al ambiente donde fue tomada la fotografía:
                    </p>
                    
                    <!-- Chips de selección rápida de sectores -->
                    <div id="foto-sector-pills" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
                        <!-- Generados dinámicamente con los sectores del expediente -->
                    </div>

                    <!-- Selector desplegable de sectores sincronizado -->
                    <div class="input-field" style="margin-top: 4px; margin-bottom: 0;">
                        <select id="foto-sector" required>
                            <option value="" disabled selected>-- Seleccione o confirme el Sector --</option>
                        </select>
                    </div>
                </div>

                <!-- Descripción Técnica Opcional -->
                <div class="input-field" style="margin-top: 8px; margin-bottom: 4px;">
                    <textarea id="foto-descripcion" class="materialize-textarea" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 0.88rem; min-height: 48px;" placeholder="Detalle técnico de la evidencia (opcional, ej: Fisura diagonal en muro poniente)"></textarea>
                    <label for="foto-descripcion" class="active">Descripción u Observación del Daño</label>
                </div>

                <!-- 3. EVIDENCIAS ALMACENADAS ABAJO ("Luego abajo mostrando todas las imágenes almacenadas de las evidencias") -->
                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="font-size: 0.84rem; color: var(--navy-950); display: flex; align-items: center; gap: 6px;">
                            <i class="material-icons tiny" style="color: var(--amber-600);">photo_library</i>
                            Evidencias almacenadas en este expediente (<span id="modal-stored-photos-count">0</span>)
                        </strong>
                        <small class="grey-text" style="font-size: 0.72rem;">Toque para ver en grande</small>
                    </div>
                    <div id="modal-stored-photos-list" style="display: flex; gap: 8px; overflow-x: auto; padding: 4px 2px 10px 2px; min-height: 70px;">
                        <!-- Miniaturas de fotos almacenadas -->
                    </div>
                </div>
            </div>

            <div class="modal-footer" style="padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
                <button type="button" class="btn-flat modal-close waves-effect" style="font-weight: 600;">Cancelar</button>
                <button type="submit" id="btn-save-photo" class="btn primary darken-1 waves-effect font-weight-bold" style="border-radius: 6px; text-transform: none; display: inline-flex; align-items: center; gap: 6px; min-height: 40px;">
                    <i class="material-icons tiny">cloud_upload</i>
                    Guardar Evidencia Fotográfica
                </button>
            </div>
        </form>
    </div>

    `;

  html = html.substring(0, modalStart) + newModal + html.substring(modalEnd);
  console.log('✓ Updated #modal-nueva-foto in public/index.html');
}

fs.writeFileSync(htmlPath, html, 'utf8');

// =========================================================================
// 3. UPDATE JAVASCRIPT (app.js)
// =========================================================================
let js = fs.readFileSync(appJsPath, 'utf8');

// Replace photo management and rendering in app.js
const photoCodeStart = js.indexOf('function photoSource(photo) {');
const photoCodeEnd = js.indexOf('// ==============================================================\n// VISTAS DEL MÓDULO ADMINISTRADOR');

if (photoCodeStart === -1 || photoCodeEnd === -1) {
  console.error('Photo code start/end markers not found in app.js');
  process.exit(1);
}

const newPhotoCode = `function photoSource(photo) {
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
      meta.textContent = \`\${pendingPhotoDraft.nombre_archivo} · \${formatFileSize(pendingPhotoDraft.tamano_bytes)}\`;
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
      pill.innerHTML = \`<i class="material-icons tiny">meeting_room</i> \${name}\`;
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
    saveBtn.innerHTML = \`<i class="material-icons tiny left">cloud_upload</i> Guardar en Sector: <b>\${selectedPhotoSector}</b>\`;
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
        M.toast({ html: \`Sector <b>"\${cleanName}"</b> agregado y seleccionado.\`, classes: 'green darken-2' });
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
    const photoUrl = p.url || photoSource(p) || PHOTO_PLACEHOLDER;
    const sectorName = p.sector || 'GENERAL';
    thumb.title = \`\${sectorName} - \${p.descripcion || 'Evidencia'} (Clic para ampliar)\`;
    thumb.innerHTML = \`
      <img src="\${photoUrl}" alt="Evidencia \${idx + 1}" onerror="this.onerror=null;this.src='\${PHOTO_PLACEHOLDER}'">
      <span class="thumb-tag">\${sectorName}</span>
    \`;
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
    M.toast({
      html: '<i class="material-icons left tiny">photo_camera</i>Debe tomar una fotografía o elegir una imagen primero.',
      classes: 'amber darken-3'
    });
    return;
  }

  const sectorSelect = document.getElementById('foto-sector');
  const sector = (selectedPhotoSector || (sectorSelect ? sectorSelect.value : '') || '').trim().toUpperCase();

  if (!sector) {
    M.toast({
      html: '<i class="material-icons left tiny">warning</i>Debe indicar a qué sector pertenece esta evidencia antes de almacenar.',
      classes: 'red darken-3',
      displayLength: 5000
    });
    const sectorCard = document.getElementById('foto-sector-card');
    if (sectorCard) {
      sectorCard.style.border = '2px solid #dc2626';
      sectorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { sectorCard.style.border = '1.5px solid #fde68a'; }, 3000);
    }
    return;
  }

  if (!currentCaseId) {
    M.toast({ html: 'No hay un expediente activo seleccionado.', classes: 'red darken-3' });
    return;
  }

  const descripcion =
    ((document.getElementById('foto-descripcion') || {}).value || '').trim() ||
    \`Evidencia pericial de terreno en sector \${sector}.\`;

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

  const submitBtn = event.target.querySelector('button[type="submit"]') || document.getElementById('btn-save-photo');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left spin">refresh</i> Guardando en servidor...';
  }

  try {
    const savedPhoto = await ApiService.uploadPhoto(currentCaseId, formData);

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

    M.toast({
      html: \`<i class="material-icons left tiny">verified</i>Evidencia fotográfica guardada con éxito en <b>\${sector}</b>.\`,
      classes: 'green darken-2',
      displayLength: 4500
    });

    pendingPhotoDraft = null;
    selectedPhotoSector = '';

    // Si estamos en la ficha, asegurar que el tab de fotos esté visible
    const fotosTab = document.getElementById('subtab-fotos');
    if (fotosTab && fotosTab.style.display !== 'none') {
      const grid = document.getElementById('inspection-photos-gallery-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (error) {
    console.error('[FOTOS] Error al subir foto:', error);
    M.toast({ html: 'Error al subir fotografía: ' + error.message, classes: 'red darken-3' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      updateSavePhotoButtonLabel();
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
    M.toast({ html: 'Evidencia fotográfica eliminada.', classes: 'green darken-2' });
  } catch (err) {
    console.error('[removePhoto] Error:', err);
    M.toast({ html: 'Error al eliminar evidencia: ' + err.message, classes: 'red darken-3' });
  }
}
`;

js = js.substring(0, photoCodeStart) + newPhotoCode + js.substring(photoCodeEnd);

// Replace renderInspectionPhotos to support sector filtering and rich cards
const renderInspectionPhotosStart = js.indexOf('function renderInspectionPhotos(caseData) {');
const renderInspectionPhotosEnd = js.indexOf('// Actualizar las métricas del resumen de inspección');

if (renderInspectionPhotosStart !== -1 && renderInspectionPhotosEnd !== -1) {
  const newRenderInspectionPhotos = `function renderInspectionPhotos(caseData) {
  const grid = document.getElementById('inspection-photos-gallery-grid');
  const filterChipsContainer = document.getElementById('inspection-photos-filter-chips');
  const totalLabel = document.getElementById('inspection-photos-total-label');
  if (!grid) return;

  const allPhotos = (caseData && caseData.photos) || [];
  const badgeCount = document.getElementById('ficha-badge-fotos-count');
  if (badgeCount) badgeCount.textContent = allPhotos.length;
  if (totalLabel) totalLabel.textContent = \`Total: \${allPhotos.length} evidencia\${allPhotos.length === 1 ? '' : 's'}\`;

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
    allChip.innerHTML = \`Todas (\${allPhotos.length})\`;
    allChip.onclick = () => {
      activePhotoFilterSector = 'all';
      renderInspectionPhotos(currentCaseData);
    };
    filterChipsContainer.appendChild(allChip);

    // Chip por cada sector con fotos
    sectorsMap.forEach((count, sName) => {
      const chip = document.createElement('span');
      chip.className = 'gallery-sector-filter-btn' + (activePhotoFilterSector === sName ? ' active' : '');
      chip.innerHTML = \`\${sName} (\${count})\`;
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
    grid.innerHTML = \`
      <div class="col s12 center-align grey-text" style="padding: 36px 20px; background: #fff; border-radius: 12px; border: 1.5px dashed #cbd5e1; margin: 10px 0;">
        <i class="material-icons large" style="color: #cbd5e1; display: block; margin-bottom: 8px;">add_a_photo</i>
        \${allPhotos.length === 0 
          ? 'No hay fotografías registradas aún en este expediente. Utilice los botones superiores <strong>"Tomar con Cámara"</strong> o <strong>"Cargar de Galería"</strong> para adjuntar evidencias.' 
          : \`No hay fotografías asociadas al sector <strong>"\${activePhotoFilterSector}"</strong>.\`}
      </div>
    \`;
    return;
  }

  // 3. Renderizar todas las imágenes almacenadas de las evidencias
  photos.forEach((p, idx) => {
    const col = document.createElement('div');
    col.className = 'col s12 m6 l4';
    col.style.marginBottom = '18px';
    const photoUrl = p.url || photoSource(p) || PHOTO_PLACEHOLDER;
    const sectorName = (p.sector || 'GENERAL').toUpperCase();
    const desc = p.descripcion || 'Evidencia pericial de terreno';
    const dateStr = p.created_at || p.fecha || p.fecha_captura;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleString('es-CL') : 'Captura Terreno';

    col.innerHTML = \`
      <div class="card" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; transition: transform 0.2s ease;">
        <div class="card-image" style="height: 195px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; position: relative;" onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')" title="Haga clic para ampliar a pantalla completa">
          <img src="\${photoUrl}" alt="Evidencia \${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='\${PHOTO_PLACEHOLDER}'">
          
          <span style="position: absolute; top: 10px; left: 10px; background: rgba(15, 23, 42, 0.85); color: #fbbf24; font-weight: 800; font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; border: 1px solid rgba(251, 191, 36, 0.4); display: inline-flex; align-items: center; gap: 4px;">
            <i class="material-icons tiny" style="font-size: 14px;">meeting_room</i> \${sectorName}
          </span>

          <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
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
    \`;
    grid.appendChild(col);
  });
}
`;

  js = js.substring(0, renderInspectionPhotosStart) + newRenderInspectionPhotos + js.substring(renderInspectionPhotosEnd);
  console.log('✓ Updated renderInspectionPhotos in public/js/app.js');
}

// Ensure window exports include new functions
const exportLine = 'window.showInspectorHome = showInspectorHome;';
const newExports = `window.triggerDirectCameraCapture = triggerDirectCameraCapture;
window.triggerDirectGalleryCapture = triggerDirectGalleryCapture;
window.selectPhotoSector = selectPhotoSector;
window.promptQuickNewSectorFromPhoto = promptQuickNewSectorFromPhoto;
window.renderModalStoredPhotos = renderModalStoredPhotos;
`;

if (!js.includes('window.triggerDirectCameraCapture')) {
  js = js.replace(exportLine, newExports + exportLine);
  console.log('✓ Added window exports in public/js/app.js');
}

fs.writeFileSync(appJsPath, js, 'utf8');
console.log('✓ Successfully written public/js/app.js');

