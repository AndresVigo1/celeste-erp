/* Celeste ERP — Cursos view */
'use strict';

const CursosView = (() => {
  let showForm   = false;
  let currentMes = '';

  function fmt(n) { return '$' + Number(n || 0).toFixed(2); }

  function estadoBadge(e) {
    const map = { activo: 'badge-green', finalizado: 'badge-gray', cancelado: 'badge-red' };
    return `<span class="badge ${map[e] || 'badge-gray'}">${e}</span>`;
  }

  function pagoBadge(e) {
    const map = { pagado: 'badge-green', parcial: 'badge-yellow', pendiente: 'badge-red' };
    return `<span class="badge ${map[e] || 'badge-gray'}">${e}</span>`;
  }

  async function render(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando cursos...</p></div>`;

    let cursos;
    try {
      const params = {};
      if (currentMes) params.mes = currentMes;
      cursos = await API.cursos.list(params);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error al cargar cursos</p></div>`;
      return;
    }

    const totalIngresos = cursos.reduce((s, c) => s + c.ingresos_cobrados, 0);
    const totalInscritas = cursos.reduce((s, c) => s + c.num_inscritas, 0);

    container.innerHTML = `
      ${isDesktop() ? `<div class="page-header"><h1 class="page-header-title">Cursos</h1></div>` : ''}

      <!-- Month picker -->
      <div class="month-picker">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <input type="month" id="cursos-mes" value="${currentMes}" style="flex:1;border:none;background:none;font-size:14px;font-weight:600;outline:none;">
      </div>

      <!-- Summary -->
      <div class="card mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <p class="card-title">Ingresos cobrados</p>
          <p class="card-value text-success">${fmt(totalIngresos)}</p>
        </div>
        <div style="text-align:center">
          <p class="card-title">Cursos</p>
          <p class="card-value">${cursos.length}</p>
        </div>
        <div style="text-align:right">
          <p class="card-title">Inscritas</p>
          <p class="card-value">${totalInscritas}</p>
        </div>
      </div>

      <!-- New course form -->
      <div class="card mb-16 ${showForm ? '' : 'hidden'}" id="curso-form-card">
        <p class="section-title" style="margin-bottom:16px">Nuevo curso</p>
        <form id="form-nuevo-curso">
          <div class="form-group">
            <label class="form-label">Nombre del curso</label>
            <input type="text" class="form-control" id="curso-nombre" placeholder="Ej: Curso de Cricut" required>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción (opcional)</label>
            <textarea class="form-control" id="curso-descripcion" rows="2" placeholder="Temas, materiales, etc."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de inicio</label>
            <input type="date" class="form-control" id="curso-fecha-inicio" value="${new Date().toISOString().slice(0,10)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de fin (opcional)</label>
            <input type="date" class="form-control" id="curso-fecha-fin">
          </div>
          <div class="form-group">
            <label class="form-label">Precio por persona (USD)</label>
            <input type="number" class="form-control" id="curso-precio" placeholder="0.00" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Cupo máximo (opcional)</label>
            <input type="number" class="form-control" id="curso-cupo" placeholder="Sin límite" min="1" step="1">
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <textarea class="form-control" id="curso-notas" rows="2" placeholder="Info adicional..."></textarea>
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn-ghost" style="flex:1" id="btn-cancel-curso">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="flex:1" id="btn-save-curso">Crear curso</button>
          </div>
        </form>
      </div>

      <!-- Add button -->
      <button class="btn btn-outline btn-block mb-16 ${showForm ? 'hidden' : ''}" id="btn-show-curso-form">
        + Nuevo curso
      </button>

      <!-- Cursos list / table -->
      ${cursos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎓</div>
          <p class="empty-state-text">Sin cursos en este período</p>
          <p class="empty-state-sub">Crea tu primer curso para comenzar</p>
        </div>
      ` : isDesktop() ? `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nombre</th><th>Fecha inicio</th><th>Precio</th>
              <th>Inscritas</th><th>Cobrado</th><th>Gastos</th><th>Utilidad</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${cursos.map(c => {
              const utilidad = c.ingresos_cobrados - c.total_gastos;
              return `
              <tr style="cursor:pointer" onclick="CursosView.showDetail(${c.id})">
                <td style="font-weight:600">${c.nombre}</td>
                <td>${c.fecha_inicio}${c.fecha_fin && c.fecha_fin !== c.fecha_inicio ? ' → ' + c.fecha_fin : ''}</td>
                <td>${fmt(c.precio)}</td>
                <td>${c.num_inscritas}${c.cupo ? ' / ' + c.cupo : ''}</td>
                <td class="text-success" style="font-weight:700">${fmt(c.ingresos_cobrados)}</td>
                <td class="text-danger">${fmt(c.total_gastos)}</td>
                <td style="font-weight:700" class="${utilidad >= 0 ? 'text-success' : 'text-danger'}">${fmt(utilidad)}</td>
                <td>${estadoBadge(c.estado)}</td>
                <td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();CursosView.showDetail(${c.id})">Ver</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <div class="list-card">
        ${cursos.map(c => {
          const utilidad = c.ingresos_cobrados - c.total_gastos;
          return `
          <div class="list-item" onclick="CursosView.showDetail(${c.id})">
            <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary);font-size:20px">🎓</div>
            <div class="list-item-body">
              <p class="list-item-title">${c.nombre}</p>
              <p class="list-item-sub">${c.fecha_inicio} · ${c.num_inscritas} inscrita${c.num_inscritas !== 1 ? 's' : ''}</p>
              <div style="display:flex;gap:6px;margin-top:4px">
                ${estadoBadge(c.estado)}
              </div>
            </div>
            <div class="list-item-right">
              <p class="list-item-amount positive">${fmt(c.ingresos_cobrados)}</p>
              <p style="font-size:11px;color:${utilidad >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};text-align:right;margin-top:2px">
                util. ${fmt(utilidad)}
              </p>
            </div>
          </div>`;
        }).join('')}
      </div>
      `}
      <div style="height:8px"></div>
    `;

    // Month filter
    document.getElementById('cursos-mes').addEventListener('change', async e => {
      currentMes = e.target.value;
      await render(container);
    });

    // Show form
    document.getElementById('btn-show-curso-form')?.addEventListener('click', () => {
      showForm = true;
      render(container);
    });

    // Cancel form
    document.getElementById('btn-cancel-curso')?.addEventListener('click', () => {
      showForm = false;
      render(container);
    });

    // Submit form
    document.getElementById('form-nuevo-curso')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-curso');
      btn.disabled = true; btn.textContent = 'Creando...';

      const body = {
        nombre:       document.getElementById('curso-nombre').value.trim(),
        descripcion:  document.getElementById('curso-descripcion').value.trim() || null,
        fecha_inicio: document.getElementById('curso-fecha-inicio').value,
        fecha_fin:    document.getElementById('curso-fecha-fin').value || null,
        precio:       parseFloat(document.getElementById('curso-precio').value),
        cupo:         document.getElementById('curso-cupo').value ? parseInt(document.getElementById('curso-cupo').value) : null,
        notas:        document.getElementById('curso-notas').value.trim() || null,
      };

      try {
        await API.cursos.create(body);
        showToast('Curso creado', 'success');
        showForm = false;
        await render(container);
      } catch (err) {
        showToast(err.message || 'Error al crear', 'error');
        btn.disabled = false; btn.textContent = 'Crear curso';
      }
    });
  }

  // ── Detail modal ─────────────────────────────────────────────────────────────
  async function showDetail(id) {
    let curso;
    try {
      curso = await API.cursos.get(id);
    } catch (err) {
      showToast('Error al cargar curso', 'error');
      return;
    }

    const utilidad = curso.stats.ingresos_cobrados - curso.stats.total_gastos;
    const saldoPendiente = curso.stats.ingresos_esperados - curso.stats.ingresos_cobrados;

    const sessionesHTML = curso.sesiones.length ? curso.sesiones.map(s => `
      <div class="detail-row">
        <span class="detail-row-label">📅 ${s.fecha}${s.descripcion ? ' — ' + s.descripcion : ''}</span>
        <button class="btn btn-sm btn-ghost" style="color:var(--color-danger);padding:2px 8px"
          data-delete-sesion="${s.id}">✕</button>
      </div>
    `).join('') : '<p class="text-muted" style="font-size:13px;padding:4px 0">Sin sesiones registradas</p>';

    const inscritasHTML = curso.inscripciones.length ? curso.inscripciones.map(i => `
      <div class="detail-row" style="flex-wrap:wrap;gap:4px">
        <span class="detail-row-label">${i.cliente_nombre || i.nombre_libre}</span>
        <span class="detail-row-value" style="display:flex;align-items:center;gap:8px">
          ${fmt(i.monto_pagado)} / ${fmt(i.monto_total)}
          ${pagoBadge(i.estado_pago)}
          <button class="btn btn-sm btn-ghost" style="color:var(--color-primary);padding:2px 8px"
            data-edit-inscripcion="${i.id}" data-monto-total="${i.monto_total}" data-monto-pagado="${i.monto_pagado}">Editar</button>
          <button class="btn btn-sm btn-ghost" style="color:var(--color-danger);padding:2px 8px"
            data-delete-inscripcion="${i.id}">✕</button>
        </span>
      </div>
    `).join('') : '<p class="text-muted" style="font-size:13px;padding:4px 0">Sin inscritas aún</p>';

    const gastosHTML = curso.gastos.length ? curso.gastos.map(g => `
      <div class="detail-row">
        <span class="detail-row-label">${g.fecha} — ${g.descripcion}</span>
        <span class="detail-row-value" style="display:flex;align-items:center;gap:8px">
          <span class="text-danger">${fmt(g.monto)}</span>
          <button class="btn btn-sm btn-ghost" style="color:var(--color-danger);padding:2px 8px"
            data-delete-gasto-curso="${g.id}">✕</button>
        </span>
      </div>
    `).join('') : '<p class="text-muted" style="font-size:13px;padding:4px 0">Sin gastos registrados</p>';

    const content = `
      <!-- KPIs de rentabilidad -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="card" style="padding:12px">
          <p class="card-title" style="font-size:11px">Cobrado</p>
          <p class="card-value text-success" style="font-size:20px">${fmt(curso.stats.ingresos_cobrados)}</p>
        </div>
        <div class="card" style="padding:12px">
          <p class="card-title" style="font-size:11px">Gastos</p>
          <p class="card-value text-danger" style="font-size:20px">${fmt(curso.stats.total_gastos)}</p>
        </div>
        <div class="card" style="padding:12px">
          <p class="card-title" style="font-size:11px">Utilidad</p>
          <p class="card-value ${utilidad >= 0 ? 'text-success' : 'text-danger'}" style="font-size:20px">${fmt(utilidad)}</p>
        </div>
        <div class="card" style="padding:12px">
          <p class="card-title" style="font-size:11px">Pendiente</p>
          <p class="card-value text-warning" style="font-size:20px">${fmt(saldoPendiente)}</p>
        </div>
      </div>

      <!-- Info general -->
      <div class="detail-section">
        <p class="detail-section-title">Detalles</p>
        <div class="detail-row"><span class="detail-row-label">Precio por persona</span><span class="detail-row-value">${fmt(curso.precio)}</span></div>
        <div class="detail-row"><span class="detail-row-label">Inscritas</span><span class="detail-row-value">${curso.stats.num_inscritas}${curso.cupo ? ' / ' + curso.cupo : ''}</span></div>
        <div class="detail-row"><span class="detail-row-label">Inicio</span><span class="detail-row-value">${curso.fecha_inicio}</span></div>
        ${curso.fecha_fin ? `<div class="detail-row"><span class="detail-row-label">Fin</span><span class="detail-row-value">${curso.fecha_fin}</span></div>` : ''}
        <div class="detail-row"><span class="detail-row-label">Estado</span><span class="detail-row-value">${estadoBadge(curso.estado)}</span></div>
        ${curso.notas ? `<div class="detail-row"><span class="detail-row-label">Notas</span><span class="detail-row-value">${curso.notas}</span></div>` : ''}
      </div>

      <!-- Sesiones -->
      <div class="detail-section">
        <p class="detail-section-title">Sesiones</p>
        ${sessionesHTML}
        <form id="form-add-sesion" style="display:flex;gap:8px;margin-top:10px">
          <input type="date" class="form-control" id="sesion-fecha" style="flex:1" value="${new Date().toISOString().slice(0,10)}">
          <input type="text" class="form-control" id="sesion-desc" placeholder="Descripción (opcional)" style="flex:2">
          <button type="submit" class="btn btn-primary btn-sm">+ Sesión</button>
        </form>
      </div>

      <!-- Inscritas -->
      <div class="detail-section">
        <p class="detail-section-title">Inscritas (${curso.stats.num_inscritas})</p>
        ${inscritasHTML}
        <div id="add-inscrita-form" style="margin-top:12px;border-top:1px solid var(--color-border);padding-top:12px">
          <p style="font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px">AGREGAR INSCRITA</p>
          <input type="text" class="form-control" id="inscrita-nombre" placeholder="Nombre (si no está en clientes)" style="margin-bottom:6px">
          <div style="display:flex;gap:8px;margin-bottom:6px">
            <div style="flex:1">
              <label style="font-size:11px;color:var(--color-text-muted)">Total a pagar</label>
              <input type="number" class="form-control" id="inscrita-total" value="${curso.precio}" min="0" step="0.01">
            </div>
            <div style="flex:1">
              <label style="font-size:11px;color:var(--color-text-muted)">Monto pagado</label>
              <input type="number" class="form-control" id="inscrita-pagado" value="${curso.precio}" min="0" step="0.01">
            </div>
          </div>
          <button class="btn btn-outline btn-sm btn-block" id="btn-add-inscrita">+ Agregar inscrita</button>
        </div>
      </div>

      <!-- Gastos del curso -->
      <div class="detail-section">
        <p class="detail-section-title">Gastos del curso</p>
        ${gastosHTML}
        <form id="form-add-gasto-curso" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <input type="date" class="form-control" id="gasto-curso-fecha" value="${new Date().toISOString().slice(0,10)}" style="flex:1;min-width:130px">
          <input type="text" class="form-control" id="gasto-curso-desc" placeholder="Descripción" style="flex:2;min-width:140px">
          <input type="number" class="form-control" id="gasto-curso-monto" placeholder="0.00" min="0.01" step="0.01" style="flex:1;min-width:100px">
          <button type="submit" class="btn btn-danger btn-sm">+ Gasto</button>
        </form>
      </div>

      <!-- Cambiar estado -->
      <div style="display:flex;gap:8px;margin-top:4px">
        ${curso.estado !== 'finalizado' ? `<button class="btn btn-ghost btn-sm" style="flex:1" data-set-estado="finalizado">Finalizar curso</button>` : ''}
        ${curso.estado !== 'cancelado'  ? `<button class="btn btn-ghost btn-sm" style="flex:1;color:var(--color-danger)" data-set-estado="cancelado">Cancelar curso</button>` : ''}
      </div>
    `;

    const modalContainer = Modal.show({ title: `🎓 ${curso.nombre}`, content });

    // -- Sesiones
    document.getElementById('form-add-sesion')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await API.cursos.sesiones.create(id, {
          fecha:       document.getElementById('sesion-fecha').value,
          descripcion: document.getElementById('sesion-desc').value.trim() || null,
        });
        showToast('Sesión agregada', 'success');
        Modal.hide();
        showDetail(id);
      } catch (err) { showToast(err.message, 'error'); }
    });

    modalContainer?.querySelectorAll('[data-delete-sesion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.cursos.sesiones.delete(id, btn.dataset.deleteSesion);
          showToast('Sesión eliminada', 'success');
          Modal.hide(); showDetail(id);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // -- Inscritas
    document.getElementById('btn-add-inscrita')?.addEventListener('click', async () => {
      const nombre = document.getElementById('inscrita-nombre').value.trim();
      const total  = parseFloat(document.getElementById('inscrita-total').value);
      const pagado = parseFloat(document.getElementById('inscrita-pagado').value);
      if (!nombre) { showToast('Ingresa el nombre', 'error'); return; }
      try {
        await API.cursos.inscripciones.create(id, {
          nombre_libre: nombre,
          monto_total:  total,
          monto_pagado: pagado,
        });
        showToast('Inscrita agregada', 'success');
        Modal.hide(); showDetail(id);
      } catch (err) { showToast(err.message, 'error'); }
    });

    modalContainer?.querySelectorAll('[data-edit-inscripcion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const iid    = btn.dataset.editInscripcion;
        const actual = parseFloat(btn.dataset.montoPagado);
        const total  = parseFloat(btn.dataset.montoTotal);
        const nuevo  = prompt(`Monto pagado actual: $${actual.toFixed(2)}\nNuevo monto pagado:`, actual);
        if (nuevo === null) return;
        const nuevoPagado = parseFloat(nuevo);
        if (isNaN(nuevoPagado) || nuevoPagado < 0) { showToast('Monto inválido', 'error'); return; }
        try {
          await API.cursos.inscripciones.update(id, iid, { monto_total: total, monto_pagado: nuevoPagado });
          showToast('Pago actualizado', 'success');
          Modal.hide(); showDetail(id);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    modalContainer?.querySelectorAll('[data-delete-inscripcion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar inscrita?')) return;
        try {
          await API.cursos.inscripciones.delete(id, btn.dataset.deleteInscripcion);
          showToast('Inscrita eliminada', 'success');
          Modal.hide(); showDetail(id);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // -- Gastos del curso
    document.getElementById('form-add-gasto-curso')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await API.cursos.gastos.create(id, {
          fecha:       document.getElementById('gasto-curso-fecha').value,
          descripcion: document.getElementById('gasto-curso-desc').value.trim(),
          monto:       parseFloat(document.getElementById('gasto-curso-monto').value),
        });
        showToast('Gasto registrado', 'success');
        Modal.hide(); showDetail(id);
      } catch (err) { showToast(err.message, 'error'); }
    });

    modalContainer?.querySelectorAll('[data-delete-gasto-curso]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.cursos.gastos.delete(id, btn.dataset.deleteGastoCurso);
          showToast('Gasto eliminado', 'success');
          Modal.hide(); showDetail(id);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // -- Estado
    modalContainer?.querySelectorAll('[data-set-estado]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const estado = btn.dataset.setEstado;
        if (!confirm(`¿Marcar curso como "${estado}"?`)) return;
        try {
          await API.cursos.update(id, { estado });
          showToast(`Curso ${estado}`, 'success');
          Modal.hide();
          await render(document.getElementById('app-content'));
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  window.CursosView = { showDetail };

  return { render, showDetail };
})();
