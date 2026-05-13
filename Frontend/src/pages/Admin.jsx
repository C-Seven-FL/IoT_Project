// Admin Route — Database Configuration (per docs > Application Model > Routes (FE))
// Přehled budov + gateway + modulů, akce pro správu databázových entit.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function AdminPanel() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [buildings, setBuildings] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [b, m] = await Promise.all([api.buildingList(), api.moduleList()]);
      setBuildings(b.itemList || []);
      setModules(m.itemList || []);
      setLoading(false);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const modulesByBuilding = useMemo(() => {
    const m = {};
    modules.forEach((mod) => {
      if (!m[mod.building]) m[mod.building] = [];
      m[mod.building].push(mod);
    });
    return m;
  }, [modules]);

  async function handleDelete(b) {
    if (!confirm(`Opravdu smazat budovu „${b.name}"? Smažou se i všechny moduly a alerty.`)) return;
    try {
      await api.buildingDelete(b._id);
      showToast('Budova smazána', 'success');
      load();
    } catch (e) {
      showToast(e.message || 'Chyba', 'error');
    }
  }

  if (loading) {
    return <div className="loading-page"><div className="spinner" /><span>Načítání admin panelu…</span></div>;
  }
  if (error) {
    return <div className="empty-state"><h3>Nepodařilo se načíst data</h3><p>{error.message}</p></div>;
  }

  // Sjednotíme gateway IDs (z dat budov + z modulů)
  const allGatewayCount = new Set(
    modules.map((m) => m.gatewayId).filter(Boolean)
      .concat(buildings.flatMap((b) => b.gateways || []))
  ).size;

  const offline = modules.filter((m) => m.status === 'OFFLINE').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Konfigurace databázových entit (budovy, gateway, moduly)</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/building-new')}>+ Nový dům</button>
      </div>

      <div className="dashboard-stats" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value">{buildings.length}</div><div className="stat-label">Budovy</div></div>
        <div className="stat-card"><div className="stat-value">{allGatewayCount}</div><div className="stat-label">Gateway</div></div>
        <div className="stat-card"><div className="stat-value">{modules.length}</div><div className="stat-label">Moduly</div></div>
        <div className={`stat-card ${offline > 0 ? 'warning' : 'ok'}`}>
          <div className="stat-value">{modules.length - offline} / {modules.length}</div>
          <div className="stat-label">Online moduly</div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 14 }}>Seznam budov</h2>

      {buildings.length === 0 ? (
        <div className="empty-state">
          <h3>Žádné budovy</h3>
          <p>Klikněte na „Nový dům" pro vytvoření první budovy.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Název</th>
                <th>Adresa</th>
                <th>Pater</th>
                <th>Gateway</th>
                <th>Moduly</th>
                <th>Stav</th>
                <th style={{ textAlign: 'right' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => {
                const mods = modulesByBuilding[b._id] || [];
                const fromBuilding = b.gateways || [];
                const fromModules = [...new Set(mods.map((m) => m.gatewayId))];
                const gws = [...new Set([...fromBuilding, ...fromModules])];
                return (
                  <tr key={b._id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.address || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                    <td>{b.floors}</td>
                    <td>
                      {gws.length === 0
                        ? <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        : gws.map((g) => <span key={g} className="badge badge-info" style={{ marginRight: 4 }}>📡 {g}</span>)
                      }
                    </td>
                    <td>{mods.length}</td>
                    <td><span className={`badge badge-${b.status === 'OK' ? 'ok' : b.status === 'WARNING' ? 'warning' : 'danger'}`}>{b.status}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/building/${b._id}`)}>Detail</button>{' '}
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/building-edit/${b._id}`)}>Upravit</button>{' '}
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/module-new/${b._id}`)}>+ Modul</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
