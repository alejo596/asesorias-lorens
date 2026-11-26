const db = require('../config/database');
const queries = require('../models/dbQueries');
const { calculateBudgetSummary, mockCases, mockLines, mockExpenses, mockSnapshots } = require('./caseController');

// POST /api/cases/:caseId/snapshots - Generar congelamiento inmutable (Snapshot)
exports.createSnapshot = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { supervisor_aprobador, es_valorizado } = req.body;

    let expediente, lines, expenses;

    try {
      const caseRes = await db.query(queries.GET_CASE_BY_ID, [caseId]);
      if (caseRes.rows.length === 0) return res.status(404).json({ error: 'Expediente no encontrado.' });
      expediente = caseRes.rows[0];

      const linesRes = await db.query(queries.GET_LINES_BY_CASE, [caseId]);
      lines = linesRes.rows;

      const expensesRes = await db.query(queries.GET_EXPENSES_BY_CASE, [caseId]);
      expenses = expensesRes.rows;
    } catch (dbErr) {
      expediente = mockCases.find(c => c.id === caseId || c.codigo === caseId) || mockCases[0];
      lines = mockLines.filter(l => l.expediente_id === expediente.id);
      expenses = mockExpenses.filter(e => e.expediente_id === expediente.id);
    }

    const { processedLines, processedExpenses, summary } = calculateBudgetSummary(expediente, lines, expenses);

    const countSnapshots = mockSnapshots.filter(s => s.expediente_id === caseId).length + 1;
    const correlativo = `${expediente.codigo}-I-${String(countSnapshots).padStart(3, '0')}`;

    const snapshotData = {
      expediente_id: expediente.id,
      correlativo,
      es_valorizado: es_valorizado !== undefined ? es_valorizado : true,
      costo_directo: summary.totalDirect,
      gastos_generales: summary.gg,
      utilidad: summary.profit,
      subtotal_neto: summary.netSubtotal,
      iva: summary.tax,
      total_presupuesto: summary.grandTotal,
      snapshot_json: JSON.stringify({
        expediente,
        lines: processedLines,
        expenses: processedExpenses,
        summary,
        congelado_en: new Date().toISOString(),
        aprobador: supervisor_aprobador || 'Supervisor Técnico'
      }),
      supervisor_aprobador: supervisor_aprobador || 'Supervisor Técnico',
    };

    try {
      const result = await db.query(queries.INSERT_SNAPSHOT, [
        snapshotData.expediente_id, snapshotData.correlativo, snapshotData.es_valorizado,
        snapshotData.costo_directo, snapshotData.gastos_generales, snapshotData.utilidad,
        snapshotData.subtotal_neto, snapshotData.iva, snapshotData.total_presupuesto,
        snapshotData.snapshot_json, snapshotData.supervisor_aprobador
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (dbErr) {
      const newSnapshot = {
        id: 'snap-' + Date.now(),
        ...snapshotData,
        emitido_en: new Date().toISOString()
      };
      mockSnapshots.push(newSnapshot);
      return res.status(201).json(newSnapshot);
    }
  } catch (error) {
    console.error('Error al emitir snapshot:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/cases/:caseId/snapshots - Listar snapshots del expediente
exports.getSnapshots = async (req, res) => {
  try {
    const { caseId } = req.params;
    try {
      const result = await db.query(queries.GET_SNAPSHOTS_BY_CASE, [caseId]);
      return res.json(result.rows);
    } catch (dbErr) {
      const snaps = mockSnapshots.filter(s => s.expediente_id === caseId);
      return res.json(snaps);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

