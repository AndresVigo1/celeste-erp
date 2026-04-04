/* Celeste ERP — Inventario view */
'use strict';

const InventarioView = (() => {
  let showForm    = false;
  let editProduct = null;

  function stockClass(actual, minimo) {
    if (actual <= 0) return 'stock-critical';
    if (actual < minimo) return 'stock-critical';
    if (actual <= minimo + 2) return 'stock-low';
    return 'stock-ok';
  }

  function stockLabel(actual, minimo) {
    if (actual <= 0) return 'Sin stock';
    if (actual < minimo) return 'Crítico';
    if (actual <= minimo + 2) return 'Bajo';
    return 'OK';
  }

  async function render(container, opts = {}) {
    if (opts.showForm) { showForm = true; editProduct = opts.producto || null; }

    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando inventario...</p></div>`;

    let productos;
    try {
      productos = await API.productos.list();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar inventario</p></div>`;
      return;
    }

    const total   = productos.length;
    const sinStock = productos.filter(p => p.stock_actual <= 0).length;
    const bajo     = productos.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo + 2).length;

    container.innerHTML = `
      ${isDesktop() ? `<div class="page-header"><h1 class="page-header-title">Inventario</h1></div>` : ''}
      <!-- Summary -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="card">
          <p class="card-title">Productos</p>
          <p class="card-value">${total}</p>
        </div>
        <div class="card">
          <p class="card-title">Sin stock</p>
          <p class="card-value text-danger">${sinStock}</p>
        </div>
        <div class="card" style="grid-column:1/-1">
          <p class="card-title">Stock bajo/crítico</p>
          <p class="card-value text-warning">${bajo}</p>
        </div>
      </div>

      <!-- Add/Edit product form -->
      <div class="card mb-16 ${showForm ? '' : 'hidden'}" id="prod-form-card">
        <p class="section-title" style="margin-bottom:16px">${editProduct ? 'Editar producto' : 'Nuevo producto'}</p>
        <form id="form-producto">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-control" id="prod-nombre" value="${editProduct?.nombre || ''}" placeholder="Nombre del producto" required>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <textarea class="form-control" id="prod-descripcion" rows="2" placeholder="Descripción opcional">${editProduct?.descripcion || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <input type="text" class="form-control" id="prod-categoria" value="${editProduct?.categoria || ''}" placeholder="Ej: Accesorios, Decoración...">
          </div>
          <div class="form-group">
            <label class="form-label">Precio de venta (USD)</label>
            <input type="number" class="form-control" id="prod-precio" value="${editProduct?.precio_venta || ''}" placeholder="0.00" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Costo de material (USD)</label>
            <input type="number" class="form-control" id="prod-costo" value="${editProduct?.costo_material || ''}" placeholder="0.00" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Stock actual</label>
            <input type="number" class="form-control" id="prod-stock" value="${editProduct?.stock_actual ?? 0}" min="0" step="1" required>
          </div>
          <div class="form-group">
            <label class="form-label">Stock mínimo (alerta)</label>
            <input type="number" class="form-control" id="prod-stock-min" value="${editProduct?.stock_minimo ?? 5}" min="0" step="1">
          </div>
          <div class="form-group">
            <label class="form-label">Unidad</label>
            <input type="text" class="form-control" id="prod-unidad" value="${editProduct?.unidad || 'unidad'}" placeholder="unidad, par, kit...">
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn-ghost" style="flex:1" id="btn-cancel-prod">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1" id="btn-save-prod">
              ${editProduct ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>

      <!-- Add button -->
      <button class="btn btn-outline btn-block mb-16 ${showForm ? 'hidden' : ''}" id="btn-show-prod-form">
        + Agregar producto
      </button>

      <!-- Product list -->
      ${productos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p class="empty-state-text">Sin productos</p>
          <p class="empty-state-sub">Agrega tu primer producto al catálogo</p>
        </div>
      ` : isDesktop() ? `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Margen</th><th>Stock</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${productos.map(p => {
              const cls = stockClass(p.stock_actual, p.stock_minimo);
              const lbl = stockLabel(p.stock_actual, p.stock_minimo);
              const margen = p.precio_venta > 0 ? ((p.precio_venta - p.costo_material) / p.precio_venta * 100).toFixed(0) : 0;
              return `
              <tr>
                <td style="font-weight:600">${p.nombre}</td>
                <td style="color:var(--color-text-muted)">${p.categoria || '—'}</td>
                <td>$${p.precio_venta.toFixed(2)}</td>
                <td style="color:var(--color-text-muted)">$${p.costo_material.toFixed(2)}</td>
                <td>${margen}%</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="stepper" style="max-width:120px">
                      <button type="button" class="stepper-btn btn-dec" data-pid="${p.id}">−</button>
                      <span class="stepper-val" id="stock-val-${p.id}">${p.stock_actual}</span>
                      <button type="button" class="stepper-btn btn-inc" data-pid="${p.id}">+</button>
                    </div>
                    <span style="font-size:11px;color:var(--color-text-muted)">${p.unidad}</span>
                  </div>
                </td>
                <td><span class="stock-indicator ${cls}"><span class="stock-dot"></span>${lbl}</span></td>
                <td style="display:flex;gap:6px">
                  <button class="btn btn-sm btn-ghost" data-edit-prod="${p.id}">Editar</button>
                  <button class="btn btn-sm btn-ghost" data-delete-prod="${p.id}" style="color:var(--color-danger)">Quitar</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <div class="list-card">
        ${productos.map(p => {
          const cls = stockClass(p.stock_actual, p.stock_minimo);
          const lbl = stockLabel(p.stock_actual, p.stock_minimo);
          const margen = p.precio_venta > 0 ? ((p.precio_venta - p.costo_material) / p.precio_venta * 100).toFixed(0) : 0;
          return `
          <div class="list-item" style="flex-wrap:wrap;gap:0" data-prod-id="${p.id}">
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary)">📦</div>
              <div class="list-item-body">
                <p class="list-item-title">${p.nombre}</p>
                <p class="list-item-sub">$${p.precio_venta.toFixed(2)} · costo $${p.costo_material.toFixed(2)} · margen ${margen}%</p>
                ${p.categoria ? `<p class="list-item-sub">${p.categoria}</p>` : ''}
              </div>
              <div class="list-item-right">
                <span class="stock-indicator ${cls}">
                  <span class="stock-dot"></span>
                  ${p.stock_actual} ${p.unidad}
                </span>
                <p style="font-size:10px;color:var(--color-text-muted);text-align:right;margin-top:2px">mín: ${p.stock_minimo}</p>
              </div>
            </div>
            <!-- Stock stepper -->
            <div style="display:flex;align-items:center;gap:10px;margin-top:10px;width:100%;padding-left:52px">
              <div class="stepper" style="flex:1;max-width:160px">
                <button type="button" class="stepper-btn btn-dec" data-pid="${p.id}">−</button>
                <span class="stepper-val" id="stock-val-${p.id}">${p.stock_actual}</span>
                <button type="button" class="stepper-btn btn-inc" data-pid="${p.id}">+</button>
              </div>
              <button class="btn btn-sm btn-ghost" data-edit-prod="${p.id}" style="font-size:12px">Editar</button>
              <button class="btn btn-sm btn-ghost" data-delete-prod="${p.id}" style="font-size:12px;color:var(--color-danger)">Quitar</button>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Show form
    document.getElementById('btn-show-prod-form')?.addEventListener('click', () => {
      showForm = true; editProduct = null;
      render(container);
    });

    // Cancel form
    document.getElementById('btn-cancel-prod')?.addEventListener('click', () => {
      showForm = false; editProduct = null;
      render(container);
    });

    // Save product form
    document.getElementById('form-producto')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-prod');
      btn.disabled = true;

      const body = {
        nombre:        document.getElementById('prod-nombre').value.trim(),
        descripcion:   document.getElementById('prod-descripcion').value.trim() || null,
        categoria:     document.getElementById('prod-categoria').value.trim() || null,
        precio_venta:  parseFloat(document.getElementById('prod-precio').value),
        costo_material:parseFloat(document.getElementById('prod-costo').value),
        stock_actual:  parseInt(document.getElementById('prod-stock').value),
        stock_minimo:  parseInt(document.getElementById('prod-stock-min').value) || 5,
        unidad:        document.getElementById('prod-unidad').value.trim() || 'unidad'
      };

      try {
        if (editProduct) {
          await API.productos.update(editProduct.id, body);
          showToast('Producto actualizado', 'success');
        } else {
          await API.productos.create(body);
          showToast('Producto agregado', 'success');
        }
        showForm = false; editProduct = null;
        await render(container);
      } catch (err) {
        showToast(err.message || 'Error al guardar', 'error');
        btn.disabled = false;
      }
    });

    // Stock steppers
    container.querySelectorAll('.btn-dec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = parseInt(btn.dataset.pid);
        const valEl = document.getElementById('stock-val-' + pid);
        const current = parseInt(valEl.textContent) || 0;
        if (current <= 0) return;
        try {
          const updated = await API.productos.update(pid, { stock_ajuste: -1 });
          valEl.textContent = updated.stock_actual;
          showToast('Stock actualizado', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.btn-inc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = parseInt(btn.dataset.pid);
        const valEl = document.getElementById('stock-val-' + pid);
        try {
          const updated = await API.productos.update(pid, { stock_ajuste: +1 });
          valEl.textContent = updated.stock_actual;
          showToast('Stock actualizado', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Edit buttons
    container.querySelectorAll('[data-edit-prod]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const pid = parseInt(btn.dataset.editProd);
        try {
          const prod = await API.productos.get(pid);
          showForm = true; editProduct = prod;
          await render(container);
          document.getElementById('prod-form-card')?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-delete-prod]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const pid = btn.dataset.deleteProd;
        if (!confirm('¿Quitar este producto del catálogo?')) return;
        try {
          await API.productos.delete(pid);
          showToast('Producto desactivado', 'success');
          await render(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  return { render };
})();
