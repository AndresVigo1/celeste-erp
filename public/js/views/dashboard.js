/* Celeste ERP — Dashboard view */
'use strict';

const DashboardView = (() => {
  let chartInstance = null;

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  function pct(val, ref) {
    if (!ref || ref === 0) return null;
    return ((val - ref) / Math.abs(ref)) * 100;
  }

  function deltaHTML(current, prev, invert = false) {
    const d = pct(current, prev);
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

  function buildChart(canvas, ventas) {
    if (!window.Chart || !canvas) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    // Group last 7 days
    const days = [];
    const amounts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('es', { weekday: 'short' });
      days.push(label);
      const total = ventas
        .filter(v => v.fecha === key && v.estado !== 'cancelada')
        .reduce((s, v) => s + v.total, 0);
      amounts.push(Number(total.toFixed(2)));
    }

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days,
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
            ticks: {
              callback: v => '$' + v,
              font: { size: 11 },
              color: '#9CA3AF'
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9CA3AF' }
          }
        }
      }
    });
  }

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>`;

    let data;
    try {
      data = await API.dashboard.get();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div>
        <p class="empty-state-text">No se pudo cargar el dashboard</p>
        <button class="btn btn-primary btn-sm" onclick="App.navigate('dashboard')">Reintentar</button></div>`;
      return;
    }

    const { mes_actual, mes_anterior, ventas_por_canal, pedidos_pendientes, stock_bajo, ultimas_ventas } = data;
    const mesLabel = new Date().toLocaleString('es', { month: 'long', year: 'numeric' });
    const desktop  = isDesktop();

    // ── KPI grid ──
    const kpiHTML = `
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="card">
          <p class="card-title">Ingresos</p>
          <p class="card-value text-success">${fmt(mes_actual.ingresos)}</p>
          ${deltaHTML(mes_actual.ingresos, mes_anterior.ingresos)}
          <p class="card-sub">${mesLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Gastos</p>
          <p class="card-value text-danger">${fmt(mes_actual.gastos)}</p>
          ${deltaHTML(mes_actual.gastos, mes_anterior.gastos, true)}
          <p class="card-sub">${mesLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Utilidad</p>
          <p class="card-value ${mes_actual.utilidad >= 0 ? 'text-success' : 'text-danger'}">${fmt(mes_actual.utilidad)}</p>
          ${deltaHTML(mes_actual.utilidad, mes_anterior.utilidad)}
          <p class="card-sub">${mesLabel}</p>
        </div>
        <div class="card">
          <p class="card-title">Margen</p>
          <p class="card-value text-primary">${mes_actual.margen_pct}%</p>
          <p class="card-sub">Mes actual</p>
        </div>
      </div>`;

    // ── Chart (desktop right column) ──
    const chartHTML = desktop ? `
      <div class="chart-card">
        <p class="chart-title">Ventas últimos 7 días</p>
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

    // ── Últimas ventas ──
    const ventasHTML = `
      <div class="section-header">
        <h2 class="section-title">Últimas ventas</h2>
        <button class="section-link" onclick="App.navigate('ventas')">Ver todas</button>
      </div>
      ${ultimas_ventas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <p class="empty-state-text">Sin ventas aún</p>
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
        <div class="page-header">
          <h1 class="page-header-title">Dashboard</h1>
        </div>
        ${kpiHTML}
        <div class="dashboard-desktop-layout">
          <div>
            ${canalesHTML}
            ${pedidosHTML}
            ${stockHTML}
            ${ventasHTML}
          </div>
          <div>
            ${chartHTML}
          </div>
        </div>`;
    } else {
      container.innerHTML = kpiHTML + canalesHTML + pedidosHTML + stockHTML + ventasHTML;
    }

    // Build chart after render
    if (desktop) {
      const canvas = document.getElementById('dashboard-chart');
      buildChart(canvas, ultimas_ventas);
    }
  }

  return { render };
})();
