// Alert Dashboard
//
// Per dokumentace > Components (FE) > AlertDashboard:
//   - FIRE alerty pulzují červeně
//   - Empty state "Systém bez závad" se zobrazí, pokud nejsou žádné aktivní alerty
//   - "Vyřešit" tlačítko vidí RESCUER / ADMIN / SYSTEM (canResolveAlerts())
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

function typeIcon(t) {
  const map = { SOS: '🚨', FIRE: '🔥', EARTHQUAKE: '🌍', TAMPER: '📳', DEVICE_OFFLINE: '📡' };
  return map[t] || '⚠';
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Alerts() {
  const { canResolveAlerts } = useAuth();
  const showToast = useToast();

  const [alerts, setAlerts] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [filterType, setFilterType] = useState('');

  async function load() {
    try {
      const [a, b] = await Promise.all([api.alertList(), api.buildingList()]);
      setAlerts(a.itemList || []);
      setBuildings(b.itemList || []);
      setLoading(false);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const buildingMap = useMemo(() => {
    const m = {};
    buildings.forEach((b) => { m[b._id] = b.name; });
    return m;
  }, [buildings]);

  const filtered = useMemo(() => {
    return alerts.filter((a) =>
      (!filterBuilding || a.building === filterBuilding) &&
      (!filterStatus || a.status === filterStatus) &&
      (!filterType || a.type === filterType)
    );
  }, [alerts, filterBuilding, filterStatus, filterType]);

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const isActiveOnlyFilter = filterStatus === 'ACTIVE' && !filterBuilding && !filterType;

  async function resolve(id) {
    try {
      await api.alertResolve(id);
      showToast('Alert vyřešen', 'success');
      load();
    } catch (e) {
      showToast(e.message || 'Chyba', 'error');
    }
  }

  if (loading) {
    return <div className="loading-page"><div className="spinner" /><span>Načítání alertů…</span></div>;
  }
  if (error) {
    return <div className="empty-state"><h3>Nepodařilo se načíst alerty</h3><p>{error.message}</p></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Dashboard</h1>
          <p className="page-subtitle">{activeCount} aktivních alertů</p>
        </div>
      </div>

      <div className="alert-filters">
        <select className="form-select" value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
          <option value="">Všechny budovy</option>
          {buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Všechny stavy</option>
          <option value="ACTIVE">Aktivní</option>
          <option value="RESOLVED">Vyřešené</option>
        </select>
        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Všechny typy</option>
          <option value="SOS">SOS</option>
          <option value="FIRE">Požár</option>
          <option value="EARTHQUAKE">Zemětřesení</option>
          <option value="TAMPER">Manipulace</option>
          <option value="DEVICE_OFFLINE">Offline</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--status-ok)" strokeWidth="1.5" style={{ width: 64, height: 64, opacity: .5 }}>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <h3>{isActiveOnlyFilter ? 'Systém bez závad' : 'Žádné alerty odpovídající filtru'}</h3>
          <p>{isActiveOnlyFilter ? 'Všechna patra a moduly jsou v pořádku.' : 'Zkuste jiný filtr.'}</p>
        </div>
      ) : (
        <div className="alert-list">
          {filtered.map((a) => {
            const fireClass = a.type === 'FIRE' && a.status === 'ACTIVE' ? 'alert-fire-pulse' : '';
            const sosClass = a.type === 'SOS' && a.status === 'ACTIVE' ? 'alert-sos' : '';
            return (
              <div key={a._id} className={`alert-item ${fireClass} ${sosClass}`} data-severity={a.severity}>
                <div className="alert-info">
                  <div className="alert-type">
                    <span className={`badge severity-${a.severity}`}>{a.severity}</span>
                    <span>{typeIcon(a.type)} {a.type}</span>
                    <span className={`badge ${a.status === 'ACTIVE' ? 'badge-danger' : 'badge-ok'}`} style={{ marginLeft: 8 }}>{a.status}</span>
                  </div>
                  <div className="alert-message">{a.message}</div>
                  <div className="alert-meta">
                    <span>🏢 {buildingMap[a.building] || a.building}</span>
                    <span>📡 Patro {a.floor}</span>
                    <span>🔌 {a.moduleId}</span>
                    <span>🕐 {formatDate(a.createdAt)}</span>
                    {a.resolvedAt && <span>✅ Vyřešeno: {formatDate(a.resolvedAt)}</span>}
                  </div>
                </div>
                {a.status === 'ACTIVE' && canResolveAlerts && (
                  <button className="btn btn-sm btn-primary" onClick={() => resolve(a._id)}>Vyřešit</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
