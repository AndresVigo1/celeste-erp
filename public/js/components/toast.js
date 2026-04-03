/* Celeste ERP — Toast notifications */
'use strict';

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✓',
    error:   '✕',
    warning: '⚠'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after 3.5 seconds
  const remove = () => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
  };

  const timer = setTimeout(remove, 3500);

  // Click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}
