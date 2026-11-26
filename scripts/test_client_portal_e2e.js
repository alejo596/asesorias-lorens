const http = require('http');
const app = require('../server');

async function runClientPortalTests() {
  console.log('=================================================================');
  console.log('--- TEST END-TO-END: PORTAL DEL CLIENTE (ASESORÍAS LORENS) ---');
  console.log('=================================================================');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Servidor de prueba escuchando en ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: Autenticación del Cliente (Rechazos y Éxitos)
    // -------------------------------------------------------------
    console.log('[1] Probando autenticación del cliente...');
    
    // 1.A Credenciales incorrectas
    const badLoginRes = await fetch(`${baseUrl}/api/client/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'juan.perez@gmail.com', password: 'PasswordErroneo!' })
    });
    if (badLoginRes.status !== 401) {
      throw new Error(`Se esperaba status 401 para credenciales inválidas, se obtuvo ${badLoginRes.status}`);
    }
    console.log('✓ Credenciales incorrectas rechazadas con HTTP 401.');

    // 1.B Cuenta sin rol cliente (ej. inspector en portal cliente)
    const staffLoginRes = await fetch(`${baseUrl}/api/client/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inspector@lorens.cl', password: 'Admin2026!' })
    });
    if (staffLoginRes.status !== 403) {
      throw new Error(`Se esperaba status 403 para cuenta que no es cliente, se obtuvo ${staffLoginRes.status}`);
    }
    console.log('✓ Cuenta de inspector rechazada en login de clientes con HTTP 403.');

    // 1.C REGLA ESTRICTA: Cuenta cliente intentando ingresar por login de personal operativo (staff)
    const clientOnStaffLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'juan.perez@gmail.com', password: 'Cliente2026!' })
    });
    if (clientOnStaffLoginRes.status !== 403) {
      throw new Error(`Se esperaba HTTP 403 para cliente intentando entrar al login staff, se obtuvo ${clientOnStaffLoginRes.status}`);
    }
    console.log('✓ Cuenta cliente rechazada en login de personal operativo con HTTP 403 (separación estricta de roles).');

    // 1.D Login exitoso como Juan Pérez (Asegurado)
    const loginJuanRes = await fetch(`${baseUrl}/api/client/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'juan.perez@gmail.com', password: 'Cliente2026!' })
    });
    const juanData = await loginJuanRes.json();
    if (loginJuanRes.status !== 200 || !juanData.token) {
      throw new Error(`Login de Juan Pérez falló: ${loginJuanRes.status} ${JSON.stringify(juanData)}`);
    }
    const tokenJuan = juanData.token;
    console.log(`✓ Login exitoso de cliente: ${juanData.user.nombre} (${juanData.user.email}) - Rol: ${juanData.user.rol}`);

    // Verificar que el cliente NUNCA tenga doble perfil ni rol inspector
    if (juanData.user.doble_perfil !== false) {
      throw new Error('Fallo de seguridad: Un cliente no puede tener doble_perfil habilitado.');
    }
    if (juanData.user.roles.includes('inspector') || juanData.user.roles.includes('admin')) {
      throw new Error('Fallo de seguridad: Un cliente no puede tener roles de inspector ni admin.');
    }
    console.log('✓ Verificado: Cliente tiene doble_perfil = false y roles = [\'cliente\'] (no puede ser inspector).');

    const authHeadersJuan = { 'Authorization': `Bearer ${tokenJuan}` };

    // 1.E Intento de cliente de acceder a endpoints operativos de /api/cases
    const clientAccessStaffApiRes = await fetch(`${baseUrl}/api/cases`, { headers: authHeadersJuan });
    if (clientAccessStaffApiRes.status !== 403) {
      throw new Error(`Se esperaba HTTP 403 para cliente accediendo a /api/cases, se obtuvo ${clientAccessStaffApiRes.status}`);
    }
    console.log('✓ Acceso denegado a endpoints operativos (/api/cases) para token de cliente: HTTP 403.');

    // -------------------------------------------------------------
    // PRUEBA 2: Perfil y Consulta de Expedientes Propios con KPIs
    // -------------------------------------------------------------
    console.log('\n[2] Consultando perfil y expedientes autorizados de Juan Pérez...');
    
    // Perfil
    const meRes = await fetch(`${baseUrl}/api/client/me`, { headers: authHeadersJuan });
    const meData = await meRes.json();
    if (meRes.status !== 200 || meData.user.email !== 'juan.perez@gmail.com') {
      throw new Error(`GET /api/client/me falló: ${JSON.stringify(meData)}`);
    }
    console.log(`✓ Perfil verificado en /api/client/me: ID ${meData.user.id}, Nombre: ${meData.user.nombre}`);

    // Lista de expedientes y KPIs
    const casesRes = await fetch(`${baseUrl}/api/client/cases`, { headers: authHeadersJuan });
    const casesData = await casesRes.json();
    if (casesRes.status !== 200 || !Array.isArray(casesData.cases)) {
      throw new Error(`GET /api/client/cases falló: ${casesRes.status}`);
    }
    console.log(`✓ Expedientes recibidos: ${casesData.cases.length} casos. KPIs calculados desde PostgreSQL:`, casesData.kpis);
    if (casesData.kpis.total === undefined || casesData.kpis.en_proceso === undefined) {
      throw new Error('Estructura de KPIs inválida');
    }

    const juanCase = casesData.cases[0];
    console.log(`✓ Expediente del cliente: ${juanCase.codigo} - Siniestro: ${juanCase.numero_siniestro || 'S/N'} - Etapa: ${juanCase.etapa_nombre} (Orden: ${juanCase.etapa_orden}) - Timeline Habilitado: ${juanCase.timeline_habilitado}`);

    // -------------------------------------------------------------
    // PRUEBA 3: Seguridad y Aislamiento Estricto entre Clientes
    // -------------------------------------------------------------
    console.log('\n[3] Probando aislamiento estricto (prevención de acceso a casos ajenos)...');
    
    // Login como María González
    const loginMariaRes = await fetch(`${baseUrl}/api/client/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria.gonzalez@gmail.com', password: 'Cliente2026!' })
    });
    const mariaData = await loginMariaRes.json();
    const tokenMaria = mariaData.token;
    const authHeadersMaria = { 'Authorization': `Bearer ${tokenMaria}` };
    console.log(`✓ Sesión obtenida para María González (${mariaData.user.email})`);

    // Juan intenta consultar el expediente de María (SIS-2026-085, ID d0000000-0000-0000-0000-000000000002)
    const mariaCaseId = 'd0000000-0000-0000-0000-000000000002';
    const forbiddenRes = await fetch(`${baseUrl}/api/client/cases/${mariaCaseId}`, { headers: authHeadersJuan });
    if (forbiddenRes.status !== 404 && forbiddenRes.status !== 403) {
      throw new Error(`Vulnerabilidad de IDOR: Juan Pérez pudo consultar expediente de María González! Status: ${forbiddenRes.status}`);
    }
    console.log(`✓ Acceso denegado a expediente ajeno verificado: HTTP ${forbiddenRes.status}`);

    // -------------------------------------------------------------
    // PRUEBA 4: Regla de Habilitación de Línea de Tiempo (Antes vs Después de Evidencia)
    // -------------------------------------------------------------
    console.log('\n[4] Probando regla obligatoria de habilitación de la Línea de Tiempo...');

    // 4.A Caso de María González (SIS-2026-085 en 'visita_programada', orden 3 < 5)
    console.log('   4.A: Consultando timeline de caso SIS-2026-085 (etapa previa a Evidencia)...');
    const mariaTimelineRes = await fetch(`${baseUrl}/api/client/cases/${mariaCaseId}/timeline`, { headers: authHeadersMaria });
    if (mariaTimelineRes.status !== 403) {
      throw new Error(`Se esperaba HTTP 403 por timeline bloqueado antes de Evidencia, se obtuvo ${mariaTimelineRes.status}`);
    }
    const mariaTimelineData = await mariaTimelineRes.json();
    console.log(`   ✓ Timeline bloqueado correctamente: "${mariaTimelineData.mensaje}" (Etapa actual: ${mariaTimelineData.etapa_actual})`);

    // 4.B Caso de Juan Pérez (SIS-2026-084 en 'evidencia', orden 5 >= 5)
    console.log('   4.B: Consultando timeline de caso SIS-2026-084 (etapa Evidencia alcanzada)...');
    const juanCaseId = 'd0000000-0000-0000-0000-000000000001';
    const juanTimelineRes = await fetch(`${baseUrl}/api/client/cases/${juanCaseId}/timeline`, { headers: authHeadersJuan });
    if (juanTimelineRes.status !== 200) {
      throw new Error(`Se esperaba HTTP 200 para timeline en Evidencia, se obtuvo ${juanTimelineRes.status}`);
    }
    const juanTimelineData = await juanTimelineRes.json();
    if (!juanTimelineData.habilitado || !Array.isArray(juanTimelineData.etapas)) {
      throw new Error('Estructura de timeline inválida');
    }
    console.log(`   ✓ Timeline habilitado exitosamente! Total de etapas oficiales: ${juanTimelineData.etapas.length}`);
    if (juanTimelineData.etapas.length !== 9) {
      throw new Error(`Se esperaban 9 etapas oficiales, pero hay ${juanTimelineData.etapas.length}`);
    }

    console.log('   ✓ Estado de las 9 etapas para Juan Pérez:');
    juanTimelineData.etapas.forEach(st => {
      console.log(`      - [Etapa ${st.orden}] ${st.nombre} -> Estado: ${st.estado.toUpperCase()}${st.es_etapa_actual ? ' (ETAPA ACTUAL)' : ''}`);
    });

    // -------------------------------------------------------------
    // PRUEBA 5: Evidencias Fotográficas Autorizadas para el Cliente
    // -------------------------------------------------------------
    console.log('\n[5] Consultando evidencias fotográficas autorizadas...');
    const evidenceRes = await fetch(`${baseUrl}/api/client/cases/${juanCaseId}/evidence`, { headers: authHeadersJuan });
    if (evidenceRes.status !== 200) {
      throw new Error(`Error al consultar evidencias del cliente: HTTP ${evidenceRes.status}`);
    }
    const evidencePhotos = await evidenceRes.json();
    console.log(`✓ Fotografías autorizadas recuperadas: ${evidencePhotos.length} fotos`);

    if (evidencePhotos.length > 0) {
      const firstPhoto = evidencePhotos[0];
      console.log(`✓ Primera evidencia autorizada: ID ${firstPhoto.id}, Sector: ${firstPhoto.sector}, Desc: ${firstPhoto.descripcion}`);

      // Streaming de imagen autorizada con Bearer header
      const streamRes = await fetch(`${baseUrl}${firstPhoto.url}`, { headers: authHeadersJuan });
      if (streamRes.status !== 200) {
        throw new Error(`Error en streaming de foto cliente con Bearer: HTTP ${streamRes.status}`);
      }
      const photoBytes = await streamRes.arrayBuffer();
      console.log(`✓ Streaming de imagen exitoso con Bearer header: HTTP 200, Content-Type: ${streamRes.headers.get('content-type')}, Bytes: ${photoBytes.byteLength}`);

      // Streaming de imagen simulando tag <img> (vía query token)
      const imgTagRes = await fetch(`${baseUrl}${firstPhoto.url}?token=${encodeURIComponent(tokenJuan)}`);
      if (imgTagRes.status !== 200) {
        throw new Error(`Error en streaming vía tag <img> (?token=): HTTP ${imgTagRes.status}`);
      }
      console.log(`✓ Streaming de imagen exitoso vía tag <img> (?token=): HTTP 200, Content-Type: ${imgTagRes.headers.get('content-type')}`);
    }

    // -------------------------------------------------------------
    // PRUEBA 6: Verificación de No Revelación de Información Financiera
    // -------------------------------------------------------------
    console.log('\n[6] Verificando protección de datos financieros internos...');
    const detailRes = await fetch(`${baseUrl}/api/client/cases/${juanCaseId}`, { headers: authHeadersJuan });
    const detailData = await detailRes.json();
    if (detailData.porcentaje_gg !== undefined || detailData.costo_directo !== undefined || detailData.total_presupuesto !== undefined) {
      throw new Error('Fallo de confidencialidad: se expuso información financiera interna al cliente.');
    }
    console.log('✓ Verificado: No se expone ningún dato financiero interno (costo directo, GG, utilidad o presupuestos de liquidación).');

    // -------------------------------------------------------------
    // PRUEBA 7: Preservación de Accesos de Inspector y Administrador
    // -------------------------------------------------------------
    console.log('\n[7] Verificando que perfiles de Inspector y Administrador permanecen operativos...');
    const inspectorLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inspector@lorens.cl', password: 'Admin2026!' })
    });
    if (inspectorLogin.status !== 200) {
      throw new Error(`Login de inspector falló: HTTP ${inspectorLogin.status}`);
    }
    console.log('✓ Inspector Pedro Pérez autenticado correctamente (rol inspector).');

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@lorens.cl', password: 'Admin2026!' })
    });
    if (adminLogin.status !== 200) {
      throw new Error(`Login de administrador falló: HTTP ${adminLogin.status}`);
    }
    console.log('✓ Administrador Alejandro Vargas autenticado correctamente (rol admin).');

    // -------------------------------------------------------------
    // PRUEBA 8: Restricción PostgreSQL (chk_cliente_rol_exclusivo)
    // -------------------------------------------------------------
    console.log('\n[8] Verificando restricción a nivel de base de datos PostgreSQL...');
    const db = require('../config/database');
    let dbRejected = false;
    try {
      // Intento de asignar doble_perfil = TRUE o rol inspector a un cliente
      await db.query(`UPDATE usuario SET doble_perfil = TRUE WHERE email = 'juan.perez@gmail.com'`);
    } catch (dbErr) {
      dbRejected = true;
      console.log(`✓ PostgreSQL rechazó violación de restricción chk_cliente_rol_exclusivo: ${dbErr.message}`);
    }
    if (!dbRejected) {
      throw new Error('Fallo crítico: PostgreSQL permitió asignar doble_perfil = TRUE a un usuario con rol cliente.');
    }

    let rolesRejected = false;
    try {
      // Intento de agregar rol 'inspector' al array de roles de un cliente
      await db.query(`UPDATE usuario SET roles = ARRAY['cliente', 'inspector'] WHERE email = 'juan.perez@gmail.com'`);
    } catch (dbErr) {
      rolesRejected = true;
      console.log(`✓ PostgreSQL rechazó violación de roles combinados (cliente + inspector): ${dbErr.message}`);
    }
    if (!rolesRejected) {
      throw new Error('Fallo crítico: PostgreSQL permitió combinar roles de cliente e inspector.');
    }

    console.log('\n=================================================================');
    console.log('¡TODAS LAS PRUEBAS DEL PORTAL DEL CLIENTE PASARON CON ÉXITO (100% OK)!');
    console.log('=================================================================\n');
  } finally {
    server.close();
  }
  process.exit(0);
}

runClientPortalTests().catch(err => {
  console.error('\n❌ ERROR EN TEST DE PORTAL DEL CLIENTE:', err);
  process.exit(1);
});

