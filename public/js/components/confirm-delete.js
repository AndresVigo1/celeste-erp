/* Celeste ERP — ConfirmDelete component
 *
 * Usage:
 *   ConfirmDelete.show({
 *     id:        14,              // the number the user must type
 *     entityLabel: 'venta #14',  // shown in the dialog
 *     onConfirm: async () => { ... }  // called after match
 *   });
 */
'use strict';

const ConfirmDelete = (() => {

  function show({ id, entityLabel, onConfirm }) {
    const idStr = String(id);

    const content = `
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:44px;margin-bottom:12px">🗑</div>
        <p style="font-size:15px;font-weight:600;color:var(--color-text);margin-bottom:6px">
          Eliminar ${entityLabel}
        </p>
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:20px">
          Esta acción no se puede deshacer.<br>
          Para confirmar, escribe el número
          <strong style="font-size:18px;color:var(--color-danger);letter-spacing:2px"> ${idStr} </strong>
          a continuación.
        </p>
        <input
          id="confirm-delete-input"
          type="number"
          inputmode="numeric"
          placeholder="${idStr}"
          autocomplete="off"
          style="
            width:100%;
            text-align:center;
            font-size:22px;
            font-weight:700;
            letter-spacing:4px;
            padding:12px;
            border:2px solid var(--color-border);
            border-radius:12px;
            outline:none;
            color:var(--color-text);
            background:var(--color-bg-alt, #F8FAFC);
            transition:border-color .15s;
            box-sizing:border-box;
          "
        >
        <p id="confirm-delete-hint" style="font-size:12px;color:var(--color-text-muted);margin-top:6px;min-height:16px"></p>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button id="confirm-delete-cancel" class="btn btn-ghost" style="flex:1">Cancelar</button>
        <button id="confirm-delete-ok" class="btn" style="flex:1;background:var(--color-danger);color:#fff;opacity:.4;cursor:not-allowed" disabled>
          Eliminar
        </button>
      </div>
    `;

    Modal.show({ title: 'Confirmar eliminación', content });

    const input  = document.getElementById('confirm-delete-input');
    const okBtn  = document.getElementById('confirm-delete-ok');
    const hint   = document.getElementById('confirm-delete-hint');
    const cancel = document.getElementById('confirm-delete-cancel');

    input?.focus();

    input?.addEventListener('input', () => {
      const val = input.value.trim();
      const match = val === idStr;
      okBtn.disabled = !match;
      okBtn.style.opacity  = match ? '1'  : '.4';
      okBtn.style.cursor   = match ? 'pointer' : 'not-allowed';
      input.style.borderColor = val === ''
        ? 'var(--color-border)'
        : match ? 'var(--color-success)' : 'var(--color-danger)';
      hint.textContent = val === '' ? '' : match ? '✓ Coincide' : `Escribe ${idStr}`;
      hint.style.color = match ? 'var(--color-success)' : 'var(--color-danger)';
    });

    okBtn?.addEventListener('click', async () => {
      okBtn.disabled = true;
      okBtn.textContent = 'Eliminando…';
      try {
        await onConfirm();
        Modal.hide();
      } catch (err) {
        showToast(err.message || 'Error al eliminar', 'error');
        okBtn.disabled = false;
        okBtn.textContent = 'Eliminar';
      }
    });

    cancel?.addEventListener('click', () => Modal.hide());

    // also close on Escape (handled by app.js keyboard shortcut)
  }

  return { show };
})();
