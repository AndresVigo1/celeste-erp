/* Celeste ERP — Main app router & controller */
'use strict';

const App = (() => {
  let currentView = null;
  let isAuthChecked = false;
  let pendingNavOpts = null;

  // ── View registry ────────────────────────────────────────────────────────
  const VIEWS = {
    'dashboard':    { title: 'Inicio',              renderer: DashboardView.render },
    'ventas':       { title: 'Ventas',              renderer: VentasView.render },
    'nueva-venta':  { title: 'Nueva Venta',         renderer: NuevaVentaView.render },
    'gastos':       { title: 'Gastos',              renderer: GastosView.render },
    'nuevo-gasto':  { title: 'Nuevo Gasto',         renderer: (c, o) => GastosView.render(c, { ...o, showForm: true }) },
    'inventario':   { title: 'Inventario',          renderer: InventarioView.render },
    'clientes':     { title: 'Clientes',            renderer: ClientesView.render },
    'pedidos':      { title: 'Pedidos',             renderer: PedidosView.render },
    'nuevo-pedido': { title: 'Nuevo Pedido',        renderer: (c, o) => PedidosView.render(c, { ...o, showForm: true }) },
    'mas':          { title: 'Más opciones',        renderer: renderMasView }
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }

    // Set up login PIN UI
    setupPinLogin();

    // Check auth
    const hasToken = API.isLoggedIn();
    if (!hasToken) {
      showLogin();
      return;
    }

    // Verify token is still valid
    try {
      await API.auth.verify();
    } catch {
      API.clearToken();
      showLogin();
      return;
    }

    showApp();
  }

  // ── Auth / Login ──────────────────────────────────────────────────────────
  let selectedUser = null;

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
    goToSelectStep();
  }

  function goToSelectStep() {
    selectedUser = null;
    pinState.digits = [];
    document.getElementById('login-step-select').classList.remove('hidden');
    document.getElementById('login-step-auth').classList.add('hidden');
    loadUserCards();
  }

  async function loadUserCards() {
    const container = document.getElementById('user-cards');
    container.innerHTML = '<p style="color:rgba(255,255,255,.7);font-size:14px">Cargando...</p>';
    try {
      const users = await API.auth.users();
      container.innerHTML = users.map(u => `
        <button class="user-card" data-id="${u.id}" data-email="${u.email}" data-nombre="${u.nombre}">
          <div class="user-avatar">${u.nombre[0].toUpperCase()}</div>
          <span class="user-card-name">${u.nombre}</span>
        </button>
      `).join('');
      container.querySelectorAll('.user-card').forEach(btn => {
        btn.addEventListener('click', () => selectUser({
          id: parseInt(btn.dataset.id),
          email: btn.dataset.email,
          nombre: btn.dataset.nombre
        }));
      });
    } catch {
      container.innerHTML = '<p style="color:rgba(255,255,255,.7);font-size:13px">Error cargando usuarios</p>';
    }
  }

  async function selectUser(user) {
    selectedUser = user;
    pinState.digits = [];

    document.getElementById('selected-avatar').textContent = user.nombre[0].toUpperCase();
    document.getElementById('selected-name').textContent   = user.nombre;
    document.getElementById('pin-error').classList.add('hidden');

    document.getElementById('login-step-select').classList.add('hidden');
    document.getElementById('login-step-auth').classList.remove('hidden');

    renderPinDots();
    await checkPasskeyForUser(user.email);
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    document.getElementById('initial-loader').classList.add('hidden');

    // Init bottom nav
    BottomNav.init();

    // Back button
    document.getElementById('btn-back').addEventListener('click', () => {
      history.back();
    });

    // Refresh button
    document.getElementById('btn-refresh').addEventListener('click', () => {
      if (currentView) navigate(currentView, null, true);
    });

    // Hash-based routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1) || 'dashboard';
      const opts = pendingNavOpts;
      pendingNavOpts = null;
      navigateTo(hash, opts);
    });

    // Load initial view
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);
  }

  // ── Router ────────────────────────────────────────────────────────────────
  async function navigate(view, opts = null, force = false) {
    if (!view || view === currentView && !force && !opts) return;

    // Push to history
    const newHash = '#' + view;
    if (window.location.hash !== newHash) {
      pendingNavOpts = opts;   // preservar opts para el hashchange handler
      window.location.hash = newHash;
    } else {
      await navigateTo(view, opts);
    }
  }

  async function navigateTo(view, opts = null) {
    const viewDef = VIEWS[view];
    if (!viewDef) {
      console.warn('View not found:', view);
      navigate('dashboard');
      return;
    }

    currentView = view;

    // Update top bar
    const titleEl = document.getElementById('top-bar-title');
    if (titleEl) titleEl.textContent = viewDef.title;

    // Show/hide back button (hide on main tabs)
    const mainTabs = ['dashboard','ventas','pedidos','mas'];
    const backBtn  = document.getElementById('btn-back');
    if (backBtn) backBtn.style.display = mainTabs.includes(view) ? 'none' : 'flex';

    // Update bottom nav
    BottomNav.setActive(view);

    // Scroll to top
    const content = document.getElementById('app-content');
    if (content) content.scrollTop = 0;

    // Render view
    try {
      await viewDef.renderer(content, opts || {});
    } catch (err) {
      console.error('View render error:', err);
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠</div>
          <p class="empty-state-text">Error al cargar la vista</p>
          <p class="empty-state-sub">${err.message}</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('dashboard')">Ir al inicio</button>
        </div>`;
    }
  }

  // ── "Más" view ────────────────────────────────────────────────────────────
  async function renderMasView(container) {
    const currentUser = API.getCurrentUser();

    // Check passkey status for current user
    let passkeyRegistered = false;
    try {
      const s = await API.auth.passkey.status(currentUser?.email || '');
      passkeyRegistered = s.registered;
    } catch { /* ignore */ }

    const passkeySupported = !!window.PublicKeyCredential;

    container.innerHTML = `
      <div class="list-card mb-16">
        <div class="list-item" onclick="App.navigate('inventario')">
          <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary)">📦</div>
          <div class="list-item-body"><p class="list-item-title">Inventario</p><p class="list-item-sub">Productos y stock</p></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="list-item" onclick="App.navigate('clientes')">
          <div class="list-item-icon" style="background:var(--color-info-bg);color:var(--color-info)">👥</div>
          <div class="list-item-body"><p class="list-item-title">Clientes</p><p class="list-item-sub">Base de clientes y historial</p></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="list-item" onclick="App.navigate('gastos')">
          <div class="list-item-icon" style="background:var(--color-danger-bg);color:var(--color-danger)">💸</div>
          <div class="list-item-body"><p class="list-item-title">Gastos</p><p class="list-item-sub">Control de egresos</p></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      ${passkeySupported ? `
      <div class="list-card mb-16">
        <div class="list-item" id="btn-passkey-setting">
          <div class="list-item-icon" style="background:var(--color-primary-light);color:var(--color-primary)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          </div>
          <div class="list-item-body">
            <p class="list-item-title">Face ID / Touch ID</p>
            <p class="list-item-sub">${passkeyRegistered ? 'Configurado — toca para eliminar' : 'No configurado — toca para activar'}</p>
          </div>
          <span style="font-size:12px;padding:3px 8px;border-radius:99px;font-weight:600;background:${passkeyRegistered ? 'var(--color-success-bg)' : 'var(--color-warning-bg)'};color:${passkeyRegistered ? 'var(--color-success)' : 'var(--color-warning)'}">${passkeyRegistered ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>
      ` : ''}

      <div class="list-card mb-16">
        <div class="list-item" id="btn-logout">
          <div class="list-item-icon" style="background:var(--color-danger-bg);color:var(--color-danger)">🔓</div>
          <div class="list-item-body">
            <p class="list-item-title">Cerrar sesión</p>
            <p class="list-item-sub">${currentUser?.nombre || ''} · ${currentUser?.email || ''}</p>
          </div>
        </div>
      </div>

      <div class="card" style="text-align:center;padding:20px">
        <p style="font-size:22px;margin-bottom:4px">✦</p>
        <p style="font-size:15px;font-weight:700;color:var(--color-primary)">Celeste Taller Creativo</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:4px">ERP v1.0.0</p>
      </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('¿Cerrar sesión?')) {
        API.clearToken();
        showLogin();
      }
    });

    document.getElementById('btn-passkey-setting')?.addEventListener('click', async () => {
      if (passkeyRegistered) {
        if (confirm('¿Eliminar Face ID / Touch ID? Deberás usar tu PIN para entrar.')) {
          try {
            await API.auth.passkey.delete();
            Toast.show('Face ID eliminado', 'success');
            navigate('mas', null, true);
          } catch (err) {
            Toast.show(err.message || 'Error al eliminar', 'error');
          }
        }
      } else {
        const ok = await registerPasskey();
        if (ok) navigate('mas', null, true);
      }
    });
  }

  // ── PIN login ─────────────────────────────────────────────────────────────
  const pinState = { digits: [], maxLen: 6 };

  function setupPinLogin() {
    const numpad = document.getElementById('numpad');
    const delBtn = document.getElementById('pin-delete');
    const errorEl = document.getElementById('pin-error');
    if (!numpad) return;

    numpad.querySelectorAll('.numpad-btn[data-digit]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!selectedUser) return;
        if (pinState.digits.length >= pinState.maxLen) return;
        pinState.digits.push(btn.dataset.digit);
        renderPinDots();
        if (pinState.digits.length === pinState.maxLen) submitPin();
      });
    });

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        pinState.digits.pop();
        renderPinDots();
        if (errorEl) errorEl.classList.add('hidden');
      });
    }

    document.addEventListener('keydown', e => {
      const loginScreen = document.getElementById('login-screen');
      if (!loginScreen || loginScreen.classList.contains('hidden')) return;
      if (!selectedUser) return;
      if (e.key >= '0' && e.key <= '9' && pinState.digits.length < pinState.maxLen) {
        pinState.digits.push(e.key);
        renderPinDots();
        if (pinState.digits.length === pinState.maxLen) submitPin();
      } else if (e.key === 'Backspace') {
        pinState.digits.pop();
        renderPinDots();
      }
    });

    document.getElementById('btn-change-user')?.addEventListener('click', goToSelectStep);
  }

  // ── Passkey ────────────────────────────────────────────────────────────────

  async function checkPasskeyForUser(email) {
    const btn     = document.getElementById('btn-passkey');
    const divider = document.getElementById('pin-divider');
    btn.classList.add('hidden');
    if (divider) divider.classList.add('hidden');
    if (!window.PublicKeyCredential) return;
    try {
      const { registered } = await API.auth.passkey.status(email);
      if (!registered) return;
      btn.classList.remove('hidden');
      btn.onclick = loginWithPasskey;
      if (divider) divider.classList.remove('hidden');
    } catch { /* ignore */ }
  }

  async function loginWithPasskey() {
    const btn   = document.getElementById('btn-passkey');
    const errEl = document.getElementById('pin-error');
    if (!selectedUser) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }
    try {
      const options  = await API.auth.passkey.loginOptions(selectedUser.email);
      const { _challengeKey, ...optionsJSON } = options;
      const response = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
      const { token } = await API.auth.passkey.loginVerify({ ...response, _challengeKey });
      API.setToken(token);
      pinState.digits = [];
      renderPinDots();
      showApp();
    } catch (err) {
      if (errEl) {
        errEl.textContent = 'Face ID falló. Usa tu PIN.';
        errEl.classList.remove('hidden');
        setTimeout(() => errEl.classList.add('hidden'), 2500);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg> Face ID / Touch ID`;
      }
    }
  }

  async function registerPasskey() {
    try {
      const options  = await API.auth.passkey.registerOptions();
      const response = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });
      await API.auth.passkey.registerVerify(response);
      Toast.show('Face ID configurado correctamente', 'success');
      return true;
    } catch (err) {
      Toast.show(err.message || 'Error al configurar Face ID', 'error');
      return false;
    }
  }

  function renderPinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < pinState.digits.length);
      dot.classList.remove('error');
    });
  }

  async function submitPin() {
    if (!selectedUser) return;
    const pin = pinState.digits.join('');
    try {
      const res = await API.auth.login(selectedUser.email, pin);
      API.setToken(res.token);
      pinState.digits = [];
      renderPinDots();
      showApp();
    } catch (err) {
      const dots  = document.querySelectorAll('.pin-dot');
      const errEl = document.getElementById('pin-error');
      dots.forEach(d => d.classList.add('error'));
      if (errEl) errEl.classList.remove('hidden');
      setTimeout(() => {
        pinState.digits = [];
        renderPinDots();
        if (errEl) errEl.classList.add('hidden');
      }, 1000);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, navigate, showLogin, showApp };
})();

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
