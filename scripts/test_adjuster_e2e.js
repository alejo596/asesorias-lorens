const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    const headers = { ...defaultHeaders, ...(options.headers || {}) };
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = body;
          }
          resolve({ status: res.status, statusCode: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('  TEST E2E: MÓDULO AJUSTADOR Y PRESUPUESTO DE REPARACIÓN');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition, extraInfo = '') {
    total++;
    if (condition) {
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${total}] FALLÓ: ${name} ${extraInfo}`);
    }
  }

  try {
    // 1. Login con credenciales de Ajustador
    console.log('[FASE 1] Autenticación y RBAC...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'ajustador@lorens.cl', password: 'Password123!' }
    });
    assert('Login de Ajustador exitoso', loginRes.statusCode === 200 && loginRes.body.token);
    const adjusterToken = loginRes.body?.token;
    const authHeaders = { Authorization: `Bearer ${adjusterToken}` };

    // 2. Inspector debe ser rechazado con 403 (Seguridad RBAC)
    const inspectorLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'inspector@lorens.cl', password: 'Admin2026!' }
    });
    const inspectorHeaders = { Authorization: `Bearer ${inspectorLogin.body?.token}` };
    const inspectorAttempt = await request('/api/adjuster/dashboard', { headers: inspectorHeaders });
    assert(
      'Inspector bloqueado con HTTP 403 en endpoints del Ajustador',
      inspectorAttempt.statusCode === 403,
      `Status: ${inspectorAttempt.statusCode}`
    );

    // 3. Admin login
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@lorens.cl', password: 'Admin2026!' }
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.body?.token}` };

    // 4. Dashboard KPIs del Ajustador
    console.log('\n[FASE 2] Dashboard del Ajustador (6 KPIs dinámicos)...');
    const dashRes = await request('/api/adjuster/dashboard', { headers: authHeaders });
    assert('Dashboard retorna HTTP 200', dashRes.statusCode === 200);
    const kpis = dashRes.body?.kpis || {};
    assert('KPI: expedientes_asignados es numérico', typeof kpis.expedientes_asignados === 'number');
    assert('KPI: pendientes_cuantificacion es numérico', typeof kpis.pendientes_cuantificacion === 'number');
    assert('KPI: en_cuantificacion es numérico', typeof kpis.en_cuantificacion === 'number');
    assert('KPI: presupuestos_terminados es numérico', typeof kpis.presupuestos_terminados === 'number');
    assert('KPI: partidas_valorizadas es numérico', typeof kpis.partidas_valorizadas === 'number');
    assert('KPI: presupuestos_observados es numérico', typeof kpis.presupuestos_observados === 'number');

    // 5. Listado de expedientes en DataTable
    console.log('\n[FASE 3] DataTable de Expedientes...');
    const casesRes = await request('/api/adjuster/cases', { headers: authHeaders });
    assert('DataTable retorna HTTP 200 y array de casos', casesRes.statusCode === 200 && Array.isArray(casesRes.body.data));
    const testCase = casesRes.body.data[0];
    assert('Existe al menos un expediente asignado para cuantificar', !!testCase);
    const caseId = testCase.id;

    // 6. Catálogo de procesos constructivos (Excel 11 procesos)
    console.log('\n[FASE 4] Catálogo de Procesos Constructivos...');
    const catRes = await request('/api/adjuster/catalog/processes', { headers: authHeaders });
    assert('Catálogo de procesos retorna HTTP 200', catRes.statusCode === 200 && Array.isArray(catRes.body.data));
    assert('Catálogo contiene procesos del Excel (mínimo 10)', catRes.body.data.length >= 10);
    const sampleProcess = catRes.body.data.find(p => p.codigo === 'REP_FISURA') || catRes.body.data[0];

    // 7. Ficha de Cuantificación (Lectura de caso, levantamiento inspector y presupuesto)
    console.log('\n[FASE 5] Ficha de Cuantificación y Separación de Zonas...');
    const detailRes = await request(`/api/adjuster/cases/${caseId}`, { headers: authHeaders });
    assert('Detalle de caso retorna HTTP 200', detailRes.statusCode === 200);
    assert('Zona A: contiene daños del levantamiento del inspector (solo lectura)', Array.isArray(detailRes.body.inspector_damages));
    assert('Zona B: contiene presupuesto y lista de partidas', detailRes.body.budget && Array.isArray(detailRes.body.items));
    assert('Zona C: presupuesto contiene estructura de liquidación financiera', typeof detailRes.body.budget.costo_directo !== 'undefined');

    // 8. Agregar Partida Constructiva
    console.log('\n[FASE 6] Cuantificación y Valorización de Partidas...');
    const addRes = await request(`/api/adjuster/cases/${caseId}/items`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        sector_nombre: 'LIVING COMEDOR',
        proceso_constructivo: 'Reparación de fisura',
        dano_asociado: 'Fisura diagonal en tabique',
        unidad_medida: 'ml',
        cantidad: 4.5,
        precio_unitario: 12500,
        tipo: 'partida'
      }
    });
    assert('Agregar partida constructiva retorna HTTP 201', addRes.statusCode === 201);
    const newItem = addRes.body.data;
    assert('Subtotal calculado correctamente (4.5 * 12500 = 56250)', Number(newItem.subtotal) === 56250);

    // 9. Actualizar precio unitario y cantidad
    const updateRes = await request(`/api/adjuster/items/${newItem.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: {
        cantidad: 5.0,
        precio_unitario: 15000
      }
    });
    assert('Actualizar partida retorna HTTP 200', updateRes.statusCode === 200);
    assert('Subtotal recalculado correctamente (5.0 * 15000 = 75000)', Number(updateRes.body.data.subtotal) === 75000);

    // 10. Verificación Matemática de Liquidación (Fórmulas Excel)
    console.log('\n[FASE 7] Fórmulas Financieras de Liquidación (Excel)...');
    const checkRes = await request(`/api/adjuster/cases/${caseId}`, { headers: authHeaders });
    const b = checkRes.body.budget;
    const items = checkRes.body.items;
    const expectedDirecto = items.reduce((sum, it) => sum + Math.round(Number(it.cantidad) * Number(it.precio_unitario)), 0);
    const expectedGG = Math.round(expectedDirecto * 0.25);
    const expectedNeto = expectedDirecto + expectedGG;
    const expectedIva = Math.round(expectedNeto * 0.19);
    const expectedTotal = expectedNeto + expectedIva;

    assert('Costo Directo coincide con la suma de subtotales', Math.abs(Number(b.costo_directo) - expectedDirecto) <= 2);
    assert('Gastos Generales y Utilidades (25%) calculado correctamente', Math.abs(Number(b.gastos_generales) - expectedGG) <= 2);
    assert('Neto = Costo Directo + GG', Math.abs(Number(b.subtotal_neto) - expectedNeto) <= 2);
    assert('IVA 19% calculado correctamente', Math.abs(Number(b.iva) - expectedIva) <= 2);
    assert('TOTAL = Neto + IVA', Math.abs(Number(b.total) - expectedTotal) <= 2);

    // 11. Guardar Borrador
    console.log('\n[FASE 8] Flujo de Estados del Presupuesto...');
    const draftRes = await request(`/api/adjuster/cases/${caseId}/save-draft`, {
      method: 'POST',
      headers: authHeaders,
      body: { factor_gg: 0.25 }
    });
    assert('Guardar borrador retorna HTTP 200', draftRes.statusCode === 200);

    // 12. Enviar a Revisión
    const reviewRes = await request(`/api/adjuster/cases/${caseId}/submit-review`, {
      method: 'POST',
      headers: authHeaders
    });
    assert('Enviar a revisión cambia estado a "enviado_revision"', reviewRes.statusCode === 200 && reviewRes.body.data?.estado === 'enviado_revision');

    // 13. Administrador Observa Presupuesto
    const obsRes = await request(`/api/adjuster/cases/${caseId}/observe`, {
      method: 'POST',
      headers: adminHeaders,
      body: { observacion: 'Revisar metraje de pintura en paño living y justificar flete.' }
    });
    assert('Admin observa presupuesto con feedback técnico', obsRes.statusCode === 200 && obsRes.body.data?.estado === 'observado');

    // 14. Ajustador reenvía y Administrador Aprueba Presupuesto
    await request(`/api/adjuster/cases/${caseId}/submit-review`, { method: 'POST', headers: authHeaders });
    const appRes = await request(`/api/adjuster/cases/${caseId}/approve`, {
      method: 'POST',
      headers: adminHeaders
    });
    assert('Admin aprueba presupuesto pericial oficialmente', appRes.statusCode === 200 && appRes.body.data?.estado === 'aprobado');

    // 15. Exportación a Excel (.xlsx) nativo
    console.log('\n[FASE 9] Exportación de Documentos...');
    const excelRes = await request(`/api/adjuster/cases/${caseId}/export/excel`, { headers: authHeaders });
    assert(
      'Exportación Excel (.xlsx) retorna HTTP 200 y Content-Type de hoja de cálculo',
      excelRes.statusCode === 200 &&
      excelRes.headers['content-type']?.includes('spreadsheetml')
    );

    // 16. Exportación a PDF pericial
    const pdfRes = await request(`/api/adjuster/cases/${caseId}/export/pdf`, { headers: authHeaders });
    assert(
      'Exportación PDF retorna HTTP 200 y Content-Type application/pdf',
      pdfRes.statusCode === 200 &&
      pdfRes.headers['content-type']?.includes('pdf')
    );

    console.log('\n===============================================================');
    console.log(`  RESUMEN: ${passed} de ${total} pruebas superadas con éxito (${Math.round((passed/total)*100)}%)`);
    console.log('===============================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('ERROR EN SUITE DE PRUEBAS:', err);
    process.exit(1);
  }
}

runTests();
