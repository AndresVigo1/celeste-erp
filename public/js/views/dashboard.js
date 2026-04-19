/* Celeste ERP — Dashboard view */
'use strict';

const DashboardView = (() => {
  let chartInstance = null;

  // ── Period state ────────────────────────────────────────────────────────────
  // Each preset: { label, key, getParams() }
  function thisMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthOffset(n) {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function yearStart() {
    return `${new Date().getFullYear()}-01`;
  }

  const PRESETS = [
    { key: 'mes',    label: 'Este mes',  params: () => ({ desde: thisMonthStr(), hasta: thisMonthStr() }) },
    { key: '3m',     label: '3 meses',   params: () => ({ desde: monthOffset(-2), hasta: thisMonthStr() }) },
    { key: '6m',     label: '6 meses',   params: () => ({ desde: monthOffset(-5), hasta: thisMonthStr() }) },
    { key: 'anio',   label: 'Este año',  params: () => ({ desde: yearStart(),     hasta: thisMonthStr() }) },
    { key: 'todo',   label: 'Todo',      params: () => ({ todo: '1' }) },
  ];

  let activePeriod = PRESETS[0].key;

  function getActiveParams() {
    return PRESETS.find(p => p.key === activePeriod).params();
  }

  function getPeriodLabel(periodo) {
    if (periodo.todo === '1' || periodo.todo === true) return 'Todo el tiempo';
    if (periodo.desde === periodo.hasta) {
      const [y, m] = periodo.desde.split('-');
      return new Date(+y, +m - 1, 1).toLocaleString('es', { month: 'long', year: 'numeric' });
    }
    const [y0, m0] = periodo.desde.split('-');
    const [y1, m1] = periodo.hasta.split('-');
    const d0 = new Date(+y0, +m0 - 1, 1).toLocaleString('es', { month: 'short', year: y0 !== y1 ? 'numeric' : undefined });
    const d1 = new Date(+y1, +m1 - 1, 1).toLocaleString('es', { month: 'short', year: 'numeric' });
    return `${d0} – ${d1}`;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  function deltaHTML(current, prev, invert = false) {
    if (!prev && prev !== 0) return '';
    const d = prev === 0 ? null : ((current - prev) / Math.abs(prev)) * 100;
    if (d === null) return '<span class="card-delta neutral">—</span>';
    const up = invert ? d < 0 : d >= 0;
    return `<span class="card-delta ${up ? 'up' : 'down'}">${d >= 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}%</span>`;
  }

  function canalIcon(canal) {
    return { whatsapp:'💬', instagram:'📸', feria:'🎪', local:'🏪', otro:'📦' }[canal] || '📦';
  }

  function estadoBadge(e) {
    const m = { pagada:'badge-green', pendiente:'badge-yellow', cancelada:'badge-red' };
    return `<span class="badge ${m[e]||'badge-gray'}">${e}</span>`;
  }

  function pedidoEstadoBadge(e) {
    const m = { pendiente:'badge-yellow', en_proceso:'badge-blue', listo:'badge-green', entregado:'badge-gray', cancelado:'badge-red' };
    const l = { pendiente:'Pendiente', en_proceso:'En proceso', listo:'Listo', entregado:'Entregado', cancelado:'Cancelado' };
    return `<span class="badge ${m[e]||'badge-gray'}">${l[e]||e}</span>`;
  }

  function stockClass(actual, minimo) {
    if (actual <= 0 || actual < minimo) return 'stock-critical';
    if (actual <= minimo + 2) return 'stock-low';
    return 'stock-ok';
  }

  function buildChart(canvas, ventas, periodo) {
    if (!window.Chart || !canvas) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const isTodo  = periodo.todo === '1' || periodo.todo === true;
    const isMulti = !isTodo && periodo.desde !== periodo.hasta;

    let labels = [], amounts = [];

    if (isTodo || isMulti) {
      // Group by month
      const byMonth = {};
      ventas.forEach(v => {
        if (v.estado === 'cancelada') return;
        const key = v.fecha.slice(0, 7); // YYYY-MM
        byMonth[key] = (byMonth[key] || 0) + v.total;
      });
      const keys = Object.keys(byMonth).sort();
      labels  = keys.map(k => { const [y,m] = k.split('-'); return new Date(+y,+m-1,1).toLocaleString('es',{month:'short',year:'2-digit'}); });
      amounts = keys.map(k => parseFloat((byMonth[k] || 0).toFixed(2)));
    } else {
      // Last 7 days of the selected single month
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key   = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('es', { weekday: 'short' });
        labels.push(label);
        const total = ventas.filter(v => v.fecha === key && v.estado !== 'cancelada').reduce((s, v) => s + v.total, 0);
        amounts.push(Number(total.toFixed(2)));
      }
    }

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ventas',
          data: amounts,
          backgroundColor: 'rgba(14,165,233,0.18)',
          borderColor: '#0EA5E9',
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { callback: v => '$' + v, font: { size: 11 }, color: '#9CA3AF' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9CA3AF' }
          }
        }
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>`;

    let data;
    try {
      data = await API.dashboard.get(getActiveParams());
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div>
        <p class="empty-state-text">No se pudo cargar el dashboard</p>
        <button class="btn btn-primary btn-sm" onclick="App.navigate('dashboard')">Reintentar</button></div>`;
      return;
    }

    const { periodo, mes_actual, mes_anterior, ventas_por_canal, pedidos_pendientes, stock_bajo, ultimas_ventas, cursos_activos } = data;
    const periodoLabel = getPeriodLabel(periodo);
    const desktop      = isDesktop();
    const showDelta    = !(periodo.todo === '1' || periodo.todo === true);

    // ── Period filter chips ──
    const filterHTML = `
      <div class="filter-bar" style="margin-bottom:16px">
        ${PRESETS.map(p => `
          <button class="chip ${activePeriod === p.key ? 'active' : ''}" data-period="${p.key}">
            ${p.label}
          </button>`).join('')}
      </div>`;

    // ── KPI grid ──
    const kpiHTML = `
      ${filterHTML}
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="card">
          <p class="card-title">Ingresos</p>
          <p class="card-value text-success">${fmt(mes_actual.ingresos)}</p>
          ${showDelta ? deltaHTML(mes_actual.ingresos, mes_anterior.ingresos) : ''}
          <p class="card-sub">${periodoLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Gastos</p>
          <p class="card-value text-danger">${fmt(mes_actual.gastos)}</p>
          ${showDelta ? deltaHTML(mes_actual.gastos, mes_anterior.gastos, true) : ''}
          <p class="card-sub">${periodoLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Utilidad</p>
          <p class="card-value ${mes_actual.utilidad >= 0 ? 'text-success' : 'text-danger'}">${fmt(mes_actual.utilidad)}</p>
          ${showDelta ? deltaHTML(mes_actual.utilidad, mes_anterior.utilidad) : ''}
          <p class="card-sub">${periodoLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Margen</p>
          <p class="card-value text-primary">${mes_actual.margen_pct}%</p>
          <p class="card-sub">${periodoLabel}</p>
        </div>
      </div>`;

    // ── Chart ──
    const chartHTML = desktop ? `
      <div class="chart-card">
        <p class="chart-title">${periodo.todo === '1' ? 'Ventas por mes' : periodo.desde !== periodo.hasta ? 'Ventas por mes' : 'Ventas últimos 7 días'}</p>
        <div style="height:200px;position:relative">
          <canvas id="dashboard-chart"></canvas>
        </div>
      </div>` : '';

    // ── Canales ──
    const canalesHTML = ventas_por_canal.length ? `
      <div class="section-header"><h2 class="section-title">Ventas por canal</h2></div>
      <div class="card mb-16">
        ${ventas_por_canal.map(c => `
          <div class="detail-row">
            <span class="detail-row-label">${canalIcon(c.canal)} ${c.canal}</span>
            <span class="detail-row-value">${fmt(c.monto)} <span class="text-muted" style="font-size:11px">(${c.cantidad})</span></span>
          </div>`).join('')}
      </div>` : '';

    // ── Pedidos pendientes ──
    const pedidosHTML = pedidos_pendientes.length ? `
      <div class="section-header">
        <h2 class="section-title">Pedidos activos</h2>
        <button class="section-link" onclick="App.navigate('pedidos')">Ver todos</button>
      </div>
      <div class="list-card mb-16">
        ${pedidos_pendientes.map(p => `
          <div class="list-item" onclick="App.navigate('pedidos')">
            <div class="list-item-icon" style="background:var(--color-info-bg);color:var(--color-info)">📋</div>
            <div class="list-item-body">
              <p class="list-item-title">${p.cliente_nombre || 'Sin cliente'}</p>
              <p class="list-item-sub">${p.descripcion.substring(0,40)}${p.descripcion.length>40?'…':''}</p>
              ${p.fecha_entrega ? `<p class="list-item-sub">📅 ${p.fecha_entrega}</p>` : ''}
            </div>
            <div class="list-item-right">
              ${pedidoEstadoBadge(p.estado)}
              <p class="list-item-amount" style="margin-top:4px">${fmt(p.saldo)} saldo</p>
            </div>
          </div>`).join('')}
      </div>` : '';

    // ── Stock bajo ──
    const stockHTML = stock_bajo.length ? `
      <div class="section-header">
        <h2 class="section-title">⚠ Stock bajo</h2>
        <button class="section-link" onclick="App.navigate('inventario')">Ver todo</button>
      </div>
      <div class="list-card mb-16">
        ${stock_bajo.map(p => `
          <div class="list-item" onclick="App.navigate('inventario')">
            <div class="list-item-icon" style="background:var(--color-warning-bg);color:var(--color-warning)">📦</div>
            <div class="list-item-body">
              <p class="list-item-title">${p.nombre}</p>
              <p class="list-item-sub">${p.categoria || 'Sin categoría'}</p>
            </div>
            <div class="list-item-right">
              <span class="stock-indicator ${stockClass(p.stock_actual, p.stock_minimo)}">
                <span class="stock-dot"></span>${p.stock_actual} / ${p.stock_minimo}
              </span>
            </div>
          </div>`).join('')}
      </div>` : '';

    // ── Cursos activos ──
    const cursosHTML = cursos_activos && cursos_activos.length ? `
      <div class="section-header">
        <h2 class="section-title">🎓 Cursos activos</h2>
        <button class="section-link" onclick="App.navigate('cursos')">Ver todos</button>
      </div>
      <div class="list-card mb-16">
        ${cursos_activos.map(c => `
          <div class="list-item" onclick="App.navigate('cursos')">
            <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary)">🎓</div>
            <div class="list-item-body">
              <p class="list-item-title">${c.nombre}</p>
              <p class="list-item-sub">${c.fecha_inicio} · ${c.num_inscritas} inscrita${c.num_inscritas !== 1 ? 's' : ''}</p>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount positive">${fmt(c.cobrado)}</p>
              ${c.esperado > c.cobrado ? `<p style="font-size:11px;color:var(--color-warning);text-align:right;margin-top:2px">pend. ${fmt(c.esperado - c.cobrado)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>` : '';

    // ── Últimas ventas ──
    const ventasHTML = `
      <div class="section-header">
        <h2 class="section-title">Últimas ventas</h2>
        <button class="section-link" onclick="App.navigate('ventas')">Ver todas</button>
      </div>
      ${ultimas_ventas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <p class="empty-state-text">Sin ventas en este período</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('nueva-venta')">+ Nueva venta</button>
        </div>` : `
      <div class="list-card">
        ${ultimas_ventas.map(v => `
          <div class="list-item" onclick="App.navigate('ventas')">
            <div class="list-item-icon" style="background:var(--color-primary-light)">${canalIcon(v.canal)}</div>
            <div class="list-item-body">
              <p class="list-item-title">${v.cliente_nombre || 'Venta directa'}</p>
              <p class="list-item-sub">${v.fecha} · ${v.canal}</p>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount positive">${fmt(v.total)}</p>
              <div style="margin-top:2px">${estadoBadge(v.estado)}</div>
            </div>
          </div>`).join('')}
      </div>`}
      <div style="height:8px"></div>`;

    // ── Compose layout ──
    if (desktop) {
      container.innerHTML = `
        <div class="page-header"><h1 class="page-header-title">Dashboard</h1></div>
        ${kpiHTML}
        <div class="dashboard-desktop-layout">
          <div>
            ${canalesHTML}
            ${cursosHTML}
            ${pedidosHTML}
            ${stockHTML}
            ${ventasHTML}
          </div>
          <div>${chartHTML}</div>
        </div>`;
    } else {
      container.innerHTML = kpiHTML + canalesHTML + cursosHTML + pedidosHTML + stockHTML + ventasHTML;
    }

    // ── Wire period chips ──
    container.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', async () => {
        activePeriod = btn.dataset.period;
        await render(container);
      });
    });

    // Build chart after render
    if (desktop) {
      const canvas = document.getElementById('dashboard-chart');
      buildChart(canvas, ultimas_ventas, periodo);
    }
  }

  return { render };
})();
