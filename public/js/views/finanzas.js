/* Celeste ERP — Finanzas (P&L) view */
'use strict';

const FinanzasView = (() => {
  let currentMes = currentMonthStr();
  let activeTab  = 'ingresos'; // 'ingresos' | 'gastos'

  function currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando finanzas...</p></div>`;

    let data;
    try {
      data = await API.finanzas.get({ mes: currentMes });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar finanzas</p></div>`;
      return;
    }

    const { resumen, ingresos, gastos } = data;
    const utilColor = resumen.utilidad >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    container.innerHTML = `
      ${isDesktop() ? `<div class="page-header"><h1 class="page-header-title">Finanzas</h1></div>` : ''}

      <!-- Month picker -->
      <div class="month-picker">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <input type="month" id="finanzas-mes" value="${currentMes}"
          style="flex:1;border:none;background:none;font-size:14px;font-weight:600;outline:none;">
      </div>

      <!-- P&L summary -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="card">
          <p class="card-title">Ingresos</p>
          <p class="card-value text-success">${fmt(resumen.total_ingresos)}</p>
        </div>
        <div class="card">
          <p class="card-title">Gastos</p>
          <p class="card-value text-danger">${fmt(resumen.total_gastos)}</p>
        </div>
        <div class="card">
          <p class="card-title">Utilidad</p>
          <p class="card-value" style="color:${utilColor}">${fmt(resumen.utilidad)}</p>
        </div>
        <div class="card">
          <p class="card-title">Margen</p>
          <p class="card-value text-primary">${resumen.margen_pct}%</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="filter-bar" style="margin-bottom:16px">
        <button class="chip ${activeTab === 'ingresos' ? 'active' : ''}" data-tab="ingresos">
          ↑ Ingresos ${fmt(resumen.total_ingresos)}
        </button>
        <button class="chip ${activeTab === 'gastos' ? 'active' : ''}" data-tab="gastos">
          ↓ Gastos ${fmt(resumen.total_gastos)}
        </button>
      </div>

      <!-- INGRESOS TAB -->
      <div id="tab-ingresos" class="${activeTab === 'ingresos' ? '' : 'hidden'}">

        <!-- Ventas -->
        <div class="section-header">
          <h2 class="section-title">💵 Ventas de productos</h2>
          <span style="font-weight:700;color:var(--color-success)">${fmt(ingresos.ventas.total)}</span>
        </div>
        ${ingresos.ventas.filas.length === 0 ? `
          <div class="card mb-16" style="text-align:center;padding:20px;color:var(--color-text-muted);font-size:13px">Sin ventas en este período</div>
        ` : isDesktop() ? `
        <div class="table-wrapper mb-16">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Estado</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${ingresos.ventas.filas.map(v => `
                <tr>
                  <td>${v.fecha}</td>
                  <td style="font-weight:600">${v.cliente_nombre || 'Venta directa'}</td>
                  <td>${v.canal}</td>
                  <td><span class="badge ${v.estado === 'pagada' ? 'badge-green' : 'badge-yellow'}">${v.estado}</span></td>
                  <td style="text-align:right;font-weight:700;color:var(--color-success)">${fmt(v.total)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ` : `
        <div class="list-card mb-16">
          ${ingresos.ventas.filas.map(v => `
            <div class="list-item">
              <div class="list-item-icon" style="background:var(--color-success-bg);color:var(--color-success)">💵</div>
              <div class="list-item-body">
                <p class="list-item-title">${v.cliente_nombre || 'Venta directa'}</p>
                <p class="list-item-sub">${v.fecha} · ${v.canal}</p>
              </div>
              <div class="list-item-right">
                <p class="list-item-amount positive">${fmt(v.total)}</p>
              </div>
            </div>`).join('')}
        </div>
        `}

        <!-- Cursos -->
        <div class="section-header">
          <h2 class="section-title">🎓 Cursos</h2>
          <span style="font-weight:700;color:var(--color-success)">${fmt(ingresos.cursos.total)}</span>
        </div>
        ${ingresos.cursos.resumen.length === 0 ? `
          <div class="card mb-16" style="text-align:center;padding:20px;color:var(--color-text-muted);font-size:13px">Sin ingresos por cursos en este período</div>
        ` : `
        <div class="card mb-16">
          ${ingresos.cursos.resumen.map(c => `
            <div class="detail-row">
              <span class="detail-row-label">🎓 ${c.nombre} <span style="color:var(--color-text-muted);font-size:12px">(${c.inscritas} inscrita${c.inscritas !== 1 ? 's' : ''})</span></span>
              <span class="detail-row-value text-success" style="font-weight:700">${fmt(c.cobrado)}</span>
            </div>`).join('')}
          <div class="detail-row" style="border-top:1px solid var(--color-border);margin-top:4px;padding-top:8px">
            <span class="detail-row-label" style="font-weight:700">Total cursos</span>
            <span class="detail-row-value text-success" style="font-weight:700">${fmt(ingresos.cursos.total)}</span>
          </div>
        </div>
        `}

        <!-- Total ingresos -->
        <div class="total-box mb-16">
          <div class="total-row grand">
            <span class="total-row-label">Total ingresos</span>
            <span class="total-row-value" style="color:var(--color-success)">${fmt(resumen.total_ingresos)}</span>
          </div>
        </div>
      </div>

      <!-- GASTOS TAB -->
      <div id="tab-gastos" class="${activeTab === 'gastos' ? '' : 'hidden'}">

        <!-- Gastos generales -->
        <div class="section-header">
          <h2 class="section-title">💸 Gastos generales</h2>
          <span style="font-weight:700;color:var(--color-danger)">${fmt(gastos.generales.total)}</span>
        </div>
        ${gastos.generales.filas.length === 0 ? `
          <div class="card mb-16" style="text-align:center;padding:20px;color:var(--color-text-muted);font-size:13px">Sin gastos generales en este período</div>
        ` : isDesktop() ? `
        <div class="table-wrapper mb-16">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th style="text-align:right">Monto</th></tr></thead>
            <tbody>
              ${gastos.generales.filas.map(g => `
                <tr>
                  <td>${g.fecha}</td>
                  <td>${g.categoria}</td>
                  <td style="font-weight:600">${g.descripcion}</td>
                  <td style="color:var(--color-text-muted)">${g.proveedor || '—'}</td>
                  <td style="text-align:right;font-weight:700;color:var(--color-danger)">-${fmt(g.monto)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ` : `
        <div class="list-card mb-16">
          ${gastos.generales.filas.map(g => `
            <div class="list-item">
              <div class="list-item-icon" style="background:var(--color-danger-bg);color:var(--color-danger)">💸</div>
              <div class="list-item-body">
                <p class="list-item-title">${g.descripcion}</p>
                <p class="list-item-sub">${g.fecha} · ${g.categoria}</p>
              </div>
              <div class="list-item-right">
                <p class="list-item-amount negative">-${fmt(g.monto)}</p>
              </div>
            </div>`).join('')}
        </div>
        `}

        <!-- Costo de ventas -->
        ${gastos.costo_ventas.total > 0 ? `
        <div class="section-header">
          <h2 class="section-title">📦 Costo de ventas</h2>
          <span style="font-weight:700;color:var(--color-danger)">${fmt(gastos.costo_ventas.total)}</span>
        </div>
        <div class="card mb-16">
          ${gastos.costo_ventas.filas.map(v => `
            <div class="detail-row">
              <span class="detail-row-label">${v.fecha} — ${v.cliente_nombre || 'Venta directa'}</span>
              <span class="detail-row-value text-danger">-${fmt(v.costo_total)}</span>
            </div>`).join('')}
          <div class="detail-row" style="border-top:1px solid var(--color-border);margin-top:4px;padding-top:8px">
            <span class="detail-row-label" style="font-weight:700">Total costo ventas</span>
            <span class="detail-row-value text-danger" style="font-weight:700">-${fmt(gastos.costo_ventas.total)}</span>
          </div>
        </div>
        ` : ''}

        <!-- Gastos de cursos -->
        ${gastos.cursos.total > 0 ? `
        <div class="section-header">
          <h2 class="section-title">🎓 Gastos de cursos</h2>
          <span style="font-weight:700;color:var(--color-danger)">${fmt(gastos.cursos.total)}</span>
        </div>
        <div class="list-card mb-16">
          ${gastos.cursos.filas.map(g => `
            <div class="list-item">
              <div class="list-item-icon" style="background:var(--color-danger-bg);color:var(--color-danger)">🎓</div>
              <div class="list-item-body">
                <p class="list-item-title">${g.descripcion}</p>
                <p class="list-item-sub">${g.fecha} · ${g.curso_nombre}</p>
              </div>
              <div class="list-item-right">
                <p class="list-item-amount negative">-${fmt(g.monto)}</p>
              </div>
            </div>`).join('')}
        </div>
        ` : ''}

        <!-- Total gastos -->
        <div class="total-box mb-16">
          <div class="total-row">
            <span class="total-row-label">Gastos generales</span>
            <span class="total-row-value text-danger">-${fmt(gastos.generales.total)}</span>
          </div>
          ${gastos.costo_ventas.total > 0 ? `
          <div class="total-row">
            <span class="total-row-label">Costo de ventas</span>
            <span class="total-row-value text-danger">-${fmt(gastos.costo_ventas.total)}</span>
          </div>` : ''}
          ${gastos.cursos.total > 0 ? `
          <div class="total-row">
            <span class="total-row-label">Gastos de cursos</span>
            <span class="total-row-value text-danger">-${fmt(gastos.cursos.total)}</span>
          </div>` : ''}
          <div class="total-row grand">
            <span class="total-row-label">Total gastos</span>
            <span class="total-row-value text-danger">-${fmt(resumen.total_gastos)}</span>
          </div>
        </div>
      </div>

      <div style="height:8px"></div>
    `;

    // Month filter
    document.getElementById('finanzas-mes').addEventListener('change', async e => {
      currentMes = e.target.value;
      await render(container);
    });

    // Tabs
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeTab = btn.dataset.tab;
        await render(container);
      });
    });
  }

  return { render };
})();
