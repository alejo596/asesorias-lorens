const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');

async function runTests() {
  console.log('--- INICIANDO TEST END-TO-END: MÓDULO INSPECTOR 100% DINÁMICO ---');

  // Start server on an ephemeral port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Servidor de prueba escuchando en ${baseUrl}`);

  try {
    // 1. Login como Inspector Pedro Pérez
    console.log('\n[1] Autenticación Inspector...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inspector@lorens.cl', password: 'Admin2026!' })
    });

    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login falló con status ${loginRes.status}: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.token;
    const inspector = loginData.user;
    console.log(`✓ Token JWT obtenido para ${inspector.nombre} (ID: ${inspector.id}, Rol: ${inspector.rol})`);

    const authHeaders = {
      'Authorization': `Bearer ${token}`
    };

    // 2. Consulta de KPIs Operativos
    console.log('\n[2] Consultando KPIs operativos del Inspector (/api/cases/assigned/kpis)...');
    const kpiRes = await fetch(`${baseUrl}/api/cases/assigned/kpis`, { headers: authHeaders });
    const kpiData = await kpiRes.json();

    if (kpiRes.status !== 200) {
      throw new Error(`Error en KPIs: ${kpiRes.status} ${JSON.stringify(kpiData)}`);
    }
    console.log('✓ KPIs recibidos desde PostgreSQL:', kpiData);
    if (kpiData.asignados === undefined || kpiData.danos === undefined) {
      throw new Error('Formato de KPIs incorrecto');
    }

    // 3. Consulta de Expedientes Asignados con Paginación
    console.log('\n[3] Consultando expedientes asignados con paginación (/api/cases/assigned?page=1&limit=2)...');
    const assignedRes = await fetch(`${baseUrl}/api/cases/assigned?page=1&limit=2`, { headers: authHeaders });
    const assignedData = await assignedRes.json();

    if (assignedRes.status !== 200 || !assignedData.pagination) {
      throw new Error(`Error en expedientes asignados: ${assignedRes.status} ${JSON.stringify(assignedData)}`);
    }
    console.log(`✓ Expedientes devueltos: ${assignedData.data.length}, Total en BD: ${assignedData.pagination.total}, Páginas: ${assignedData.pagination.totalPages}`);
    const firstCase = assignedData.data[0];
    console.log(`✓ Primer expediente: ${firstCase.codigo} - ${firstCase.cliente_nombre} - Estado: ${firstCase.estado} - Avance: ${firstCase.avance_porcentaje}%`);

    const caseId = firstCase.id;

    // 4. Detalle Completo del Expediente
    console.log(`\n[4] Consultando detalle del expediente ${firstCase.codigo} (${caseId})...`);
    const detailRes = await fetch(`${baseUrl}/api/cases/${caseId}`, { headers: authHeaders });
    const detailData = await detailRes.json();

    if (detailRes.status !== 200) {
      throw new Error(`Error en detalle de expediente: ${detailRes.status}`);
    }
    console.log(`✓ Detalle recibido: ${detailData.sectors.length} sectores, ${detailData.lines.length} partidas, ${detailData.photos.length} fotos`);

    // 5. Crear un nuevo sector en PostgreSQL
    console.log(`\n[5] Creando nuevo sector en expediente ${caseId}...`);
    const sectorName = `PATIO E2E ${Date.now() % 1000}`;
    const createSectorRes = await fetch(`${baseUrl}/api/cases/${caseId}/sectors`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: sectorName, descripcion: 'Sector creado en prueba E2E automatizada' })
    });
    const newSector = await createSectorRes.json();

    if (createSectorRes.status !== 201 || !newSector.id) {
      throw new Error(`Error al crear sector: ${createSectorRes.status} ${JSON.stringify(newSector)}`);
    }
    console.log(`✓ Sector creado en PostgreSQL: ID ${newSector.id}, Nombre: "${newSector.nombre}"`);

    // 6. Subir Fotografía Física Real con Multer
    console.log(`\n[6] Subiendo evidencia fotográfica real (Multer + Storage físico)...`);
    // JPEG 1x1 buffer
    const sampleJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    
    // Construct FormData using standard Node 18+ FormData & Blob
    const formData = new FormData();
    const blob = new Blob([sampleJpg], { type: 'image/jpeg' });
    formData.append('foto', blob, 'foto_test_e2e.jpg');
    formData.append('sector', newSector.nombre);
    formData.append('sector_id', newSector.id);
    formData.append('descripcion', 'Foto de prueba E2E de muro afectado');

    const uploadRes = await fetch(`${baseUrl}/api/cases/${caseId}/photos/upload`, {
      method: 'POST',
      headers: authHeaders, // FormData sets its own multipart Content-Type
      body: formData
    });
    const uploadedPhoto = await uploadRes.json();

    if (uploadRes.status !== 201 || !uploadedPhoto.id) {
      throw new Error(`Error al subir foto: ${uploadRes.status} ${JSON.stringify(uploadedPhoto)}`);
    }
    console.log(`✓ Fotografía guardada: ID ${uploadedPhoto.id}, Ruta: ${uploadedPhoto.ruta_almacenamiento}, URL: ${uploadedPhoto.url}`);

    // Verificar que el archivo existe físicamente en el disco
    const diskPath = path.join(__dirname, '..', 'storage', uploadedPhoto.ruta_almacenamiento);
    if (!fs.existsSync(diskPath)) {
      throw new Error(`El archivo físico no se encuentra en el disco: ${diskPath}`);
    }
    console.log(`✓ Archivo físico verificado en disco: ${diskPath} (${fs.statSync(diskPath).size} bytes)`);

    // 7. Descargar y transmitir archivo por streaming con JWT (tanto con header como con query token para tags <img>)
    console.log(`\n[7] Streaming del archivo protegido (/api/cases/${caseId}/photos/${uploadedPhoto.id}/file)...`);
    const streamRes = await fetch(`${baseUrl}/api/cases/${caseId}/photos/${uploadedPhoto.id}/file`, {
      headers: authHeaders
    });

    if (streamRes.status !== 200) {
      throw new Error(`Error en streaming de foto: ${streamRes.status}`);
    }
    const photoBytes = await streamRes.arrayBuffer();
    console.log(`✓ Streaming exitoso con Bearer header: HTTP ${streamRes.status}, Content-Type: ${streamRes.headers.get('content-type')}, Bytes: ${photoBytes.byteLength}`);

    // Prueba idéntica a tag <img> del navegador (sin Authorization header, solo query token)
    console.log(`\n[7.B] Streaming simulando tag <img> (sin headers, usando ?token=...)...`);
    const imgTagRes = await fetch(`${baseUrl}/api/cases/${caseId}/photos/${uploadedPhoto.id}/file?token=${encodeURIComponent(token)}`);
    if (imgTagRes.status !== 200) {
      const errBody = await imgTagRes.text();
      throw new Error(`Error en streaming de foto vía tag <img> (?token=): HTTP ${imgTagRes.status} - ${errBody}`);
    }
    const imgBytes = await imgTagRes.arrayBuffer();
    console.log(`✓ Streaming exitoso para tag <img> vía query token: HTTP ${imgTagRes.status}, Content-Type: ${imgTagRes.headers.get('content-type')}, Bytes: ${imgBytes.byteLength}`);

    // 7.C: Verificar Timeline / Historial de Evidencia en PostgreSQL
    console.log(`\n[7.C] Consultando Timeline de evidencia (/api/cases/${caseId}/photos/${uploadedPhoto.id}/timeline)...`);
    const timelineRes = await fetch(`${baseUrl}/api/cases/${caseId}/photos/${uploadedPhoto.id}/timeline`, {
      headers: authHeaders
    });
    if (timelineRes.status !== 200) {
      throw new Error(`Error al consultar timeline: HTTP ${timelineRes.status}`);
    }
    const timelineData = await timelineRes.json();
    console.log(`✓ Timeline obtenido: ${timelineData.timeline.length} eventos históricos registrados para foto ID ${uploadedPhoto.id}:`);
    timelineData.timeline.forEach(ev => console.log(`   - [${ev.tipo_evento}] ${ev.descripcion} (${ev.usuario_nombre || 'Sistema'})`));
    if (timelineData.timeline.length < 2) {
      throw new Error(`Se esperaban al menos 2 eventos automáticos en la timeline de la foto, pero hay ${timelineData.timeline.length}`);
    }

    // 7.D: Agregar nuevo evento a la Timeline
    console.log(`\n[7.D] Registrando nuevo evento manual de auditoría en la Timeline...`);
    const addEventRes = await fetch(`${baseUrl}/api/cases/${caseId}/photos/${uploadedPhoto.id}/timeline`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_evento: 'REVISION_TECNICA',
        descripcion: 'Evidencia revisada y validada en terreno por inspector pericial',
        estado: 'VALIDADO'
      })
    });
    if (addEventRes.status !== 201) {
      throw new Error(`Error al agregar evento en timeline: HTTP ${addEventRes.status}`);
    }
    const addedEvent = await addEventRes.json();
    console.log(`✓ Evento agregado a timeline con éxito: ID ${addedEvent.id}, Tipo: ${addedEvent.tipo_evento}`);

    // 8. Crear una partida de daño asociada al sector
    console.log(`\n[8] Registrando partida de daño en PostgreSQL asociada al sector...`);
    const lineRes = await fetch(`${baseUrl}/api/cases/${caseId}/lines`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sector: newSector.nombre,
        sector_id: newSector.id,
        elemento: 'Muro exterior',
        dano_tipo: 'Grieta diagonal',
        descripcion_dano: 'Fisura producida por asentamiento diferencial',
        reparacion_propuesta: 'Inyección epóxica y enlucido',
        unidad_id: 'ml',
        metodo_calculo: 'direct',
        cantidad_directa: 4.5,
        precio_unitario_neto: 12500,
        modo_precio: 'complete'
      })
    });
    const createdLine = await lineRes.json();

    if (lineRes.status !== 201 || !createdLine.id) {
      throw new Error(`Error al crear partida: ${lineRes.status} ${JSON.stringify(createdLine)}`);
    }
    console.log(`✓ Partida registrada en PostgreSQL: ID ${createdLine.id}, Medida: ${createdLine.cantidad_medida} ml, Subtotal: $${createdLine.subtotal_neto}`);

    // 9. Guardar Observaciones Técnicas
    console.log(`\n[9] Guardando observaciones técnicas del expediente...`);
    const obsRes = await fetch(`${baseUrl}/api/cases/${caseId}/observations`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ observaciones: 'Observación pericial verificada en terreno durante el test E2E.' })
    });
    const obsData = await obsRes.json();

    if (obsRes.status !== 200) {
      throw new Error(`Error al guardar observaciones: ${obsRes.status}`);
    }
    console.log('✓ Observaciones guardadas correctamente en PostgreSQL:', obsData.message);

    // 10. Limpieza de datos de prueba
    console.log(`\n[10] Limpieza de elementos de prueba...`);
    // Eliminar partida
    await fetch(`${baseUrl}/api/lines/${createdLine.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('✓ Partida de prueba eliminada');

    // Eliminar foto (verifica borrado de DB y archivo en disco)
    await fetch(`${baseUrl}/api/cases/${caseId}/photos/${uploadedPhoto.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('✓ Fotografía de prueba eliminada de PostgreSQL');

    if (fs.existsSync(diskPath)) {
      throw new Error('El archivo físico debería haberse borrado del disco al eliminar la foto');
    }
    console.log('✓ Archivo físico confirmado como eliminado del disco storage/');

    // Eliminar sector
    await fetch(`${baseUrl}/api/cases/${caseId}/sectors/${newSector.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('✓ Sector de prueba eliminado de PostgreSQL');

    console.log('\n=============================================================');
    console.log('¡TODAS LAS PRUEBAS END-TO-END PASARON CON ÉXITO (100% OK)!');
    console.log('=============================================================\n');
  } finally {
    server.close();
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN TEST E2E:', err);
  process.exit(1);
});
