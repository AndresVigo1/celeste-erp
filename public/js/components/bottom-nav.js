/* Celeste ERP — Bottom navigation */
'use strict';

const BottomNav = (() => {
  let currentView = 'dashboard';
  let actionSheetOpen = false;

  function init() {
    const nav       = document.getElementById('bottom-nav');
    const fab       = document.getElementById('btn-fab');
    const sheet     = document.getElementById('action-sheet');
    const backdrop  = document.getElementById('action-sheet-backdrop');
    const cancelBtn = document.getElementById('action-sheet-cancel');

    if (!nav) return;

    // Nav item clicks
    nav.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'mas') {
          App.navigate('mas');
        } else {
          App.navigate(view);
        }
      });
    });

    // FAB button → action sheet
    if (fab) {
      fab.addEventListener('click', () => {
        toggleActionSheet(true);
      });
    }

    // Action sheet buttons
    if (sheet) {
      sheet.querySelectorAll('.action-sheet-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          toggleActionSheet(false);
          const view = btn.dataset.view;
          App.navigate(view);
        });
      });
    }

    // Close action sheet
    if (cancelBtn) cancelBtn.addEventListener('click', () => toggleActionSheet(false));
    if (backdrop)  backdrop.addEventListener('click',  () => toggleActionSheet(false));
  }

  function toggleActionSheet(open) {
    const sheet    = document.getElementById('action-sheet');
    const backdrop = document.getElementById('action-sheet-backdrop');
    actionSheetOpen = open;
    if (sheet)    sheet.classList.toggle('hidden', !open);
    if (backdrop) backdrop.classList.toggle('hidden', !open);
  }

  function setActive(view) {
    currentView = view;
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    nav.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      const isActive = btn.dataset.view === view ||
        (view === 'nueva-venta' && btn.dataset.view === 'ventas') ||
        (view === 'nuevo-gasto' && btn.dataset.view === 'gastos') ||
        (view === 'nuevo-pedido' && btn.dataset.view === 'pedidos') ||
        (view === 'mas' && btn.dataset.view === 'mas') ||
        (view === 'inventario' && btn.dataset.view === 'mas') ||
        (view === 'clientes' && btn.dataset.view === 'mas');
      btn.classList.toggle('active', isActive);
    });

    toggleActionSheet(false);
  }

  function getActive() { return currentView; }

  return { init, setActive, getActive };
})();
