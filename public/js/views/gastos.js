/* Celeste ERP — Gastos view */
'use strict';

const GastosView = (() => {
  let currentMes = currentMonthStr();
  let currentCat = '';
  let showForm   = false;

  function currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  const CATEGORIAS = ['materiales','empaque','publicidad','herramientas','servicios','transporte','otros'];
  const CAT_ICONS  = {
    materiales:  '🧵',
    empaque:     '📦',
    publicidad:  '📢',
    herramientas:'🔧',
    servicios:   '⚡',
    transporte:  '🚚',
    otros:       '📋'
  };

  const CAT_BADGE = {
    materiales:  'badge-blue',
    empaque:     'badge-purple',
    publicidad:  'badge-yellow',
    herramientas:'badge-gray',
    servicios:   'badge-green',
    transporte:  'badge-gray',
    otros:       'badge-gray'
  };

  async function render(container, opts = {}) {
    if (opts.showForm) showForm = true;

    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando gastos...</p></div>`;

    let data;
    try {
      data = await API.gastos.list({ mes: currentMes, categoria: currentCat });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar gastos</p></div>`;
      return;
    }

    const { gastos, totales } = data;
    const totalMes = gastos.reduce((s, g) => s + g.monto, 0);

    container.innerHTML = `
      <!-- Month picker -->
      <div class="month-picker">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <input type="month" id="gastos-mes" value="${currentMes}" style="flex:1;border:none;background:none;font-size:14px;font-weight:600;outline:none;">
      </div>

      <!-- Category filter chips -->
      <div class="filter-bar">
        <button class="chip ${currentCat === '' ? 'active' : ''}" data-cat="">Todos</button>
        ${CATEGORIAS.map(c => `
          <button class="chip ${currentCat === c ? 'active' : ''}" data-cat="${c}">${CAT_ICONS[c]} ${c}</button>
        `).join('')}
      </div>

      <!-- Summary -->
      <div class="card mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <p class="card-title">Total gastos</p>
          <p class="card-value text-danger">${fmt(totalMes)}</p>
        </div>
        <div style="text-align:right">
          <p class="card-title">Registros</p>
          <p class="card-value">${gastos.length}</p>
        </div>
      </div>

      <!-- Category breakdown -->
      ${totales.length > 0 ? `
      <div class="card mb-16">
        <p class="card-title" style="margin-bottom:8px">Por categoría</p>
        ${totales.map(t => `
          <div class="detail-row">
            <span class="detail-row-label">${CAT_ICONS[t.categoria] || '📋'} ${t.categoria}</span>
            <span class="detail-row-value text-danger">${fmt(t.total)}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Add form -->
      <div class="card mb-16 ${showForm ? '' : 'hidden'}" id="gasto-form-card">
        <p class="section-title" style="margin-bottom:16px">Nuevo gasto</p>
        <form id="form-nuevo-gasto">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-control" id="gasto-fecha" value="${new Date().toISOString().slice(0,10)}" max="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="form-control" id="gasto-categoria">
              ${CATEGORIAS.map(c => `<option value="${c}">${CAT_ICONS[c]} ${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <input type="text" class="form-control" id="gasto-descripcion" placeholder="Qué compraste o pagaste..." required>
          </div>
          <div class="form-group">
            <label class="form-label">Proveedor (opcional)</label>
            <input type="text" class="form-control" id="gasto-proveedor" placeholder="Nombre del proveedor o tienda">
          </div>
          <div class="form-group">
            <label class="form-label">Monto (USD)</label>
            <input type="number" class="form-control" id="gasto-monto" placeholder="0.00" min="0.01" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Método de pago</label>
            <select class="form-control" id="gasto-metodo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <textarea class="form-control" id="gasto-notas" rows="2" placeholder="Notas adicionales..."></textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn-ghost" style="flex:1" id="btn-cancel-gasto">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1" id="btn-save-gasto">Guardar</button>
          </div>
        </form>
      </div>

      <!-- Add button (hidden when form is open) -->
      <button class="btn btn-outline btn-block mb-16 ${showForm ? 'hidden' : ''}" id="btn-show-form-gasto">
        + Registrar gasto
      </button>

      <!-- Gastos list -->
      ${gastos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💸</div>
          <p class="empty-state-text">Sin gastos en este período</p>
          <p class="empty-state-sub">Registra tus gastos para llevar control</p>
        </div>
      ` : `
      <div class="list-card">
        ${gastos.map(g => `
          <div class="list-item" data-gasto-id="${g.id}">
            <div class="list-item-icon" style="background:var(--color-danger-bg);color:var(--color-danger)">
              ${CAT_ICONS[g.categoria] || '📋'}
            </div>
            <div class="list-item-body">
              <p class="list-item-title">${g.descripcion}</p>
              <p class="list-item-sub">${g.fecha} · ${g.proveedor || g.metodo_pago}</p>
              <span class="badge ${CAT_BADGE[g.categoria] || 'badge-gray'}">${g.categoria}</span>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount negative">-${fmt(g.monto)}</p>
              <button class="btn btn-sm btn-ghost" style="margin-top:4px;padding:4px 8px;font-size:11px" data-delete-gasto="${g.id}">Eliminar</button>
            </div>
          </div>
        `).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Month change
    document.getElementById('gastos-mes').addEventListener('change', async e => {
      currentMes = e.target.value;
      await render(container);
    });

    // Category chips
    container.querySelectorAll('[data-cat]').forEach(chip => {
      chip.addEventListener('click', async () => {
        currentCat = chip.dataset.cat;
        await render(container);
      });
    });

    // Show form
    const btnShow = document.getElementById('btn-show-form-gasto');
    if (btnShow) btnShow.addEventListener('click', () => {
      showForm = true;
      render(container);
    });

    // Cancel form
    const btnCancel = document.getElementById('btn-cancel-gasto');
    if (btnCancel) btnCancel.addEventListener('click', () => {
      showForm = false;
      render(container);
    });

    // Submit form
    const form = document.getElementById('form-nuevo-gasto');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-gasto');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const body = {
          fecha:       document.getElementById('gasto-fecha').value,
          categoria:   document.getElementById('gasto-categoria').value,
          descripcion: document.getElementById('gasto-descripcion').value.trim(),
          proveedor:   document.getElementById('gasto-proveedor').value.trim() || null,
          monto:       parseFloat(document.getElementById('gasto-monto').value),
          metodo_pago: document.getElementById('gasto-metodo').value,
          notas:       document.getElementById('gasto-notas').value.trim() || null
        };

        try {
          await API.gastos.create(body);
          showToast('Gasto registrado', 'success');
          showForm = false;
          currentMes = body.fecha.substring(0, 7);
          await render(container);
        } catch (err) {
          showToast(err.message || 'Error al guardar', 'error');
          btn.disabled = false; btn.textContent = 'Guardar';
        }
      });
    }

    // Delete buttons
    container.querySelectorAll('[data-delete-gasto]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.deleteGasto;
        if (!confirm('¿Eliminar este gasto?')) return;
        try {
          await API.gastos.delete(id);
          showToast('Gasto eliminado', 'success');
          await render(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  return { render };
})();
