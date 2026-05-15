// API Client — fetch wrapper for Smart Guard backend.
// V React verzi posíláme při 401 globální event `smartguard:unauthorized`,
// AuthContext ho odchytí a uživatele odhlásí + přesměruje router.
const API_BASE = '/api';
const TOKEN_KEY = 'smartguard_token';

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Cesty, na kterých 401 NEZNAMENÁ "vyhoď uživatele" — login/register samy hlásí chybu.
const NO_AUTO_LOGOUT_PATHS = ['/user/login', '/user/register'];

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res, data;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (netErr) {
    throw { status: 0, code: 'networkError', message: 'Backend není dostupný.' };
  }
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && !NO_AUTO_LOGOUT_PATHS.includes(path)) {
      try { window.dispatchEvent(new CustomEvent('smartguard:unauthorized')); } catch {}
    }
    throw { status: res.status, ...data };
  }
  return data;
}

export const api = {
  // Buildings
  buildingList: () => request('GET', '/building/list'),
  buildingCreate: (data) => request('POST', '/building/create', data),
  buildingGetState: (id) => request('GET', `/building/getState?id=${id}`),
  buildingUpdate: (data) => request('PUT', '/building/update', data),
  buildingDelete: (id) => request('DELETE', '/building/delete', { id }),

  // Modules
  moduleList: (buildingId) => request('GET', `/module/list?buildingId=${buildingId || ''}`),
  moduleCreate: (data) => request('POST', '/module/create', data),
  moduleDelete: (moduleId) => request('DELETE', '/module/delete', { moduleId }),

  // Telemetry
  telemetryList: (moduleId) => request('GET', `/telemetry/list?moduleId=${moduleId || ''}`),

  // Alerts
  alertList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/alert/list${q ? '?' + q : ''}`);
  },
  alertResolve: (alertId) => request('POST', '/alert/resolve', { alertId }),

  // Users / auth
  userRegister: (data) => request('POST', '/user/register', data),
  userLogin: (data) => request('POST', '/user/login', data),
  userMe: () => request('GET', '/user/me'),
  userList: () => request('GET', '/user/list'),
  userUpdateRole: (userId, role) => request('PUT', `/user/${userId}/role`, { role }),
  userAssignBuildings: (userId, buildingIds) => request('POST', `/user/${userId}/buildings`, { buildingIds }),
  userDelete: (userId) => request('DELETE', `/user/${userId}`),

  // Veřejný list budov pro registrační formulář (bez auth)
  buildingPublicList: () => request('GET', '/building/public-list')
};

