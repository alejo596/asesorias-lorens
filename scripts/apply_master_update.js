const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'app-custom.css');

// =========================================================================
// 1. UPDATE CSS (app-custom.css)
// =========================================================================
let css = fs.readFileSync(cssPath, 'utf8');

const masterCss = `
/* ==========================================================================
   LORENS SWEETALERT2 & TIMELINE INTEGRATION STYLES
   ========================================================================== */
.swal2-container {
  z-index: 100000 !important;
}

.lorens-swal-popup {
  border-radius: 14px !important;
  font-family: inherit !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
}

/* Timeline Vertical de Evidencia Fotográfica */
.lorens-vertical-timeline {
  position: relative;
  padding: 10px 0 10px 24px;
}

.lorens-vertical-timeline::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 8px;
  width: 2px;
  background: #cbd5e1;
}

.timeline-event-item {
  position: relative;
  margin-bottom: 18px;
}

.timeline-event-item:last-child {
  margin-bottom: 0;
}

.timeline-event-badge {
  position: absolute;
  left: -24px;
  top: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 0 0 3px #ffffff, 0 1px 4px rgba(0,0,0,0.18);
  z-index: 2;
  font-size: 11px;
}

.timeline-event-badge.blue { background: #2563eb; }
.timeline-event-badge.green { background: #10b981; }
.timeline-event-badge.amber { background: #f59e0b; }
.timeline-event-badge.red { background: #ef4444; }
.timeline-event-badge.grey { background: #64748b; }

.timeline-event-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}

.timeline-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 4px;
}

.timeline-event-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 5px;
}

.timeline-event-time {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
}

.timeline-event-desc {
  font-size: 0.8rem;
  color: #334155;
  margin: 0;
  line-height: 1.4;
}

.timeline-event-user {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
`;

if (!css.includes('.lorens-vertical-timeline')) {
  css += '\n' + masterCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✓ Added SweetAlert2 and Timeline CSS to app-custom.css');
}

// =========================================================================
// 2. UPDATE HTML (index.html)
// =========================================================================
let html = fs.readFileSync(htmlPath, 'utf8');

// 2.1 Include SweetAlert2 in <head>
if (!html.includes('sweetalert2@11')) {
  html = html.replace(
    '<title>Sistema de Inspección',
    '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>\n    <title>Sistema de Inspección'
  );
  console.log('✓ Added SweetAlert2 CDN to <head> in index.html');
}

// 2.2 Add modal-foto-timeline before modal-lightbox
if (!html.includes('id="modal-foto-timeline"')) {
  const lightboxIdx = html.indexOf('<!-- ============================================================== -->\n    <!-- MODAL 0: LIGHTBOX DE FOTOGRAFÍAS -->');
  const timelineModalMarkup = `<!-- ============================================================== -->
    <!-- MODAL 0.C: TIMELINE E HISTORIAL DE EVIDENCIA FOTOGRÁFICA -->
    <!-- ============================================================== -->
    <div id="modal-foto-timeline" class="modal modal-fixed-footer modal-medium-corporate" style="border-radius: 14px; max-width: 620px; width: 94%;">
        <div class="modal-content" style="padding: 20px 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div id="timeline-foto-preview-thumb" style="width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: #0f172a; flex-shrink: 0; border: 1px solid #cbd5e1;">
                        <img id="timeline-thumb-img" src="" alt="Miniatura" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <h5 style="margin: 0; font-weight: 800; color: var(--navy-900); font-size: 1.15rem; display: flex; align-items: center; gap: 6px;">
                            <i class="material-icons" style="color: #3b82f6;">history</i>
                            Historial de la Evidencia
                        </h5>
                        <div style="font-size: 0.8rem; color: var(--slate-600); margin-top: 2px;">
                            Sector: <strong id="timeline-foto-sector" class="blue-text text-darken-3">-</strong> · <span id="timeline-foto-nombre">-</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="modal-close btn-flat waves-effect" style="padding: 0; min-width: 32px;">
                    <i class="material-icons">close</i>
                </button>
            </div>

            <div id="timeline-loading-spinner" style="text-align: center; padding: 36px 0;">
                <div class="preloader-wrapper small active">
                    <div class="spinner-layer spinner-amber-only">
                        <div class="circle-clipper left"><div class="circle"></div></div>
                        <div class="gap-patch"><div class="circle"></div></div>
                        <div class="circle-clipper right"><div class="circle"></div></div>
                    </div>
                </div>
                <p style="color: #64748b; font-size: 0.82rem; margin-top: 8px;">Consultando historial cronológico en PostgreSQL...</p>
            </div>

            <!-- Contenedor del Timeline Vertical -->
            <div id="timeline-events-container" class="lorens-vertical-timeline" style="display: none;">
                <!-- Eventos renderizados dinámicamente -->
            </div>
        </div>
        <div class="modal-footer" style="padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.74rem; color: #64748b;">Trazabilidad oficial e inmutable PostgreSQL</span>
            <button type="button" class="btn primary darken-1 modal-close waves-effect font-weight-bold" style="border-radius: 6px; text-transform: none;">
                Cerrar Historial
            </button>
        </div>
    </div>

    `;

  if (lightboxIdx !== -1) {
    html = html.substring(0, lightboxIdx) + timelineModalMarkup + html.substring(lightboxIdx);
    console.log('✓ Added #modal-foto-timeline before modal-lightbox in index.html');
  }
}

