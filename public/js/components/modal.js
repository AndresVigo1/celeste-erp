/* Celeste ERP — Modal component */
'use strict';

const Modal = (() => {
  let onCloseCallback = null;

  function show({ title, content, actions = [], onClose } = {}) {
    const backdrop  = document.getElementById('modal-backdrop');
    const container = document.getElementById('modal-container');
    if (!backdrop || !container) return;

    onCloseCallback = onClose || null;

    const actionsHTML = actions.map(a =>
      `<button class="btn ${a.class || 'btn-ghost'}" data-action="${a.id || ''}">${a.label}</button>`
    ).join('');

    container.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">${title || ''}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        ${typeof content === 'string' ? content : ''}
      </div>
      ${actions.length ? `<div class="modal-actions">${actionsHTML}</div>` : ''}
    `;

    // If content is a DOM node, append it
    if (content && typeof content === 'object' && content.nodeType) {
      container.querySelector('.modal-body').appendChild(content);
    }

    backdrop.classList.remove('hidden');
    container.classList.remove('hidden');

    // Close handlers
    document.getElementById('modal-close-btn').addEventListener('click', hide);
    backdrop.addEventListener('click', hide, { once: true });

    // Action buttons
    actions.forEach(a => {
      if (a.onClick) {
        const btn = container.querySelector(`[data-action="${a.id}"]`);
        if (btn) btn.addEventListener('click', a.onClick);
      }
    });

    return container;
  }

  function hide() {
    const backdrop  = document.getElementById('modal-backdrop');
    const container = document.getElementById('modal-container');
    if (backdrop)  backdrop.classList.add('hidden');
    if (container) container.classList.add('hidden');
    if (onCloseCallback) {
      onCloseCallback();
      onCloseCallback = null;
    }
  }

  function isOpen() {
    const container = document.getElementById('modal-container');
    return container && !container.classList.contains('hidden');
  }

  return { show, hide, isOpen };
})();
