// Dashboard — přehled budov.
// USER vidí jen svoji budovu (backend filtruje podle assignedBuildings).
// RESCUER / ADMIN / SYSTEM vidí všechny.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.buildingList();
        if (!cancelled) {
          setBuildings(data.itemList || []);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setLoading(false);
        }
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <span>Načítání…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-state">
        <h3>Nepodařilo se načíst data</h3>
        <p>{error.message || 'Backend není dostupný'}</p>
      </div>
    );
  }

  const okCount = buildings.filter((b) => b.status === 'OK').length;
  const warningCount = buildings.filter((b) => b.status === 'WARNING').length;
  const dangerCount = buildings.filter((b) => b.status === 'DANGER').length;
  const totalModules = buildings.reduce((s, b) => s + (b.moduleCount || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard — Monitoring budov</h1>
          <p className="page-subtitle">Přehled stavu všech monitorovaných domů v reálném čase</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => navigate('/building-new')}>+ Přidat dům</button>
        )}
      </div>

      <div className="dashboard-stats">
        <div className="stat-card ok"><div className="stat-value">{okCount}</div><div className="stat-label">V pořádku</div></div>
        <div className="stat-card warning"><div className="stat-value">{warningCount}</div><div className="stat-label">Varování</div></div>
        <div className="stat-card danger"><div className="stat-value">{dangerCount}</div><div className="stat-label">Nebezpečí</div></div>
        <div className="stat-card"><div className="stat-value">{totalModules}</div><div className="stat-label">Modulů celkem</div></div>
      </div>

      {user?.role === 'USER' && user?.approvalStatus === 'PENDING' ? (
        <div className="empty-state">
          <h3>Žádost čeká na schválení</h3>
          <p>Vaše registrace byla úspěšná, ale přístup k vybrané budově musí ještě potvrdit administrátor.</p>
          <p>Po schválení se vám zde automaticky zobrazí monitoring vaší budovy.</p>
        </div>
      ) : user?.role === 'USER' && user?.approvalStatus === 'REJECTED' ? (
        <div className="empty-state">
          <h3>Žádost byla zamítnuta</h3>
          <p>Administrátor zamítl váš přístup k vybrané budově.</p>
          <p>Pokud se jedná o chybu, kontaktujte správce systému.</p>
        </div>
      ) : buildings.length === 0 ? (
        <div className="empty-state">
          <h3>Žádné budovy v systému</h3>
          <p>Kontaktujte administrátora pro přiřazení budovy.</p>
        </div>
      ) : (
        <div className="building-grid">
          {buildings.map((b) => (
            <div key={b._id} className="card building-card"
              data-status={b.status}
              onClick={() => navigate(`/building/${b._id}`)}>
              <div className="card-header">
                <span className="building-name">{b.name}</span>
                <span className={`badge badge-${b.status === 'OK' ? 'ok' : b.status === 'WARNING' ? 'warning' : 'danger'}`}>{b.status}</span>
              </div>
              <div className="card-body">
                {b.address && <div className="building-address">📍 {b.address}</div>}
                <div className="building-meta">
                  <span>🏢 {b.floors} pater</span>
                  <span>📡 {b.moduleCount || 0} modulů</span>
                  {b.activeAlertCount > 0 && (
                    <span style={{ color: 'var(--accent-danger)' }}>⚠ {b.activeAlertCount} alertů</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