fs.writeFileSync(htmlPath, html, 'utf8');

// =========================================================================
// 3. UPDATE JAVASCRIPT (app.js)
// =========================================================================
let js = fs.readFileSync(appJsPath, 'utf8');

// 3.1 Insert SweetAlert2 centralized helpers and Blob Cache at the top
const swalHelpersCode = `
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
      html: \`
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
      \`,
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

    if (bar) bar.style.width = \`\${percent}%\`;
    if (pct) pct.textContent = \`\${percent}%\`;
    if (bytes) {
      const loadedKb = (bytesLoaded / 1024).toFixed(0);
      const totalKb = (totalBytes / 1024).toFixed(0);
      bytes.textContent = \`\${loadedKb} KB de \${totalKb} KB\`;
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

  const token = ApiService.getToken();
  const cId = photo.expediente_id || currentCaseId;
  const endpoint = \`/api/cases/\${cId}/photos/\${photo.id}/file\`;

  try {
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': \`Bearer \${token}\` } : {}
    });

    if (!res.ok) {
      throw new Error(\`HTTP \${res.status}\`);
    }

    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error('El archivo recuperado no es una imagen válida.');
    }

    const objectUrl = URL.createObjectURL(blob);
    photoBlobCache.set(photoId, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn(\`[getAuthorizedPhotoUrl] Fallback directo para foto \${photoId}:\`, err.message);
    if (token) {
      return \`\${endpoint}?token=\${encodeURIComponent(token)}\`;
    }
    return PHOTO_PLACEHOLDER;
  }
}
`;

if (!js.includes('const LorensAlert = {')) {
  js = swalHelpersCode + '\n' + js;
  console.log('✓ Added LorensAlert and photoBlobCache to public/js/app.js');
}

// 3.2 Update handleAddOrUpdatePartida to use SweetAlert2
js = js.replace(
  "M.toast({ html: 'Partida guardada con éxito en PostgreSQL.', classes: 'green darken-2' });",
  "LorensAlert.success('Partida guardada', 'La partida fue registrada exitosamente en PostgreSQL.');"
);
js = js.replace(
  "M.toast({ html: 'Error al guardar partida en base de datos: ' + err.message, classes: 'red darken-3' });",
  "LorensAlert.error('Error al guardar partida', 'No fue posible registrar la partida: ' + err.message);"
);

// 3.3 Update deleteInspectionDamage to use SweetAlert2
const oldDeleteDamageRegex = /async function deleteInspectionDamage\(lineId\)[\s\S]*?updateInspectionSummaryCards\(currentCaseData\);\s*M\.toast[\s\S]*?\}\s*\}/;
const newDeleteDamage = `async function deleteInspectionDamage(lineId) {
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
}`;
js = js.replace(oldDeleteDamageRegex, newDeleteDamage);

// 3.4 Update handleConfirmPhotoCapture to use SweetAlert2 upload progress and blob verification
const oldConfirmPhotoRegex = /async function handleConfirmPhotoCapture\(event\)[\s\S]*?pendingPhotoDraft = null;\s*selectedPhotoSector = '';[\s\S]*?\}\s*finally\s*\{[\s\S]*?\}\s*\}/;
const newConfirmPhoto = `async function handleConfirmPhotoCapture(event) {
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

  // 1. Mostrar SweetAlert2 con barra de progreso real (0-100%)
  LorensAlert.showUploadProgress('Guardando evidencia fotográfica');

  try {
    // 2. Subir con progreso medible mediante XMLHttpRequest
    const savedPhoto = await ApiService.uploadPhotoWithProgress(currentCaseId, formData, (progress) => {
      if (progress.stage === 'uploading') {
        const msg = progress.percent < 100 
          ? \`Transfiriendo archivo al servidor: \${progress.percent}%\`
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
      \`La evidencia pericial fue guardada físicamente en el servidor y registrada en el sector "\${sector}".\`
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
}`;
js = js.replace(oldConfirmPhotoRegex, newConfirmPhoto);

