/* Celeste ERP — Clientes view */
'use strict';

const ClientesView = (() => {
  let searchQuery = '';
  let showForm    = false;

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  const CANAL_ICONS = { whatsapp:'💬', instagram:'📸', referido:'🤝', feria:'🎪', otro:'📦' };

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando clientes...</p></div>`;

    let clientes;
    try {
      clientes = await API.clientes.list({ q: searchQuery });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar clientes</p></div>`;
      return;
    }

    container.innerHTML = `
      <!-- Search -->
      <div class="form-group" style="margin-bottom:12px">
        <div style="position:relative">
          <input type="search" class="form-control" id="cliente-search" placeholder="Buscar por nombre, teléfono o Instagram..."
            value="${searchQuery}" style="padding-left:40px">
          <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:.4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>

      <!-- Add client form -->
      <div class="card mb-16 ${showForm ? '' : 'hidden'}" id="cliente-form-card">
        <p class="section-title" style="margin-bottom:16px">Nuevo cliente</p>
        <form id="form-nuevo-cliente">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-control" id="cli-nombre" placeholder="Nombre completo" required>
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono (WhatsApp)</label>
            <input type="tel" class="form-control" id="cli-telefono" placeholder="+593 99 000 0000">
          </div>
          <div class="form-group">
            <label class="form-label">Instagram</label>
            <input type="text" class="form-control" id="cli-instagram" placeholder="@usuario">
          </div>
          <div class="form-group">
            <label class="form-label">Canal preferido</label>
            <select class="form-control" id="cli-canal">
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="instagram">📸 Instagram</option>
              <option value="referido">🤝 Referido</option>
              <option value="feria">🎪 Feria</option>
              <option value="otro">📦 Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-control" id="cli-notas" rows="2" placeholder="Preferencias, historia, etc."></textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn-ghost" style="flex:1" id="btn-cancel-cli">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1" id="btn-save-cli">Agregar</button>
          </div>
        </form>
      </div>

      <!-- Add button -->
      <button class="btn btn-outline btn-block mb-16 ${showForm ? 'hidden' : ''}" id="btn-show-cli-form">
        + Agregar cliente
      </button>

      <!-- Count -->
      <p class="text-muted" style="font-size:13px;margin-bottom:12px">${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}</p>

      <!-- Client list -->
      ${clientes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <p class="empty-state-text">${searchQuery ? 'Sin resultados' : 'Sin clientes aún'}</p>
          <p class="empty-state-sub">${searchQuery ? 'Intenta con otro término' : 'Agrega tu primer cliente'}</p>
        </div>
      ` : `
      <div class="list-card">
        ${clientes.map(c => `
          <div class="list-item" onclick="ClientesView.showDetail(${c.id})">
            <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary);font-size:20px">
              ${CANAL_ICONS[c.canal_preferido] || '👤'}
            </div>
            <div class="list-item-body">
              <p class="list-item-title">${c.nombre}</p>
              <p class="list-item-sub">${c.telefono || c.instagram || 'Sin contacto'}</p>
              <p class="list-item-sub">${c.total_compras} compra${c.total_compras !== 1 ? 's' : ''} · ${fmt(c.monto_total)}</p>
            </div>
            <div class="list-item-right">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        `).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Search
    const searchInput = document.getElementById('cliente-search');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        searchQuery = searchInput.value;
        await render(container);
      }, 300);
    });

    // Show form
    document.getElementById('btn-show-cli-form')?.addEventListener('click', () => {
      showForm = true;
      render(container);
    });

    // Cancel form
    document.getElementById('btn-cancel-cli')?.addEventListener('click', () => {
      showForm = false;
      render(container);
    });

    // Submit form
    document.getElementById('form-nuevo-cliente')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-cli');
      btn.disabled = true; btn.textContent = 'Guardando...';

      const body = {
        nombre:         document.getElementById('cli-nombre').value.trim(),
        telefono:       document.getElementById('cli-telefono').value.trim() || null,
        instagram:      document.getElementById('cli-instagram').value.trim() || null,
        canal_preferido:document.getElementById('cli-canal').value,
        notas:          document.getElementById('cli-notas').value.trim() || null
      };

      try {
        await API.clientes.create(body);
        showToast('Cliente agregado', 'success');
        showForm = false;
        searchQuery = '';
        await render(container);
      } catch (err) {
        showToast(err.message || 'Error al guardar', 'error');
        btn.disabled = false; btn.textContent = 'Agregar';
      }
    });
  }

  async function showDetail(id) {
    let cliente;
    try {
      cliente = await API.clientes.get(id);
    } catch (err) {
      showToast('Error al cargar cliente', 'error');
      return;
    }

    const CANAL_ICONS_L = { whatsapp:'💬', instagram:'📸', referido:'🤝', feria:'🎪', otro:'📦' };
    const estadoBadge = e => {
      const m = { pagada:'badge-green', pendiente:'badge-yellow', cancelada:'badge-red' };
      return `<span class="badge ${m[e]||'badge-gray'}">${e}</span>`;
    };

    const ventasHTML = cliente.ventas.length ? cliente.ventas.map(v => `
      <div class="detail-row">
        <span class="detail-row-label">${v.fecha} · ${v.num_items} prod.</span>
        <span class="detail-row-value">$${Number(v.total).toFixed(2)} ${estadoBadge(v.estado)}</span>
      </div>
    `).join('') : '<p class="text-muted" style="font-size:13px;padding:8px 0">Sin compras registradas</p>';

    const pedidosHTML = cliente.pedidos.length ? cliente.pedidos.map(p => `
      <div class="detail-row">
        <span class="detail-row-label">${p.fecha_encargo} — ${p.descripcion.substring(0,30)}…</span>
        <span class="detail-row-value">$${Number(p.monto_total).toFixed(2)}</span>
      </div>
    `).join('') : '<p class="text-muted" style="font-size:13px;padding:8px 0">Sin pedidos</p>';

    const content = `
      <div class="detail-section">
        <p class="detail-section-title">Contacto</p>
        <div class="detail-row"><span class="detail-row-label">Nombre</span><span class="detail-row-value">${cliente.nombre}</span></div>
        ${cliente.telefono ? `<div class="detail-row"><span class="detail-row-label">Teléfono</span><a href="https://wa.me/${cliente.telefono.replace(/\D/g,'')}" class="detail-row-value text-primary">${cliente.telefono}</a></div>` : ''}
        ${cliente.instagram ? `<div class="detail-row"><span class="detail-row-label">Instagram</span><span class="detail-row-value">${cliente.instagram}</span></div>` : ''}
        <div class="detail-row"><span class="detail-row-label">Canal preferido</span><span class="detail-row-value">${CANAL_ICONS_L[cliente.canal_preferido]} ${cliente.canal_preferido}</span></div>
        ${cliente.notas ? `<div class="detail-row"><span class="detail-row-label">Notas</span><span class="detail-row-value">${cliente.notas}</span></div>` : ''}
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Resumen</p>
        <div class="detail-row"><span class="detail-row-label">Total compras</span><span class="detail-row-value">${cliente.stats.total_compras}</span></div>
        <div class="detail-row"><span class="detail-row-label">Monto total</span><span class="detail-row-value text-success">$${Number(cliente.stats.monto_total).toFixed(2)}</span></div>
        ${cliente.stats.ultima_compra ? `<div class="detail-row"><span class="detail-row-label">Última compra</span><span class="detail-row-value">${cliente.stats.ultima_compra}</span></div>` : ''}
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Historial de compras</p>
        ${ventasHTML}
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Pedidos</p>
        ${pedidosHTML}
      </div>

      ${cliente.telefono ? `
      <a href="https://wa.me/${cliente.telefono.replace(/\D/g,'')}" target="_blank" class="btn btn-primary btn-block" style="margin-top:8px;text-decoration:none">
        💬 Abrir WhatsApp
      </a>
      ` : ''}
    `;

    Modal.show({ title: cliente.nombre, content });
  }

  // Expose for inline onclick
  window.ClientesView = { showDetail };

  return { render, showDetail };
})();
