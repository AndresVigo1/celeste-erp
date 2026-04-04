/* Celeste ERP — API wrapper */
'use strict';

const API = (() => {
  const TOKEN_KEY = 'celeste_token';

  function getBaseURL() {
    return window.location.origin;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function request(method, path, body = null) {
    const url = getBaseURL() + '/api' + path;
    const token = getToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const opts = { method, headers };
    if (body !== null) opts.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(url, opts);
    } catch (networkErr) {
      throw new Error('Sin conexión. Verifica tu red.');
    }

    // Token expired or invalid
    if (response.status === 401) {
      clearToken();
      if (typeof App !== 'undefined' && App.showLogin) {
        App.showLogin();
      } else {
        window.location.reload();
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const msg = (data && data.error) ? data.error : `Error ${response.status}`;
      throw new Error(msg);
    }

    return data;
  }

  function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
  }

  return {
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    getCurrentUser,

    get:    (path)         => request('GET',    path),
    post:   (path, body)   => request('POST',   path, body),
    patch:  (path, body)   => request('PATCH',  path, body),
    delete: (path)         => request('DELETE', path),

    auth: {
      login:  (email, pin)  => request('POST', '/auth/login', { email, pin }),
      verify: ()            => request('GET',  '/auth/verify'),
      passkey: {
        status:         (email) => request('GET',    '/auth/passkey/status?email=' + encodeURIComponent(email)),
        registerOptions:()      => request('GET',    '/auth/passkey/register-options'),
        registerVerify: (body)  => request('POST',   '/auth/passkey/register-verify', body),
        loginOptions:   (email) => request('GET',    '/auth/passkey/login-options?email=' + encodeURIComponent(email)),
        loginVerify:    (body)  => request('POST',   '/auth/passkey/login-verify', body),
        delete:         ()      => request('DELETE', '/auth/passkey'),
      }
    },

    dashboard: {
      get: () => request('GET', '/dashboard')
    },

    ventas: {
      list:   (params = {}) => request('GET', '/ventas' + buildQuery(params)),
      get:    (id)          => request('GET', '/ventas/' + id),
      create: (body)        => request('POST', '/ventas', body),
      update: (id, body)    => request('PATCH', '/ventas/' + id, body),
      cancel: (id)          => request('DELETE', '/ventas/' + id)
    },

    gastos: {
      list:   (params = {}) => request('GET', '/gastos' + buildQuery(params)),
      get:    (id)          => request('GET', '/gastos/' + id),
      create: (body)        => request('POST', '/gastos', body),
      update: (id, body)    => request('PATCH', '/gastos/' + id, body),
      delete: (id)          => request('DELETE', '/gastos/' + id)
    },

    productos: {
      list:   ()         => request('GET', '/productos'),
      get:    (id)       => request('GET', '/productos/' + id),
      create: (body)     => request('POST', '/productos', body),
      update: (id, body) => request('PATCH', '/productos/' + id, body),
      delete: (id)       => request('DELETE', '/productos/' + id)
    },

    clientes: {
      list:   (params = {}) => request('GET', '/clientes' + buildQuery(params)),
      get:    (id)          => request('GET', '/clientes/' + id),
      create: (body)        => request('POST', '/clientes', body),
      update: (id, body)    => request('PATCH', '/clientes/' + id, body)
    },

    pedidos: {
      list:      (params = {}) => request('GET', '/pedidos' + buildQuery(params)),
      get:       (id)          => request('GET', '/pedidos/' + id),
      create:    (body)        => request('POST', '/pedidos', body),
      update:    (id, body)    => request('PATCH', '/pedidos/' + id, body),
      convertir: (id, body)    => request('POST', '/pedidos/' + id + '/convertir', body)
    }
  };

  function buildQuery(params) {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    return q ? '?' + q : '';
  }
})();
