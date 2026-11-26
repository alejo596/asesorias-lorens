/**
 * ASESORÍAS LORENS - Visualizador y Renderizador de Presupuestos
 * Soporte Multi-dispositivo (Desktop & Móvil para Inspector) y Módulo Administrador
 */
const BudgetViewer = {
  activeSearchQuery: '',
  chartViewMode: 'financial', // 'financial' o 'sector'

  // Formateo de moneda CLP
  formatCLP(val) {
    if (val === null || val === undefined || isNaN(val)) return 'Pendiente';
    return '$' + Math.round(val).toLocaleString('es-CL');
  },

  // Formateo de números decimales (cantidades)
  formatQty(val) {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    return parseFloat(val).toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // Precio unitario normalizado: vacío o inválido equivale a PENDIENTE (null).
  unitPriceOf(line) {
    if (!line) return null;
    const raw = line.precio_unitario_neto;
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  },

  // Renderizar encabezado institucional del acta
  renderHeader(expediente) {
    if (!expediente) return;
    const setSafeText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || '-';
    };

    setSafeText('acta-liquidador-header', expediente.liquidador_nombre || 'SEGURED / COOPER');
    setSafeText('acta-caso', expediente.codigo || 'SIS-2026-084');
    setSafeText('acta-rut', expediente.cliente_rut || '12.345.678-9');
    setSafeText('acta-fecha-siniestro', expediente.fecha_evento || '31-05-2026');
    setSafeText('acta-fecha-visita', expediente.fecha_visita || '02-06-2026');
    setSafeText('acta-cliente', expediente.cliente_nombre || 'Juan Pérez');
    setSafeText('acta-email', expediente.cliente_email || 'INSPECTOR2@gmail.com');
    setSafeText('acta-inspector', (expediente.inspector_nombre || 'PEDRO PÉREZ').toUpperCase());
    setSafeText('acta-direccion', expediente.direccion || 'Av. Arturo Prat, 2043, Alto Hospicio');
    setSafeText('acta-ciudad', expediente.ciudad || 'Alto Hospicio');
    setSafeText('acta-tipo-evento', expediente.tipo_evento ? expediente.tipo_evento.toUpperCase() : 'SISMO');
    setSafeText('acta-poliza', expediente.numero_poliza || 'POL-99281-2026');
    setSafeText('acta-sistema', expediente.sistema_constructivo || 'Albañilería Confinada');
  },

  // Renderizar tabla del acta (Desktop) y Cards para celular (Móvil)
  renderTable(lines = [], expenses = []) {
    const tbody = document.getElementById('acta-table-body');
    const mobileCardsContainer = document.getElementById('acta-mobile-cards');
    
    if (tbody) tbody.innerHTML = '';
    if (mobileCardsContainer) mobileCardsContainer.innerHTML = '';

    const filter = (this.activeSearchQuery || '').toLowerCase().trim();

    // Filtrar partidas
    const filteredLines = lines.filter(l => {
      if (!filter) return true;
      const haystack = `${l.sector} ${l.elemento} ${l.dano_tipo} ${l.descripcion_dano} ${l.reparacion_propuesta}`.toLowerCase();
      return haystack.includes(filter);
    });

    // Agrupar partidas por sector
    const sectors = {};
    filteredLines.forEach(line => {
      const sec = line.sector || 'General';
      if (!sectors[sec]) sectors[sec] = [];
      sectors[sec].push(line);
    });

    // Si no hay resultados
    if (Object.keys(sectors).length === 0 && (!expenses || expenses.length === 0 || filter)) {
      if (filteredLines.length === 0) {
        const noResultHtml = `
          <div class="center-align grey-text" style="padding: 25px;">
            <i class="material-icons" style="font-size: 2rem; display: block; margin-bottom: 4px;">search_off</i>
            No se encontraron partidas para "<strong>${this.activeSearchQuery}</strong>"
          </div>
        `;
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">${noResultHtml}</td></tr>`;
        if (mobileCardsContainer) mobileCardsContainer.innerHTML = noResultHtml;
        return;
      }
    }

    // Renderizar cada sector
    Object.keys(sectors).forEach(secName => {
      const sectorLines = sectors[secName];
      let sectorSubtotal = 0;

      // Calcular subtotal del sector
      sectorLines.forEach(l => {
        const qty = l.finalQty !== undefined ? l.finalQty : (l.cantidad_medida || 0);
        const pu = this.unitPriceOf(l);
        sectorSubtotal += pu !== null ? Math.round(qty * pu) : 0;
      });

      // 1. Render Desktop Table Row
      if (tbody) {
        const headerTr = document.createElement('tr');
        headerTr.className = 'sector-header-row';
        headerTr.innerHTML = `
          <td colspan="5">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>
                <i class="material-icons left" style="font-size: 1.15rem; vertical-align: middle; margin-right: 6px; color: var(--amber-600);">meeting_room</i>
                <strong>SECTOR: ${secName.toUpperCase()}</strong>
                <span class="grey-text text-darken-1" style="font-size: 0.78rem; font-weight: normal; margin-left: 8px;">(${sectorLines.length} partidas)</span>
              </span>
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--navy-900);">
                Subtotal: ${this.formatCLP(sectorSubtotal)}
              </span>
            </div>
          </td>
        `;
        tbody.appendChild(headerTr);

        sectorLines.forEach(line => {
          const tr = document.createElement('tr');
          const qty = line.finalQty !== undefined ? line.finalQty : (line.cantidad_medida || 0);
          const pu = this.unitPriceOf(line);
          const subtotal = pu !== null ? Math.round(qty * pu) : 0;

          const puDisplay = pu !== null
            ? this.formatCLP(pu)
            : '<span class="amber-text text-darken-4 font-weight-bold" style="background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">PENDIENTE</span>';
          
          const subtotalDisplay = pu !== null
            ? this.formatCLP(subtotal)
            : '<span class="grey-text" style="font-size: 0.8rem;">Pendiente</span>';

          const structuralBadge = line.es_estructural
            ? '<span class="red-text text-darken-2" style="font-size: 0.72rem; font-weight: 700; background: #fee2e2; padding: 1px 5px; border-radius: 3px; margin-left: 6px;">ESTRUCTURAL</span>'
            : '';

          tr.innerHTML = `
            <td>
              <div style="font-weight: 700; color: var(--navy-900);">
                ${line.reparacion_propuesta || line.descripcion_dano}
                ${structuralBadge}
              </div>
              <div style="font-size: 0.78rem; color: var(--slate-500); margin-top: 2px;">
                <strong>${line.elemento}</strong> · Daño: ${line.dano_tipo} — <em>${line.descripcion_dano}</em>
              </div>
            </td>
            <td><span class="badge-unit">${line.unidad_id || 'm²'}</span></td>
            <td class="amount-col">${this.formatQty(qty)}</td>
            <td class="amount-col">${puDisplay}</td>
            <td class="amount-col" style="font-weight: 700; color: var(--navy-900);">${subtotalDisplay}</td>
          `;
          tbody.appendChild(tr);
        });

        // Fila subtotal de sector
        const subtotalTr = document.createElement('tr');
        subtotalTr.className = 'sector-subtotal-row';
        subtotalTr.innerHTML = `
          <td colspan="4" style="text-align: right; padding-right: 18px; color: var(--slate-600); text-transform: uppercase; font-size: 0.8rem;">
            Total Directo ${secName}:
          </td>
          <td class="amount-col" style="color: var(--navy-900); font-weight: 800;">${this.formatCLP(sectorSubtotal)}</td>
        `;
        tbody.appendChild(subtotalTr);
      }

      // 2. Render Mobile Cards (Para Inspector en Celular)
      if (mobileCardsContainer) {
        const sectorMobileDiv = document.createElement('div');
        sectorMobileDiv.style.marginBottom = '14px';
        sectorMobileDiv.innerHTML = `
          <div style="background: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 0.82rem; color: var(--navy-900); display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><i class="material-icons tiny" style="vertical-align: middle;">meeting_room</i> ${secName.toUpperCase()}</span>
            <span>Subtotal: ${this.formatCLP(sectorSubtotal)}</span>
          </div>
        `;

        sectorLines.forEach(line => {
          const qty = line.finalQty !== undefined ? line.finalQty : (line.cantidad_medida || 0);
          const pu = this.unitPriceOf(line);
          const subtotal = pu !== null ? Math.round(qty * pu) : 0;

          const card = document.createElement('div');
          card.className = 'damage-card-mobile';
          card.innerHTML = `
            <div class="header-info">
              <div>
                <strong style="color: var(--navy-900); font-size: 0.95rem;">${line.reparacion_propuesta || line.descripcion_dano}</strong>
                <div style="font-size: 0.78rem; color: var(--slate-500); margin-top: 2px;">
                  ${line.elemento} · ${line.dano_tipo}
                </div>
              </div>
              <span class="badge-unit">${line.unidad_id || 'm²'}</span>
            </div>
            <div class="amount-banner">
              <div>Cant: <strong>${this.formatQty(qty)}</strong> × ${pu ? this.formatCLP(pu) : 'Pendiente'}</div>
              <strong style="color: #b45309; font-size: 1rem; font-family: 'JetBrains Mono', monospace;">${this.formatCLP(subtotal)}</strong>
            </div>
          `;
          sectorMobileDiv.appendChild(card);
        });

        mobileCardsContainer.appendChild(sectorMobileDiv);
      }
    });

    // Renderizar Gastos Operativos / Adicionales
    const filteredExpenses = (expenses || []).filter(e => {
      if (!filter) return true;
      return `${e.categoria} ${e.descripcion}`.toLowerCase().includes(filter);
    });

    if (filteredExpenses.length > 0) {
      let expensesSubtotal = 0;
      filteredExpenses.forEach(exp => {
        const qty = parseFloat(exp.cantidad) || 1;
        const pu = parseFloat(exp.precio_unitario_neto) || 0;
        expensesSubtotal += Math.round(qty * pu);
      });

      if (tbody) {
        const expHeaderTr = document.createElement('tr');
        expHeaderTr.className = 'sector-header-row';
        expHeaderTr.innerHTML = `
          <td colspan="5">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>
                <i class="material-icons left" style="font-size: 1.15rem; vertical-align: middle; margin-right: 6px; color: var(--primary);">local_shipping</i>
                <strong>GASTOS OPERATIVOS Y ADICIONALES DE OBRA</strong>
              </span>
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--navy-900);">
                Subtotal: ${this.formatCLP(expensesSubtotal)}
              </span>
            </div>
          </td>
        `;
        tbody.appendChild(expHeaderTr);

        filteredExpenses.forEach(exp => {
          const qty = parseFloat(exp.cantidad) || 1;
          const pu = parseFloat(exp.precio_unitario_neto) || 0;
          const subtotal = Math.round(qty * pu);

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div style="font-weight: 700; color: var(--navy-900);">${exp.descripcion}</div>
              <div style="font-size: 0.78rem; color: var(--slate-500); margin-top: 2px;">
                Categoría Operativa: <strong>${exp.categoria}</strong>
              </div>
            </td>
            <td><span class="badge-expense">${exp.unidad || 'gl'}</span></td>
            <td class="amount-col">${this.formatQty(qty)}</td>
            <td class="amount-col">${this.formatCLP(pu)}</td>
            <td class="amount-col" style="font-weight: 700; color: var(--navy-900);">${this.formatCLP(subtotal)}</td>
          `;
          tbody.appendChild(tr);
        });

        const expSubtotalTr = document.createElement('tr');
        expSubtotalTr.className = 'sector-subtotal-row';
        expSubtotalTr.innerHTML = `
          <td colspan="4" style="text-align: right; padding-right: 18px; color: var(--slate-600); text-transform: uppercase; font-size: 0.8rem;">
            Total Gastos Operativos:
          </td>
          <td class="amount-col" style="color: var(--navy-900); font-weight: 800;">${this.formatCLP(expensesSubtotal)}</td>
        `;
        tbody.appendChild(expSubtotalTr);
      }

      if (mobileCardsContainer) {
        const expMobileDiv = document.createElement('div');
        expMobileDiv.innerHTML = `
          <div style="background: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 0.82rem; color: var(--navy-900); display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><i class="material-icons tiny" style="vertical-align: middle;">local_shipping</i> GASTOS OPERATIVOS</span>
            <span>Subtotal: ${this.formatCLP(expensesSubtotal)}</span>
          </div>
        `;
        filteredExpenses.forEach(exp => {
          const qty = parseFloat(exp.cantidad) || 1;
          const pu = parseFloat(exp.precio_unitario_neto) || 0;
          const subtotal = Math.round(qty * pu);

          const card = document.createElement('div');
          card.className = 'damage-card-mobile';
          card.style.borderLeftColor = 'var(--amber-500)';
          card.innerHTML = `
            <div class="header-info">
              <div>
                <strong style="color: var(--navy-900); font-size: 0.95rem;">${exp.descripcion}</strong>
                <div style="font-size: 0.78rem; color: var(--slate-500);">${exp.categoria}</div>
              </div>
              <span class="badge-expense">${exp.unidad || 'gl'}</span>
            </div>
            <div class="amount-banner">
              <div>Cant: <strong>${this.formatQty(qty)}</strong> × ${this.formatCLP(pu)}</div>
              <strong style="color: #b45309; font-size: 1rem; font-family: 'JetBrains Mono', monospace;">${this.formatCLP(subtotal)}</strong>
            </div>
          `;
          expMobileDiv.appendChild(card);
        });
        mobileCardsContainer.appendChild(expMobileDiv);
      }
    }
  },

  // Renderizar resumen financiero en cascada y métricas principales
  renderSummary(summary) {
    if (!summary) return;

    // PostgreSQL devuelve NUMERIC como texto: se normaliza antes de sumar.
    const num = (value) => {
      const parsed = typeof value === 'number' ? value : parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const setVal = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    const ggTotal = num(summary.gg) + num(summary.profit);

    // Cards métricas
    setVal('metric-direct', this.formatCLP(num(summary.totalDirect)));
    setVal('metric-gg', this.formatCLP(ggTotal));
    setVal('metric-iva', this.formatCLP(num(summary.tax)));
    setVal('metric-total', this.formatCLP(num(summary.grandTotal)));

    // Desglose en tabla de resumen final
    setVal('sum-direct', this.formatCLP(num(summary.totalDirect)));
    setVal('sum-gg-label', `Gastos Generales y Utilidad (${num(summary.porcentaje_gg) + num(summary.porcentaje_utilidad)}%):`);
    setVal('sum-gg', this.formatCLP(ggTotal));
    setVal('sum-neto', this.formatCLP(num(summary.netSubtotal)));
    setVal('sum-iva-label', `IVA Presupuesto (${num(summary.tasa_iva)}%):`);
    setVal('sum-iva', this.formatCLP(num(summary.tax)));
    setVal('sum-total', this.formatCLP(num(summary.grandTotal)));

    // Admin Metrics
    setVal('admin-metric-total-claims', '1');
    setVal('admin-metric-valorizado', this.formatCLP(num(summary.grandTotal)));
    setVal('admin-metric-gg-promedio', `${num(summary.porcentaje_gg)}%`);
  },

  // Renderizar gráfico Canvas Donut ultra nítido (Soporte Multi-Dashboard Inspector / Admin)
  renderCanvasChart(summary, lines = [], expenses = [], targetCanvasId = null) {
    const isInspector = document.getElementById('dashboard-inspector-container')?.style.display === 'block';
    const canvasId = targetCanvasId || (isInspector ? 'inspectorBudgetChart' : 'budgetChart');
    let canvas = document.getElementById(canvasId);
    if (!canvas || canvas.offsetParent === null) {
      canvas = document.getElementById('budgetChart') || document.getElementById('inspectorBudgetChart');
    }
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 600;
    const displayHeight = 260;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    let items = [];
    if (this.chartViewMode === 'sector') {
      const sectorTotals = {};
      lines.forEach(l => {
        const sec = l.sector || 'General';
        const sub = l.subtotal_neto || 0;
        sectorTotals[sec] = (sectorTotals[sec] || 0) + sub;
      });
      let expSub = 0;
      expenses.forEach(e => expSub += (e.subtotal_neto || 0));
      if (expSub > 0) sectorTotals['Gastos Operativos'] = expSub;

      const colors = ['#0f273d', '#0284c7', '#d97706', '#059669', '#7c3aed', '#db2777'];
      let idx = 0;
      Object.keys(sectorTotals).forEach(sec => {
        items.push({
          label: sec,
          value: sectorTotals[sec] || 0.1,
          color: colors[idx % colors.length]
        });
        idx++;
      });
    } else {
      items = [
        { label: 'Costo Directo Partidas', value: summary.directCost || 1, color: '#0f273d' },
        { label: 'Gastos Operativos Adic.', value: summary.expensesCost || 0.1, color: '#0284c7' },
        { label: `GG y Utilidad (${summary.porcentaje_gg}%)`, value: summary.gg || 0.1, color: '#d97706' },
        { label: `IVA Legal (${summary.tasa_iva}%)`, value: summary.tax || 0.1, color: '#059669' }
      ];
    }

    const total = items.reduce((acc, it) => acc + it.value, 0) || 1;
    const isMobile = displayWidth < 480;
    const centerX = isMobile ? displayWidth * 0.5 : displayWidth * 0.32;
    const centerY = isMobile ? displayHeight * 0.38 : displayHeight * 0.5;
    const radius = Math.min(centerX, centerY) - (isMobile ? 12 : 20);

    let startAngle = -Math.PI / 2;

    items.forEach(item => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.52, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Texto central
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL CASO', centerX, centerY - 5);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0f273d';
    ctx.fillText(this.formatCLP(summary.grandTotal), centerX, centerY + 10);

    // Leyenda
    if (!isMobile) {
      const legendX = displayWidth * 0.58;
      let legendY = 24;
      ctx.textAlign = 'left';

      items.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(legendX, legendY, 12, 12, 3) : ctx.fillRect(legendX, legendY, 12, 12);
        ctx.fill();

        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#1e293b';
        const pct = Math.round((item.value / total) * 100);
        ctx.fillText(`${item.label} (${pct}%)`, legendX + 20, legendY + 10);

        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(this.formatCLP(item.value), legendX + 20, legendY + 23);

        legendY += 38;
      });
    }
  }
};

window.BudgetViewer = BudgetViewer;
