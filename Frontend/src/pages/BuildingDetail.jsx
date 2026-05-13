// Detail jedné budovy — status banner, krizové indikátory, mřížka pater.
// Každé patro zobrazuje data ze (typicky jednoho) IoT modulu:
//   - Stav SOS tlačítka (a kdy bylo naposled stisknuto)
//   - Teplota
//   - Stav akcelerometru (otřesy)
//   - Online / Offline indikátor
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Právě teď';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hod`;
  return `${Math.floor(hours / 24)} d`;
}

const STATUS_BANNER_TEXT = {
  OK: '✓ Systém bez závad',
  WARNING: '⚠ Varování — zvýšené hodnoty',
  DANGER: '🛑 NEBEZPEČÍ — aktivní alerty'
};

export default function BuildingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, canResolveAlerts } = useAuth();
  const showToast = useToast();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.buildingGetState(id);
      setState(data);
      setLoading(false);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function handleResolve(alertId) {
    try {
      await api.alertResolve(alertId);
      showToast('Alert vyřešen', 'success');
      load();
    } catch (e) {
      showToast(e.message || 'Chyba', 'error');
    }
  }

  async function handleDelete() {
    if (!confirm(`Opravdu smazat budovu „${state.building.name}"?`)) return;
    try {
      await api.buildingDelete(id);
      showToast('Budova smazána', 'success');
      navigate('/dashboard');
    } catch (e) {
      showToast(e.message || 'Chyba', 'error');
    }
  }

  if (loading) {
    return <div className="loading-page"><div className="spinner" /><span>Načítání budovy…</span></div>;
  }
  if (error || !state) {
    return (
      <div className="empty-state">
        <h3>Budova nenalezena</h3>
        <p>{error?.message || ''}</p>
      </div>
    );
  }

  const { building, floors, activeAlerts } = state;
  const hasFire = activeAlerts.some((a) => a.type === 'FIRE');
  const hasEarthquake = activeAlerts.some((a) => a.type === 'EARTHQUAKE' || a.type === 'TAMPER');
  const hasSOS = activeAlerts.some((a) => a.type === 'SOS');

  return (
    <>
      <div className="building-header">
        <div className="building-header-info">
          <p style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Vybraný dům</p>
          <h1>{building.name}</h1>
          <p>{building.address ? '📍 ' + building.address + ' · ' : ''}{building.floors} pater</p>
        </div>
        <div className="building-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>← Zpět</button>
          {isAdmin && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/building-edit/${id}`)}>✏ Upravit</button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/module-new/${id}`)}>+ Modul</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 Smazat</button>
            </>
          )}
        </div>
      </div>

      <div className={`status-banner status-banner-${building.status.toLowerCase()}`}>
        <span className="status-banner-label">Celkový stav budovy</span>
        <span className="status-banner-value">{STATUS_BANNER_TEXT[building.status] || building.status}</span>
      </div>

      <div className="crisis-indicators">
        <div className={`crisis-badge ${hasFire ? 'active' : 'inactive'}`}>🔥 Požár</div>
        <div className={`crisis-badge ${hasEarthquake ? 'active' : 'inactive'}`}>🌍 Zemětřesení</div>
        <div className={`crisis-badge ${hasSOS ? 'active sos-active' : 'inactive'}`}>🚨 SOS</div>
      </div>

      <div className="floors-grid">
        {floors.map((f) => {
          // Modul je multifunkční (teplota + akcelerometr + SOS tlačítko v jednom zařízení).
          // Typicky je 1 modul na patro, ale může jich být i víc.
          const mod = f.modules[0];
          const temp = mod?.lastTemperature;
          const sosAlert = f.activeAlerts.find((a) => a.type === 'SOS');
          const accelAlert = f.activeAlerts.find((a) => a.type === 'TAMPER' || a.type === 'EARTHQUAKE');
          const isOnline = f.modules.some((m) => m.status !== 'OFFLINE');
          const tempClass = temp >= 60 ? 'danger' : temp >= 45 ? 'warning' : '';

          return (
            <div key={f.floor} className="floor-card" data-status={f.status} data-floor={f.floor}>
              <div className="floor-number">
                <span>Číslo patra {f.floor}</span>
                <span className={`badge badge-${f.status === 'OK' ? 'ok' : f.status === 'WARNING' ? 'warning' : 'danger'}`}>{f.status}</span>
              </div>
              <div className="floor-data">
                <div className="floor-data-row">
                  <span className="label">🚨 Stav SOS</span>
                  <span className={`value ${sosAlert ? 'danger' : ''}`}>{sosAlert ? 'AKTIVNÍ' : 'OK'}</span>
                </div>
                <div className="floor-data-row">
                  <span className="label">⏱ Čas od posledního stisknutí SOS</span>
                  <span className="value">{sosAlert ? timeAgo(sosAlert.createdAt) : '—'}</span>
                </div>
                <div className="floor-data-row">
                  <span className="label">🌡 Teplota v patře</span>
                  <span className={`value ${tempClass}`}>{temp != null ? temp.toFixed(1) + ' °C' : '—'}</span>
                </div>
                <div className="floor-data-row">
                  <span className="label">📳 Stav Akcelerometru</span>
                  <span className={`value ${accelAlert ? 'danger' : ''}`}>{accelAlert ? 'OTŘESY' : 'Stabilní'}</span>
                </div>
                <div className="floor-data-row">
                  <span className="label">⏱ Čas od posl. nárazové události</span>
                  <span className="value">{accelAlert ? timeAgo(accelAlert.createdAt) : '—'}</span>
                </div>
              </div>
              <div className="floor-online">
                <span className={`dot ${isOnline ? 'online' : 'offline'}`} />
                <span style={{ color: `var(${isOnline ? '--status-ok' : '--status-offline'})` }}>{isOnline ? 'Online' : 'Offline'}</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {f.modules.length} modul{f.modules.length !== 1 ? 'ů' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {activeAlerts.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Aktivní alerty ({activeAlerts.length})</h2>
          <div className="alert-list">
            {activeAlerts.map((a) => (
              <div key={a._id} className="alert-item" data-severity={a.severity}>
                <div className="alert-info">
                  <div className="alert-type">
                    <span className={`badge severity-${a.severity}`}>{a.severity}</span>
                    {a.type}
                  </div>
                  <div className="alert-message">{a.message}</div>
                  <div className="alert-meta">
                    <span>Patro {a.floor}</span>
                    <span>Modul: {a.moduleId}</span>
                    <span>{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
                {canResolveAlerts && (
                  <button className="btn btn-sm btn-secondary" onClick={() => handleResolve(a._id)}>Vyřešit</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
