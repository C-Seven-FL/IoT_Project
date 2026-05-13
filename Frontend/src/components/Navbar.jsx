import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../AuthContext.jsx';
import { api } from '../api.js';

export default function Navbar() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [alertCount, setAlertCount] = useState(0);

  // Skrýt navbar na auth obrazovkách (uživatel ho stejně nemá k čemu použít)
  const onAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // Polling počtu aktivních alertů — jen když je přihlášený
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.alertList({ status: 'ACTIVE' });
        if (!cancelled) setAlertCount(data.total || 0);
      } catch { /* silent */ }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isLoggedIn]);

  if (!isLoggedIn || onAuthPage) return null;

  return (
    <nav>
      <div className="navbar">
        <NavLink to="/dashboard" className="navbar-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Smart Guard
        </NavLink>

        <nav className="navbar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Dashboard</NavLink>
          <NavLink to="/alerts" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Alerty</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Admin</NavLink>
          )}
        </nav>

        <div className="navbar-right">
          <div className="alert-indicator" title="Aktivní alerty" onClick={() => navigate('/alerts')} style={{ cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {alertCount > 0 && <span className="alert-count">{alertCount}</span>}
          </div>

          <div className="user-badge" title={ROLE_LABELS[user.role] || ''}>
            <span>{user.fullName || user.email}</span>
            <span className="role">{user.role}</span>
          </div>

          <button className="btn-ghost btn-sm" title="Odhlásit se" onClick={() => { logout(); navigate('/login'); }}>↗</button>
        </div>
      </div>
    </nav>
  );
}
