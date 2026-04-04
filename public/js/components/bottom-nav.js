/* Celeste ERP — Navigation controller (bottom nav + sidebar) */
'use strict';

const BottomNav = (() => {
  let currentView = 'dashboard';
  let actionSheetOpen = false;
  let fabMenuOpen = false;

  const SIDEBAR_VIEWS = ['dashboard','ventas','pedidos','inventario','clientes','gastos'];
  const SIDEBAR_ACTIVE_MAP = {
    'nueva-venta':  'ventas',
    'nuevo-gasto':  'gastos',
    'nuevo-pedido': 'pedidos',
    'inventario':   'inventario',
    'clientes':     'clientes',
    'mas':          null,
  };

  function init() {
    initBottomNav();
    initSidebar();
  }

  // ── Bottom nav (mobile) ───────────────────────────────────────────────────
  function initBottomNav() {
    const nav      = document.getElementById('bottom-nav');
    const fab      = document.getElementById('btn-fab');
    const sheet    = document.getElementById('action-sheet');
    const backdrop = document.getElementById('action-sheet-backdrop');
    const cancelBtn= document.getElementById('action-sheet-cancel');

    if (!nav) return;

    nav.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => App.navigate(btn.dataset.view));
    });

    if (fab) fab.addEventListener('click', () => toggleActionSheet(true));
    if (sheet) {
      sheet.querySelectorAll('.action-sheet-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          toggleActionSheet(false);
          App.navigate(btn.dataset.view);
        });
      });
    }
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

  // ── Sidebar (desktop) ─────────────────────────────────────────────────────
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Nav items
    sidebar.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => App.navigate(btn.dataset.view));
    });

    // FAB + dropdown
    const fabBtn  = document.getElementById('sidebar-fab');
    const fabMenu = document.getElementById('sidebar-fab-menu');

    if (fabBtn) {
      fabBtn.addEventListener('click', e => {
        e.stopPropagation();
        fabMenuOpen = !fabMenuOpen;
        fabMenu?.classList.toggle('hidden', !fabMenuOpen);
      });
    }

    if (fabMenu) {
      fabMenu.querySelectorAll('.sidebar-fab-menu-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          fabMenuOpen = false;
          fabMenu.classList.add('hidden');
          App.navigate(btn.dataset.view);
        });
      });
    }

    // Close fab menu on outside click
    document.addEventListener('click', () => {
      if (fabMenuOpen) {
        fabMenuOpen = false;
        fabMenu?.classList.add('hidden');
      }
    });

    // Logout
    document.getElementById('sidebar-logout')?.addEventListener('click', () => {
      if (confirm('¿Cerrar sesión?')) {
        API.clearToken();
        App.showLogin();
      }
    });
  }

  // ── setActive ─────────────────────────────────────────────────────────────
  function setActive(view) {
    currentView = view;

    // Bottom nav
    const nav = document.getElementById('bottom-nav');
    if (nav) {
      nav.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        const active = btn.dataset.view === view ||
          (view === 'nueva-venta'  && btn.dataset.view === 'ventas') ||
          (view === 'nuevo-gasto'  && btn.dataset.view === 'gastos') ||  // not in nav but just in case
          (view === 'nuevo-pedido' && btn.dataset.view === 'pedidos') ||
          (view === 'inventario'   && btn.dataset.view === 'mas') ||
          (view === 'clientes'     && btn.dataset.view === 'mas') ||
          (view === 'gastos'       && btn.dataset.view === 'mas') ||
          (view === 'mas'          && btn.dataset.view === 'mas');
        btn.classList.toggle('active', active);
      });
    }

    // Sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      const activeView = SIDEBAR_ACTIVE_MAP[view] !== undefined ? SIDEBAR_ACTIVE_MAP[view] : view;
      sidebar.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
        btn.classList.toggle('active', activeView && btn.dataset.view === activeView);
      });
    }

    toggleActionSheet(false);
  }

  function updateSidebarUser(user) {
    if (!user) return;
    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl   = document.getElementById('sidebar-user-name');
    const emailEl  = document.getElementById('sidebar-user-email');
    if (avatarEl) avatarEl.textContent = (user.nombre || user.email || 'U')[0].toUpperCase();
    if (nameEl)   nameEl.textContent   = user.nombre || 'Usuario';
    if (emailEl)  emailEl.textContent  = user.email  || '';
  }

  function getActive() { return currentView; }

  return { init, setActive, getActive, updateSidebarUser };
})();
