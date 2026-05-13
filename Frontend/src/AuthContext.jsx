// AuthContext — globální stav uživatele + login/register/logout přes React hook.
//
// 4 role v systému:
//   - USER    = civilní obyvatel (vidí svoji budovu)
//   - RESCUER = záchranář (vidí všechny budovy, řeší alerty)
//   - ADMIN   = administrátor (vytváří budovy/moduly, řeší alerty)
//   - SYSTEM  = automatizovaný účet (interní)
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from './api.js';

const AUTH_KEY = 'smartguard_auth';
const VALID_ROLES = ['ADMIN', 'USER', 'RESCUER', 'SYSTEM'];

export const PUBLIC_REGISTRATION_ROLES = ['USER', 'RESCUER'];
export const ROLE_LABELS = {
  USER: 'Civilní obyvatel',
  RESCUER: 'Záchranář',
  ADMIN: 'Administrátor',
  SYSTEM: 'Systém'
};

function shape(user) {
  return {
    id: user._id || user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    assignedBuildings: user.assignedBuildings || [],
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  };
}

function readStoredUser() {
  try {
    const u = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!u) return null;
    // Stará session s neplatnou rolí → vyčistit (z předchozích schémat: PUBLIC, AUTHORITY, MANAGER, ...)
    if (!VALID_ROLES.includes(u.role)) {
      localStorage.removeItem(AUTH_KEY);
      setAuthToken(null);
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const isLoggedIn = !!user && !!getAuthToken();

  const saveUser = useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    else localStorage.removeItem(AUTH_KEY);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.userLogin({ email, password });
    if (!res.token) throw { code: 'noToken', message: 'Backend nevrátil token.' };
    setAuthToken(res.token);
    const u = shape(res);
    saveUser(u);
    return u;
  }, [saveUser]);

  const register = useCallback(async ({ firstName, lastName, email, password, role, building }) => {
    if (!PUBLIC_REGISTRATION_ROLES.includes(role)) {
      throw { code: 'invalidRole', message: 'Pro veřejnou registraci je povolena pouze role USER nebo RESCUER.' };
    }
    const payload = { firstName, lastName, email, password, role };
    if (role === 'USER') payload.building = building;
    const res = await api.userRegister(payload);
    if (!res.token) throw { code: 'noToken', message: 'Backend nevrátil token.' };
    setAuthToken(res.token);
    const u = shape(res);
    saveUser(u);
    return u;
  }, [saveUser]);

  const logout = useCallback(() => {
    setAuthToken(null);
    saveUser(null);
  }, [saveUser]);

  // Pokud nás backend odřízne (401), api.js volá window dispatch event — odhlásíme se.
  useEffect(() => {
    const handler = () => { setAuthToken(null); saveUser(null); };
    window.addEventListener('smartguard:unauthorized', handler);
    return () => window.removeEventListener('smartguard:unauthorized', handler);
  }, [saveUser]);

  const ctx = {
    user,
    isLoggedIn,
    role: user?.role || null,
    isAdmin: user?.role === 'ADMIN',
    canMonitor: !!user && ['ADMIN', 'USER', 'RESCUER', 'SYSTEM'].includes(user.role),
    canResolveAlerts: !!user && ['ADMIN', 'RESCUER', 'SYSTEM'].includes(user.role),
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