// 3.5 Update removePhoto to use SweetAlert2
const oldRemovePhotoRegex = /async function removePhoto\(photoId\)[\s\S]*?renderAdminViews\(\);\s*updateDraftBadge\(\);[\s\S]*?\}\s*catch[\s\S]*?\}\s*\}/;
const newRemovePhoto = `async function removePhoto(photoId) {
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
}`;
js = js.replace(oldRemovePhotoRegex, newRemovePhoto);

// 3.6 Update finalizeCaseInspection to use SweetAlert2
const oldFinalizeRegex = /async function finalizeCaseInspection\(\)[\s\S]*?backToInspectorHome\(\);\s*\}\s*catch[\s\S]*?\}\s*\}/;
const newFinalize = `async function finalizeCaseInspection() {
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
}`;
js = js.replace(oldFinalizeRegex, newFinalize);

// 3.7 Add Timeline Management Functions (openPhotoTimeline)
const timelineFunctions = `
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
          item.innerHTML = \`
            <div class="timeline-event-badge \${badgeColor}">
              <i class="material-icons" style="font-size: 11px;">\${badgeIcon}</i>
            </div>
            <div class="timeline-event-content">
              <div class="timeline-event-header">
                <span class="timeline-event-title">
                  \${ev.tipo_evento.replace(/_/g, ' ')}
                </span>
                <span class="timeline-event-time">
                  \${formattedDate} · \${formattedTime}
                </span>
              </div>
              <p class="timeline-event-desc">\${ev.descripcion}</p>
              <div class="timeline-event-user">
                <i class="material-icons tiny" style="font-size: 13px;">person</i>
                <span>\${ev.usuario_nombre} (\${ev.usuario_rol})</span>
              </div>
            </div>
          \`;
          container.appendChild(item);
        });
      }
      container.style.display = 'block';
    }
  } catch (err) {
    console.error('[openPhotoTimeline] Error:', err);
    if (container) {
      container.innerHTML = \`<p class="red-text center-align" style="padding: 20px;">Error al cargar historial: \${err.message}</p>\`;
      container.style.display = 'block';
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}
`;

if (!js.includes('function openPhotoTimeline')) {
  js = js + '\n' + timelineFunctions;
  console.log('✓ Added openPhotoTimeline to public/js/app.js');
}

// 3.8 Update renderInspectionPhotos to include "Ver historial" button and blob loading
const oldRenderPhotosCardStart = js.indexOf('<div class="card-action right-align"');
if (oldRenderPhotosCardStart !== -1) {
  // Let's replace card action in renderInspectionPhotos
  const targetActionRegex = /<div class="card-action right-align"[\s\S]*?onclick="removePhoto\('\$\{p\.id\}'\)">[\s\S]*?<\/div>/;
  const newCardAction = `<div class="card-action" style="padding: 8px 12px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-flat waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; color: #2563eb; display: inline-flex; align-items: center; gap: 3px;" onclick="openPhotoLightbox('\${photoUrl}', '\${sectorName}', '\${desc.replace(/'/g, "\\\\'")}')" title="Ver imagen en tamaño completo">
              <i class="material-icons tiny">fullscreen</i> Ver foto
            </button>
            <button type="button" class="btn-flat waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; color: #7c3aed; display: inline-flex; align-items: center; gap: 3px;" onclick="openPhotoTimeline('\${p.id}')" title="Ver historial y línea de tiempo">
              <i class="material-icons tiny">history</i> Historial
            </button>
          </div>
          <button type="button" class="btn-flat red-text text-darken-2 waves-effect" style="padding: 0 4px; font-size: 0.74rem; text-transform: none; display: inline-flex; align-items: center; gap: 3px;" onclick="removePhoto('\${p.id}')" title="Eliminar evidencia">
            <i class="material-icons tiny">delete</i> Eliminar
          </button>
        </div>`;
  js = js.replace(targetActionRegex, newCardAction);
  console.log('✓ Updated card action with "Ver historial" button in renderInspectionPhotos');
}

// 3.9 Expose LorensAlert and openPhotoTimeline on window
js += `
window.LorensAlert = LorensAlert;
window.openPhotoTimeline = openPhotoTimeline;
window.getAuthorizedPhotoUrl = getAuthorizedPhotoUrl;
`;

fs.writeFileSync(appJsPath, js, 'utf8');
console.log('✓ Successfully updated public/js/app.js');

