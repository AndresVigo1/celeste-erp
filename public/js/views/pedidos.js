/* Celeste ERP — Pedidos view */
'use strict';

const PedidosView = (() => {
  let currentEstado = '';
  let showForm      = false;
  let clientes      = [];

  const ESTADOS = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'];
  const ESTADO_LABELS = {
    pendiente:  'Pendiente',
    en_proceso: 'En proceso',
    listo:      'Listo',
    entregado:  'Entregado',
    cancelado:  'Cancelado'
  };
  const ESTADO_BADGE = {
    pendiente:  'badge-yellow',
    en_proceso: 'badge-blue',
    listo:      'badge-green',
    entregado:  'badge-gray',
    cancelado:  'badge-red'
  };

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today  = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }

  function deliveryBadge(dateStr) {
    const d = daysUntil(dateStr);
    if (d === null) return '';
    if (d < 0) return `<span class="badge badge-red">Vencido ${Math.abs(d)}d</span>`;
    if (d === 0) return `<span class="badge badge-red">Hoy</span>`;
    if (d <= 3)  return `<span class="badge badge-yellow">${d}d</span>`;
    return `<span class="badge badge-green">${d}d</span>`;
  }

  async function render(container, opts = {}) {
    if (opts.showForm) showForm = true;

    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando pedidos...</p></div>`;

    let pedidos;
    try {
      [pedidos, clientes] = await Promise.all([
        API.pedidos.list({ estado: currentEstado }),
        API.clientes.list()
      ]);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar pedidos</p></div>`;
      return;
    }

    const activos = pedidos.filter(p => ['pendiente','en_proceso','listo'].includes(p.estado));

    container.innerHTML = `
      <!-- Estado filter chips -->
      <div class="filter-bar">
        <button class="chip ${currentEstado === '' ? 'active' : ''}" data-estado="">Todos</button>
        ${ESTADOS.map(e => `
          <button class="chip ${currentEstado === e ? 'active' : ''}" data-estado="${e}">${ESTADO_LABELS[e]}</button>
        `).join('')}
      </div>

      <!-- Summary -->
      <div class="card mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <p class="card-title">Activos</p>
          <p class="card-value">${activos.length}</p>
        </div>
        <div style="text-align:right">
          <p class="card-title">Saldo pendiente</p>
          <p class="card-value text-warning">${fmt(activos.reduce((s,p) => s + p.saldo, 0))}</p>
        </div>
      </div>

      <!-- New pedido form -->
      <div class="card mb-16 ${showForm ? '' : 'hidden'}" id="pedido-form-card">
        <p class="section-title" style="margin-bottom:16px">Nuevo pedido</p>
        <form id="form-nuevo-pedido">
          <div class="form-group">
            <label class="form-label">Cliente</label>
            <div class="autocomplete-wrapper">
              <input type="text" class="form-control" id="ped-cliente" placeholder="Buscar o escribir nombre..." autocomplete="off">
              <div class="autocomplete-list hidden" id="ped-cliente-ac"></div>
              <input type="hidden" id="ped-cliente-id">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción del pedido</label>
            <textarea class="form-control" id="ped-descripcion" rows="3" placeholder="Describe qué pide el cliente..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de entrega</label>
            <input type="date" class="form-control" id="ped-entrega">
          </div>
          <div class="form-group">
            <label class="form-label">Monto total (USD)</label>
            <input type="number" class="form-control" id="ped-monto" placeholder="0.00" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Adelanto recibido (USD)</label>
            <input type="number" class="form-control" id="ped-adelanto" placeholder="0.00" min="0" step="0.01" value="0">
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-control" id="ped-notas" rows="2" placeholder="Detalles adicionales, colores, tamaños..."></textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn-ghost" style="flex:1" id="btn-cancel-ped">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1" id="btn-save-ped">Crear pedido</button>
          </div>
        </form>
      </div>

      <!-- Add button -->
      <button class="btn btn-outline btn-block mb-16 ${showForm ? 'hidden' : ''}" id="btn-show-ped-form">
        + Nuevo pedido
      </button>

      <!-- Pedidos list -->
      ${pedidos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p class="empty-state-text">Sin pedidos${currentEstado ? ' en este estado' : ''}</p>
          <p class="empty-state-sub">Los encargos de clientes aparecerán aquí</p>
        </div>
      ` : `
      <div class="list-card">
        ${pedidos.map(p => `
          <div class="list-item" style="flex-wrap:wrap" onclick="PedidosView.showDetail(${p.id})">
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div class="list-item-icon" style="background:var(--color-info-bg);color:var(--color-info)">📋</div>
              <div class="list-item-body">
                <p class="list-item-title">${p.cliente_nombre || 'Sin cliente'}</p>
                <p class="list-item-sub">${p.descripcion.substring(0,50)}${p.descripcion.length>50?'…':''}</p>
                <p class="list-item-sub">${p.fecha_entrega ? '📅 ' + p.fecha_entrega : 'Sin fecha de entrega'}</p>
              </div>
              <div class="list-item-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <span class="badge ${ESTADO_BADGE[p.estado]||'badge-gray'}">${ESTADO_LABELS[p.estado]||p.estado}</span>
                ${p.fecha_entrega ? deliveryBadge(p.fecha_entrega) : ''}
                <p class="list-item-amount">${fmt(p.monto_total)}</p>
                ${p.saldo > 0 ? `<p style="font-size:11px;color:var(--color-warning)">Saldo: ${fmt(p.saldo)}</p>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Estado filter chips
    container.querySelectorAll('[data-estado]').forEach(chip => {
      chip.addEventListener('click', async () => {
        currentEstado = chip.dataset.estado;
        await render(container);
      });
    });

    // Show form
    document.getElementById('btn-show-ped-form')?.addEventListener('click', () => {
      showForm = true;
      render(container);
    });

    // Cancel form
    document.getElementById('btn-cancel-ped')?.addEventListener('click', () => {
      showForm = false;
      render(container);
    });

    // Client autocomplete in form
    const cliInput = document.getElementById('ped-cliente');
    const cliAc    = document.getElementById('ped-cliente-ac');
    const cliIdIn  = document.getElementById('ped-cliente-id');

    if (cliInput) {
      cliInput.addEventListener('input', () => {
        const q = cliInput.value.toLowerCase();
        if (q.length < 1) { cliAc.classList.add('hidden'); return; }
        const matches = clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 5);
        if (!matches.length) { cliAc.classList.add('hidden'); return; }
        cliAc.innerHTML = matches.map(c =>
          `<div class="autocomplete-item" data-cid="${c.id}" data-nombre="${c.nombre}">${c.nombre}</div>`
        ).join('');
        cliAc.classList.remove('hidden');
        cliAc.querySelectorAll('.autocomplete-item').forEach(opt => {
          opt.addEventListener('click', () => {
            cliInput.value  = opt.dataset.nombre;
            cliIdIn.value   = opt.dataset.cid;
            cliAc.classList.add('hidden');
          });
        });
      });
      document.addEventListener('click', e => {
        if (!cliInput.contains(e.target)) cliAc.classList.add('hidden');
      });
    }

    // Submit form
    document.getElementById('form-nuevo-pedido')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-ped');
      btn.disabled = true; btn.textContent = 'Creando...';

      const body = {
        cliente_id:     cliIdIn?.value ? parseInt(cliIdIn.value) : null,
        cliente_nombre: cliInput?.value.trim() || 'Sin nombre',
        descripcion:    document.getElementById('ped-descripcion').value.trim(),
        fecha_entrega:  document.getElementById('ped-entrega').value || null,
        monto_total:    parseFloat(document.getElementById('ped-monto').value) || 0,
        adelanto:       parseFloat(document.getElementById('ped-adelanto').value) || 0,
        notas:          document.getElementById('ped-notas').value.trim() || null
      };

      try {
        await API.pedidos.create(body);
        showToast('Pedido creado', 'success');
        showForm = false;
        await render(container);
      } catch (err) {
        showToast(err.message || 'Error al crear pedido', 'error');
        btn.disabled = false; btn.textContent = 'Crear pedido';
      }
    });
  }

  async function showDetail(id) {
    let pedido;
    try {
      pedido = await API.pedidos.get(id);
    } catch (err) {
      showToast('Error al cargar pedido', 'error');
      return;
    }

    const ESTADO_BADGE_L = {
      pendiente:'badge-yellow', en_proceso:'badge-blue', listo:'badge-green',
      entregado:'badge-gray', cancelado:'badge-red'
    };

    const nextEstados = {
      pendiente:  ['en_proceso', 'listo', 'cancelado'],
      en_proceso: ['listo', 'cancelado'],
      listo:      ['entregado', 'cancelado'],
      entregado:  [],
      cancelado:  []
    };

    const available = nextEstados[pedido.estado] || [];

    const content = `
      <div class="detail-section">
        <p class="detail-section-title">Información</p>
        <div class="detail-row"><span class="detail-row-label">Cliente</span><span class="detail-row-value">${pedido.cliente_nombre || '—'}</span></div>
        <div class="detail-row"><span class="detail-row-label">Estado</span>
          <span class="badge ${ESTADO_BADGE_L[pedido.estado]}">${ESTADO_LABELS[pedido.estado]}</span>
        </div>
        <div class="detail-row"><span class="detail-row-label">Encargo</span><span class="detail-row-value">${pedido.fecha_encargo}</span></div>
        <div class="detail-row"><span class="detail-row-label">Entrega</span><span class="detail-row-value">${pedido.fecha_entrega || 'Sin fecha'} ${pedido.fecha_entrega ? deliveryBadge(pedido.fecha_entrega) : ''}</span></div>
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Descripción</p>
        <p style="font-size:14px;color:var(--color-text);padding:8px 0">${pedido.descripcion}</p>
        ${pedido.notas ? `<p style="font-size:13px;color:var(--color-text-muted)">${pedido.notas}</p>` : ''}
      </div>

      <div class="total-box">
        <div class="total-row">
          <span class="total-row-label">Total</span>
          <span class="total-row-value">$${Number(pedido.monto_total).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-row-label">Adelanto</span>
          <span class="total-row-value text-success">$${Number(pedido.adelanto).toFixed(2)}</span>
        </div>
        <div class="total-row grand">
          <span class="total-row-label">Saldo</span>
          <span class="total-row-value ${pedido.saldo > 0 ? '' : 'text-success'}">$${Number(pedido.saldo).toFixed(2)}</span>
        </div>
      </div>

      <!-- Change status -->
      ${available.length > 0 ? `
      <div style="margin-top:16px">
        <p class="form-label" style="margin-bottom:8px">Cambiar estado:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${available.map(e => `
            <button class="btn btn-sm btn-outline btn-change-estado" data-ped-id="${pedido.id}" data-estado="${e}">
              → ${ESTADO_LABELS[e]}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Convert to sale -->
      ${['pendiente','en_proceso','listo'].includes(pedido.estado) && !pedido.venta_id ? `
      <button id="btn-convertir-venta" class="btn btn-primary btn-block" style="margin-top:16px">
        💰 Convertir a venta
      </button>
      ` : ''}
      ${pedido.venta_id ? `<p class="text-muted" style="font-size:12px;margin-top:12px;text-align:center">Venta #${pedido.venta_id} generada</p>` : ''}
    `;

    Modal.show({ title: `Pedido #${pedido.id}`, content });

    // Change estado buttons
    document.querySelectorAll('.btn-change-estado').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newEstado = btn.dataset.estado;
        try {
          await API.pedidos.update(pedido.id, { estado: newEstado });
          Modal.hide();
          showToast('Estado actualizado', 'success');
          const container = document.getElementById('app-content');
          await render(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Convert to sale
    const btnConvertir = document.getElementById('btn-convertir-venta');
    if (btnConvertir) {
      btnConvertir.addEventListener('click', async () => {
        Modal.hide();
        // Navigate to nueva-venta with pedido pre-filled
        App.navigate('nueva-venta', { pedido });
      });
    }
  }

  window.PedidosView = { showDetail };

  return { render, showDetail };
})();
