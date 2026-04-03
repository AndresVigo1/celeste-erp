/* Celeste ERP — Dashboard view */
'use strict';

const DashboardView = (() => {

  function fmt(n) {
    return '$' + Number(n || 0).toFixed(2);
  }

  function pct(val, ref) {
    if (!ref || ref === 0) return null;
    const diff = ((val - ref) / Math.abs(ref)) * 100;
    return diff;
  }

  function deltaHTML(current, prev, invert = false) {
    const d = pct(current, prev);
    if (d === null) return '<span class="card-delta neutral">—</span>';
    const up = invert ? d < 0 : d >= 0;
    const arrow = d >= 0 ? '↑' : '↓';
    const cls   = up ? 'up' : 'down';
    return `<span class="card-delta ${cls}">${arrow} ${Math.abs(d).toFixed(1)}%</span>`;
  }

  function canalIcon(canal) {
    const icons = { whatsapp: '💬', instagram: '📸', feria: '🎪', local: '🏪', otro: '📦' };
    return icons[canal] || '📦';
  }

  function estadoBadge(estado) {
    const map = {
      pagada:    'badge-green',
      pendiente: 'badge-yellow',
      cancelada: 'badge-red'
    };
    return `<span class="badge ${map[estado] || 'badge-gray'}">${estado}</span>`;
  }

  function pedidoEstadoBadge(estado) {
    const map = {
      pendiente:  'badge-yellow',
      en_proceso: 'badge-blue',
      listo:      'badge-green',
      entregado:  'badge-gray',
      cancelado:  'badge-red'
    };
    const labels = {
      pendiente:  'Pendiente',
      en_proceso: 'En proceso',
      listo:      'Listo',
      entregado:  'Entregado',
      cancelado:  'Cancelado'
    };
    return `<span class="badge ${map[estado] || 'badge-gray'}">${labels[estado] || estado}</span>`;
  }

  function stockClass(actual, minimo) {
    if (actual <= 0) return 'stock-critical';
    if (actual < minimo) return 'stock-critical';
    if (actual <= minimo + 2) return 'stock-low';
    return 'stock-ok';
  }

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>`;

    let data;
    try {
      data = await API.dashboard.get();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠</div>
          <p class="empty-state-text">No se pudo cargar el dashboard</p>
          <p class="empty-state-sub">${err.message}</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('dashboard')">Reintentar</button>
        </div>`;
      return;
    }

    const { mes_actual, mes_anterior, ventas_por_canal, pedidos_pendientes, stock_bajo, ultimas_ventas } = data;

    const now = new Date();
    const mesLabel = now.toLocaleString('es', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <!-- KPI Cards -->
      <div class="dashboard-grid">
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
          ${deltaHTML(mes_actual.margen_pct, mes_anterior.ingresos > 0 ? ((mes_anterior.utilidad / mes_anterior.ingresos) * 100) : 0)}
          <p class="card-sub">Mes actual</p>
        </div>
      </div>

      <!-- Ventas por canal -->
      ${ventas_por_canal.length ? `
      <div class="section-header">
        <h2 class="section-title">Ventas por canal</h2>
      </div>
      <div class="card mb-16">
        ${ventas_por_canal.map(c => `
          <div class="detail-row">
            <span class="detail-row-label">${canalIcon(c.canal)} ${c.canal}</span>
            <span class="detail-row-value">${fmt(c.monto)} <span class="text-muted fw-normal" style="font-size:11px">(${c.cantidad})</span></span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Pedidos pendientes -->
      ${pedidos_pendientes.length ? `
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
              <p class="list-item-sub">${p.descripcion.substring(0, 40)}${p.descripcion.length > 40 ? '…' : ''}</p>
              <p class="list-item-sub">${p.fecha_entrega ? '📅 ' + p.fecha_entrega : 'Sin fecha'}</p>
            </div>
            <div class="list-item-right">
              ${pedidoEstadoBadge(p.estado)}
              <p class="list-item-amount" style="margin-top:4px">${fmt(p.saldo)} saldo</p>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Stock bajo -->
      ${stock_bajo.length ? `
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
                <span class="stock-dot"></span>
                ${p.stock_actual} / ${p.stock_minimo}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Últimas ventas -->
      <div class="section-header">
        <h2 class="section-title">Últimas ventas</h2>
        <button class="section-link" onclick="App.navigate('ventas')">Ver todas</button>
      </div>
      ${ultimas_ventas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <p class="empty-state-text">Sin ventas aún</p>
          <p class="empty-state-sub">Registra tu primera venta</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('nueva-venta')">+ Nueva venta</button>
        </div>
      ` : `
      <div class="list-card">
        ${ultimas_ventas.map(v => `
          <div class="list-item" onclick="App.navigate('ventas')">
            <div class="list-item-icon" style="background:var(--color-primary-light)">
              ${canalIcon(v.canal)}
            </div>
            <div class="list-item-body">
              <p class="list-item-title">${v.cliente_nombre || 'Venta directa'}</p>
              <p class="list-item-sub">${v.fecha} · ${v.canal}</p>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount positive">${fmt(v.total)}</p>
              <div style="margin-top:2px">${estadoBadge(v.estado)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      `}

      <div style="height:8px"></div>
    `;
  }

  return { render };
})();
