/* Celeste ERP — Ventas view */
'use strict';

const VentasView = (() => {
  let currentMes  = currentMonthStr();
  let currentCanal = '';
  let currentVentas = [];

  function currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  function canalIcon(c) {
    return { whatsapp:'💬', instagram:'📸', feria:'🎪', local:'🏪', otro:'📦' }[c] || '📦';
  }

  function estadoBadge(e) {
    const map = { pagada:'badge-green', pendiente:'badge-yellow', cancelada:'badge-red' };
    return `<span class="badge ${map[e] || 'badge-gray'}">${e}</span>`;
  }

  async function load() {
    const params = { mes: currentMes };
    if (currentCanal) params.canal = currentCanal;
    currentVentas = await API.ventas.list(params);
  }

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando ventas...</p></div>`;

    try {
      await load();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar ventas</p><p class="empty-state-sub">${err.message}</p></div>`;
      return;
    }

    // Compute totals
    const totalIngresos = currentVentas.filter(v => v.estado !== 'cancelada').reduce((s, v) => s + v.total, 0);
    const count = currentVentas.filter(v => v.estado !== 'cancelada').length;

    container.innerHTML = `
      ${isDesktop() ? `<div class="page-header"><h1 class="page-header-title">Ventas</h1><button class="btn btn-primary" onclick="App.navigate('nueva-venta')">+ Nueva venta</button></div>` : ''}
      <!-- Month picker -->
      <div class="month-picker">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <input type="month" id="ventas-mes" value="${currentMes}" style="flex:1;border:none;background:none;font-size:14px;font-weight:600;outline:none;">
      </div>

      <!-- Canal filter chips -->
      <div class="filter-bar">
        <button class="chip ${currentCanal === '' ? 'active' : ''}" data-canal="">Todos</button>
        <button class="chip ${currentCanal === 'whatsapp'  ? 'active' : ''}" data-canal="whatsapp">💬 WhatsApp</button>
        <button class="chip ${currentCanal === 'instagram' ? 'active' : ''}" data-canal="instagram">📸 Instagram</button>
        <button class="chip ${currentCanal === 'feria'     ? 'active' : ''}" data-canal="feria">🎪 Feria</button>
        <button class="chip ${currentCanal === 'local'     ? 'active' : ''}" data-canal="local">🏪 Local</button>
        <button class="chip ${currentCanal === 'otro'      ? 'active' : ''}" data-canal="otro">📦 Otro</button>
      </div>

      <!-- Summary -->
      <div class="card mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <p class="card-title">Total del mes</p>
          <p class="card-value text-success">${fmt(totalIngresos)}</p>
        </div>
        <div style="text-align:right">
          <p class="card-title">Ventas</p>
          <p class="card-value">${count}</p>
        </div>
      </div>

      <!-- Ventas list / table -->
      ${currentVentas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <p class="empty-state-text">Sin ventas en este período</p>
          <p class="empty-state-sub">Cambia el mes o el filtro de canal</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('nueva-venta')">+ Nueva venta</button>
        </div>
      ` : isDesktop() ? `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Fecha</th><th>Cliente</th><th>Canal</th>
              <th>Productos</th><th>Pago</th><th>Estado</th><th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${currentVentas.map(v => `
              <tr onclick="showVentaDetail(${v.id})">
                <td style="color:var(--color-text-muted);font-size:12px">#${v.id}</td>
                <td>${v.fecha}</td>
                <td style="font-weight:600">${v.cliente_nombre || 'Venta directa'}</td>
                <td>${canalIcon(v.canal)} ${v.canal}</td>
                <td>${v.num_items} prod.</td>
                <td style="text-transform:capitalize">${v.metodo_pago}</td>
                <td>${estadoBadge(v.estado)}</td>
                <td style="text-align:right;font-weight:700" class="${v.estado === 'cancelada' ? 'text-muted' : 'text-success'}">${fmt(v.total)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <div class="list-card">
        ${currentVentas.map(v => `
          <div class="list-item" data-id="${v.id}" onclick="showVentaDetail(${v.id})">
            <div class="list-item-icon" style="background:var(--color-primary-light);font-size:20px">${canalIcon(v.canal)}</div>
            <div class="list-item-body">
              <p class="list-item-title">${v.cliente_nombre || 'Venta directa'}</p>
              <p class="list-item-sub">${v.fecha} · ${v.num_items} ${v.num_items === 1 ? 'producto' : 'productos'}</p>
              <p class="list-item-sub">${v.metodo_pago}</p>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount ${v.estado === 'cancelada' ? '' : 'positive'}">${fmt(v.total)}</p>
              <div style="margin-top:4px">${estadoBadge(v.estado)}</div>
            </div>
          </div>`).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Month filter
    document.getElementById('ventas-mes').addEventListener('change', async e => {
      currentMes = e.target.value;
      await render(container);
    });

    // Canal chips
    container.querySelectorAll('[data-canal]').forEach(chip => {
      chip.addEventListener('click', async () => {
        currentCanal = chip.dataset.canal;
        await render(container);
      });
    });
  }

  async function showVentaDetail(id) {
    let venta;
    try {
      venta = await API.ventas.get(id);
    } catch (err) {
      showToast('Error al cargar la venta', 'error');
      return;
    }

    const fmt2 = n => '$' + Number(n || 0).toFixed(2);
    const estadoLabels = { pagada: 'Pagada', pendiente: 'Pendiente', cancelada: 'Cancelada' };
    const metodosLabels = { efectivo: 'Efectivo', transferencia: 'Transferencia', mixto: 'Mixto' };

    const itemsHTML = venta.items.map(i => `
      <div class="detail-row">
        <span class="detail-row-label">${i.descripcion} ×${i.cantidad}</span>
        <span class="detail-row-value">${fmt2(i.subtotal)}</span>
      </div>
    `).join('');

    const content = `
      <div class="detail-section">
        <p class="detail-section-title">Información</p>
        <div class="detail-row"><span class="detail-row-label">Fecha</span><span class="detail-row-value">${venta.fecha}</span></div>
        <div class="detail-row"><span class="detail-row-label">Cliente</span><span class="detail-row-value">${venta.cliente_nombre || '—'}</span></div>
        <div class="detail-row"><span class="detail-row-label">Canal</span><span class="detail-row-value">${venta.canal}</span></div>
        <div class="detail-row"><span class="detail-row-label">Tipo</span><span class="detail-row-value">${venta.tipo}</span></div>
        <div class="detail-row"><span class="detail-row-label">Método pago</span><span class="detail-row-value">${metodosLabels[venta.metodo_pago] || venta.metodo_pago}</span></div>
        <div class="detail-row"><span class="detail-row-label">Estado</span><span class="detail-row-value">${estadoLabels[venta.estado] || venta.estado}</span></div>
        ${venta.notas ? `<div class="detail-row"><span class="detail-row-label">Notas</span><span class="detail-row-value">${venta.notas}</span></div>` : ''}
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Productos</p>
        ${itemsHTML}
      </div>

      <div class="total-box">
        <div class="total-row">
          <span class="total-row-label">Subtotal</span>
          <span class="total-row-value">${fmt2(venta.subtotal)}</span>
        </div>
        ${venta.descuento > 0 ? `
        <div class="total-row">
          <span class="total-row-label">Descuento</span>
          <span class="total-row-value text-danger">-${fmt2(venta.descuento)}</span>
        </div>` : ''}
        <div class="total-row grand">
          <span class="total-row-label">Total</span>
          <span class="total-row-value">${fmt2(venta.total)}</span>
        </div>
      </div>

      ${venta.estado !== 'cancelada' ? `
      <div style="display:flex;gap:10px;margin-top:8px">
        ${venta.estado === 'pendiente' ? `
        <button id="btn-marcar-pagada" class="btn btn-primary" style="flex:1">Marcar pagada</button>
        ` : ''}
        <button id="btn-cancelar-venta" class="btn btn-danger" style="flex:1">Cancelar venta</button>
      </div>
      ` : ''}
    `;

    Modal.show({
      title: `Venta #${venta.id}`,
      content
    });

    // Action buttons
    const btnPagada = document.getElementById('btn-marcar-pagada');
    if (btnPagada) {
      btnPagada.addEventListener('click', async () => {
        try {
          await API.ventas.update(id, { estado: 'pagada' });
          Modal.hide();
          showToast('Venta marcada como pagada', 'success');
          await render(document.getElementById('app-content'));
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    }

    const btnCancelar = document.getElementById('btn-cancelar-venta');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', async () => {
        if (!confirm('¿Cancelar esta venta? Se restaurará el stock.')) return;
        try {
          await API.ventas.cancel(id);
          Modal.hide();
          showToast('Venta cancelada', 'warning');
          await render(document.getElementById('app-content'));
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    }
  }

  // Expose showVentaDetail globally
  window.showVentaDetail = showVentaDetail;

  return { render };
})();
