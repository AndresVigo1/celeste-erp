/* Celeste ERP — Nueva venta view */
'use strict';

const NuevaVentaView = (() => {
  let productos = [];
  let clientes  = [];
  let items     = [];
  let selectedCanal = 'whatsapp';
  let selectedTipo  = 'stock';
  let selectedMetodo = 'efectivo';
  let selectedClienteId = null;

  async function render(container, opts = {}) {
    // Reset state
    items = [];
    selectedCanal    = 'whatsapp';
    selectedTipo     = 'stock';
    selectedMetodo   = 'efectivo';
    selectedClienteId = null;

    // Prefill from pedido if provided
    const pedido = opts.pedido || null;

    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Preparando...</p></div>`;

    try {
      [productos, clientes] = await Promise.all([
        API.productos.list(),
        API.clientes.list()
      ]);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar datos</p></div>`;
      return;
    }

    container.innerHTML = buildHTML(pedido);
    bindEvents(container, pedido);
    updateTotal();
  }

  function buildHTML(pedido) {
    const today = new Date().toISOString().slice(0, 10);
    return `
    <form id="form-nueva-venta" autocomplete="off">

      <!-- Fecha -->
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input type="date" class="form-control" id="venta-fecha" value="${today}" max="${today}">
      </div>

      <!-- Cliente -->
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <div class="autocomplete-wrapper">
          <input type="text" class="form-control" id="venta-cliente" placeholder="Buscar o escribir nombre..." autocomplete="off">
          <div class="autocomplete-list hidden" id="cliente-autocomplete"></div>
        </div>
        <input type="hidden" id="venta-cliente-id">
      </div>

      <!-- Canal -->
      <div class="form-group">
        <label class="form-label">Canal de venta</label>
        <div class="canal-chips" id="canal-chips">
          <button type="button" class="canal-chip active" data-canal="whatsapp">💬 WhatsApp</button>
          <button type="button" class="canal-chip" data-canal="instagram">📸 Instagram</button>
          <button type="button" class="canal-chip" data-canal="feria">🎪 Feria</button>
          <button type="button" class="canal-chip" data-canal="local">🏪 Local</button>
          <button type="button" class="canal-chip" data-canal="otro">📦 Otro</button>
        </div>
      </div>

      <!-- Tipo -->
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <div class="canal-chips" id="tipo-chips">
          <button type="button" class="canal-chip active" data-tipo="stock">Desde stock</button>
          <button type="button" class="canal-chip" data-tipo="encargo">Encargo</button>
        </div>
      </div>

      <!-- Divider -->
      <p class="detail-section-title" style="margin-bottom:12px">Productos</p>

      <!-- Items container -->
      <div id="items-container"></div>

      <!-- Add item button -->
      <button type="button" class="add-item-btn" id="btn-add-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Agregar producto
      </button>

      <!-- Totals -->
      <div class="total-box" id="totals-box">
        <div class="total-row"><span class="total-row-label">Subtotal</span><span class="total-row-value" id="display-subtotal">$0.00</span></div>
        <div class="total-row">
          <span class="total-row-label">Descuento ($)</span>
          <span style="width:80px">
            <input type="number" id="descuento-input" class="form-control" value="0" min="0" step="0.50"
              style="text-align:right;padding:6px 8px;font-size:14px;font-weight:700;min-height:36px">
          </span>
        </div>
        <div class="total-row grand">
          <span class="total-row-label">Total</span>
          <span class="total-row-value" id="display-total">$0.00</span>
        </div>
      </div>

      <!-- Método pago -->
      <div class="form-group">
        <label class="form-label">Método de pago</label>
        <div class="canal-chips" id="metodo-chips">
          <button type="button" class="canal-chip active" data-metodo="efectivo">💵 Efectivo</button>
          <button type="button" class="canal-chip" data-metodo="transferencia">🏦 Transferencia</button>
          <button type="button" class="canal-chip" data-metodo="mixto">🔀 Mixto</button>
        </div>
      </div>

      <!-- Estado -->
      <div class="form-group">
        <label class="form-label">Estado de pago</label>
        <select class="form-control" id="venta-estado">
          <option value="pagada">Pagada ✓</option>
          <option value="pendiente">Pendiente de pago</option>
        </select>
      </div>

      <!-- Notas -->
      <div class="form-group">
        <label class="form-label">Notas (opcional)</label>
        <textarea class="form-control" id="venta-notas" placeholder="Alguna nota sobre esta venta..." rows="2"></textarea>
      </div>

      <!-- Save -->
      <div class="sticky-actions">
        <button type="submit" class="btn btn-primary btn-block" id="btn-guardar-venta">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Guardar venta
        </button>
      </div>
    </form>
    `;
  }

  function addItemRow(container, preset = null) {
    const idx = items.length;
    const item = {
      id: Date.now() + idx,
      producto_id: null,
      descripcion: preset ? preset.descripcion : '',
      cantidad: preset ? preset.cantidad : 1,
      precio_unitario: preset ? preset.precio_unitario : 0,
      costo_unitario: preset ? preset.costo_unitario : 0
    };
    items.push(item);

    const prodOptions = productos.map(p =>
      `<option value="${p.id}" data-precio="${p.precio_venta}" data-costo="${p.costo_material}" data-nombre="${p.nombre}">${p.nombre} — $${p.precio_venta.toFixed(2)} (stock: ${p.stock_actual})</option>`
    ).join('');

    const rowEl = document.createElement('div');
    rowEl.className = 'item-row';
    rowEl.dataset.itemId = item.id;
    rowEl.innerHTML = `
      <div class="item-row-header">
        <div style="flex:1">
          <label class="form-label" style="margin-bottom:4px">Producto</label>
          <div class="autocomplete-wrapper">
            <input type="text" class="form-control item-prod-search" placeholder="Buscar producto o descripción libre..."
              value="${item.descripcion}" style="font-size:14px;min-height:44px" autocomplete="off">
            <div class="autocomplete-list hidden item-prod-list"></div>
            <input type="hidden" class="item-prod-id" value="${item.producto_id || ''}">
          </div>
        </div>
        <button type="button" class="btn-remove-item" style="margin-top:24px;flex-shrink:0" data-item-id="${item.id}">✕</button>
      </div>
      <div class="item-row-inputs">
        <div>
          <label class="form-label" style="margin-bottom:4px">Cantidad</label>
          <input type="number" class="form-control item-cantidad" value="${item.cantidad}" min="1" step="1" style="min-height:44px">
        </div>
        <div>
          <label class="form-label" style="margin-bottom:4px">Precio unit.</label>
          <input type="number" class="form-control item-precio" value="${item.precio_unitario || ''}" min="0" step="0.50" placeholder="0.00" style="min-height:44px">
        </div>
      </div>
      <p class="item-row-subtotal">Subtotal: <span class="item-sub-val">$0.00</span></p>
    `;

    const itemsContainer = document.getElementById('items-container');
    itemsContainer.appendChild(rowEl);

    // Product search autocomplete
    const searchInput = rowEl.querySelector('.item-prod-search');
    const acList      = rowEl.querySelector('.item-prod-list');
    const hiddenId    = rowEl.querySelector('.item-prod-id');
    const cantInput   = rowEl.querySelector('.item-cantidad');
    const precioInput = rowEl.querySelector('.item-precio');
    const subVal      = rowEl.querySelector('.item-sub-val');

    function getItemIndex() {
      return items.findIndex(it => it.id === item.id);
    }

    function calcItemSub() {
      const cant   = parseFloat(cantInput.value) || 0;
      const precio = parseFloat(precioInput.value) || 0;
      subVal.textContent = '$' + (cant * precio).toFixed(2);
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const idx2 = getItemIndex();
      if (idx2 >= 0) {
        items[idx2].descripcion = searchInput.value;
        items[idx2].producto_id = null;
        hiddenId.value = '';
      }
      if (q.length < 1) { acList.classList.add('hidden'); return; }

      const matches = productos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 6);
      if (matches.length === 0) { acList.classList.add('hidden'); return; }

      acList.innerHTML = matches.map(p =>
        `<div class="autocomplete-item" data-pid="${p.id}" data-precio="${p.precio_venta}" data-costo="${p.costo_material}" data-nombre="${p.nombre}">
          <div>${p.nombre}</div>
          <div class="autocomplete-item-sub">$${p.precio_venta.toFixed(2)} · stock: ${p.stock_actual}</div>
        </div>`
      ).join('');
      acList.classList.remove('hidden');

      acList.querySelectorAll('.autocomplete-item').forEach(opt => {
        opt.addEventListener('click', () => {
          const i2 = getItemIndex();
          if (i2 >= 0) {
            items[i2].producto_id     = parseInt(opt.dataset.pid);
            items[i2].descripcion     = opt.dataset.nombre;
            items[i2].precio_unitario = parseFloat(opt.dataset.precio);
            items[i2].costo_unitario  = parseFloat(opt.dataset.costo);
          }
          searchInput.value = opt.dataset.nombre;
          precioInput.value = parseFloat(opt.dataset.precio).toFixed(2);
          hiddenId.value    = opt.dataset.pid;
          acList.classList.add('hidden');
          calcItemSub();
          updateTotal();
        });
      });
    });

    document.addEventListener('click', e => {
      if (!rowEl.contains(e.target)) acList.classList.add('hidden');
    });

    cantInput.addEventListener('input', () => {
      const i2 = getItemIndex();
      if (i2 >= 0) items[i2].cantidad = parseInt(cantInput.value) || 1;
      calcItemSub();
      updateTotal();
    });

    precioInput.addEventListener('input', () => {
      const i2 = getItemIndex();
      if (i2 >= 0) items[i2].precio_unitario = parseFloat(precioInput.value) || 0;
      calcItemSub();
      updateTotal();
    });

    // Remove item
    rowEl.querySelector('.btn-remove-item').addEventListener('click', () => {
      const i2 = items.findIndex(it => it.id === item.id);
      if (i2 >= 0) items.splice(i2, 1);
      rowEl.remove();
      updateTotal();
    });

    // If preset has price, calc immediately
    if (preset && preset.precio_unitario) {
      precioInput.value = preset.precio_unitario.toFixed(2);
      calcItemSub();
    }

    updateTotal();
    return rowEl;
  }

  function updateTotal() {
    let subtotal = 0;
    document.querySelectorAll('.item-row').forEach(row => {
      const cant   = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
      const precio = parseFloat(row.querySelector('.item-precio')?.value)   || 0;
      subtotal += cant * precio;
    });
    const descuento = parseFloat(document.getElementById('descuento-input')?.value) || 0;
    const total = Math.max(0, subtotal - descuento);

    const elSub   = document.getElementById('display-subtotal');
    const elTotal = document.getElementById('display-total');
    if (elSub)   elSub.textContent   = '$' + subtotal.toFixed(2);
    if (elTotal) elTotal.textContent = '$' + total.toFixed(2);
  }

  function bindEvents(container, pedido) {
    // Canal chips
    container.querySelectorAll('#canal-chips .canal-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCanal = btn.dataset.canal;
        container.querySelectorAll('#canal-chips .canal-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Tipo chips
    container.querySelectorAll('#tipo-chips .canal-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTipo = btn.dataset.tipo;
        container.querySelectorAll('#tipo-chips .canal-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Metodo chips
    container.querySelectorAll('#metodo-chips .canal-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMetodo = btn.dataset.metodo;
        container.querySelectorAll('#metodo-chips .canal-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Cliente autocomplete
    const clienteInput = document.getElementById('venta-cliente');
    const clienteAc    = document.getElementById('cliente-autocomplete');
    const clienteIdIn  = document.getElementById('venta-cliente-id');

    clienteInput.addEventListener('input', () => {
      selectedClienteId = null;
      clienteIdIn.value = '';
      const q = clienteInput.value.toLowerCase();
      if (q.length < 1) { clienteAc.classList.add('hidden'); return; }
      const matches = clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) { clienteAc.classList.add('hidden'); return; }
      clienteAc.innerHTML = matches.map(c =>
        `<div class="autocomplete-item" data-cid="${c.id}" data-nombre="${c.nombre}">
          <div>${c.nombre}</div>
          <div class="autocomplete-item-sub">${c.canal_preferido} ${c.telefono ? '· ' + c.telefono : ''}</div>
        </div>`
      ).join('');
      clienteAc.classList.remove('hidden');
      clienteAc.querySelectorAll('.autocomplete-item').forEach(opt => {
        opt.addEventListener('click', () => {
          selectedClienteId = parseInt(opt.dataset.cid);
          clienteInput.value  = opt.dataset.nombre;
          clienteIdIn.value   = opt.dataset.cid;
          clienteAc.classList.add('hidden');
        });
      });
    });
    document.addEventListener('click', e => {
      if (!clienteInput.contains(e.target)) clienteAc.classList.add('hidden');
    });

    // Add item button
    document.getElementById('btn-add-item').addEventListener('click', () => {
      addItemRow(container);
      // Scroll to new item
      setTimeout(() => {
        const rows = document.querySelectorAll('.item-row');
        if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });

    // Descuento input
    document.getElementById('descuento-input').addEventListener('input', updateTotal);

    // Add first item row automatically
    addItemRow(container);

    // If converting from pedido, pre-fill all fields
    if (pedido) {
      clienteInput.value = pedido.cliente_nombre || '';
      selectedClienteId  = pedido.cliente_id || null;
      if (pedido.cliente_id) clienteIdIn.value = pedido.cliente_id;

      // Set tipo to encargo
      selectedTipo = 'encargo';
      document.querySelectorAll('#tipo-chips .canal-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.tipo === 'encargo');
      });

      // Fill first item with pedido description and total
      const firstRow = document.querySelector('.item-row');
      if (firstRow) {
        firstRow.querySelector('.item-prod-search').value = pedido.descripcion;
        firstRow.querySelector('.item-precio').value = Number(pedido.monto_total).toFixed(2);
        items[0] = { ...items[0], descripcion: pedido.descripcion, precio_unitario: pedido.monto_total, costo_unitario: 0 };
        firstRow.querySelector('.item-sub-val').textContent = '$' + Number(pedido.monto_total).toFixed(2);
        updateTotal();
      }

      // Pre-fill notas
      const notasEl = document.getElementById('venta-notas');
      if (notasEl) {
        notasEl.value = ['Pedido #' + pedido.id, pedido.notas].filter(Boolean).join(' — ');
      }
    }

    // Form submit
    document.getElementById('form-nueva-venta').addEventListener('submit', async e => {
      e.preventDefault();
      await saveVenta(container, pedido);
    });
  }

  async function saveVenta(container, pedido = null) {
    const btn = document.getElementById('btn-guardar-venta');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    // Build items from DOM (most up-to-date values)
    const domItems = [];
    document.querySelectorAll('.item-row').forEach(row => {
      const prodId  = row.querySelector('.item-prod-id')?.value;
      const desc    = row.querySelector('.item-prod-search')?.value?.trim();
      const cant    = parseInt(row.querySelector('.item-cantidad')?.value) || 1;
      const precio  = parseFloat(row.querySelector('.item-precio')?.value) || 0;
      const itemIdx = items.findIndex(it => String(it.id) === String(row.dataset.itemId));
      const costo   = itemIdx >= 0 ? items[itemIdx].costo_unitario : 0;
      domItems.push({
        producto_id:    prodId ? parseInt(prodId) : null,
        descripcion:    desc || 'Producto',
        cantidad:       cant,
        precio_unitario:precio,
        costo_unitario: costo
      });
    });

    if (domItems.length === 0) {
      showToast('Agrega al menos un producto', 'warning');
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Guardar venta'; }
      return;
    }

    const body = {
      fecha:          document.getElementById('venta-fecha').value,
      cliente_id:     selectedClienteId || null,
      cliente_nombre: document.getElementById('venta-cliente').value.trim() || null,
      canal:          selectedCanal,
      tipo:           selectedTipo,
      descuento:      parseFloat(document.getElementById('descuento-input').value) || 0,
      estado:         document.getElementById('venta-estado').value,
      metodo_pago:    selectedMetodo,
      notas:          document.getElementById('venta-notas').value.trim() || null,
      items:          domItems
    };

    try {
      const venta = await API.ventas.create(body);
      // Si viene de un pedido, marcarlo como entregado y vincularlo a la venta
      if (pedido) {
        await API.pedidos.update(pedido.id, { estado: 'entregado', venta_id: venta.id });
      }
      showToast('Venta guardada correctamente', 'success');
      App.navigate('ventas');
    } catch (err) {
      showToast(err.message || 'Error al guardar la venta', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Guardar venta'; }
    }
  }

  return { render };
})();
