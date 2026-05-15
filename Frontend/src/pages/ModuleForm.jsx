// Registrace IoT modulu.
//
// Modul je MULTIFUNKČNÍ zařízení s integrovaným:
//   - teplotním senzorem
//   - akcelerometrem (detekce otřesů)
//   - SOS tlačítkem
// Typicky se umisťuje jeden modul na patro.
//
// Vazba: Building → Gateway → Module
//   - Budova obsahuje jednu nebo více gateway (registrují se v BuildingForm).
//   - Gateway přijímá data ze svých modulů přes jejich moduleId.
//   - Modul se při registraci páruje s konkrétní gateway (gatewayId).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function ModuleForm() {
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [building, setBuilding] = useState(null);
  const [gateways, setGateways] = useState([]);
  const [moduleId, setModuleId] = useState('');
  const [gatewayChoice, setGatewayChoice] = useState('');
  const [customGateway, setCustomGateway] = useState('');
  const [floor, setFloor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const state = await api.buildingGetState(buildingId);
        if (cancelled) return;
        setBuilding(state.building);

        // Sloučíme gatewayIds z budovy a z existujících modulů
        const fromBuilding = state.building.gateways || [];
        const fromModules = [...new Set((await api.moduleList(buildingId)).itemList.map((m) => m.gatewayId))];
        const merged = [...new Set([...fromBuilding, ...fromModules])];
        setGateways(merged);
        if (merged.length > 0) setGatewayChoice(merged[0]);
        else setGatewayChoice('__new__');
      } catch (e) {
        setError(e.message || 'Nepodařilo se načíst budovu');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [buildingId]);

  const finalGatewayId = gatewayChoice === '__new__' ? customGateway.trim() : gatewayChoice;
  const canSubmit = useMemo(() => {
    const f = parseInt(floor);
    return !!moduleId.trim() && !!finalGatewayId && f > 0 && (building ? f <= building.floors : true);
  }, [moduleId, finalGatewayId, floor, building]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      await api.moduleCreate({
        moduleId: moduleId.trim(),
        gatewayId: finalGatewayId,
        buildingId,
        floor: parseInt(floor)
      });
      // Pokud admin napsal novou gateway, aktualizujeme budovu na backendu
      if (gatewayChoice === '__new__') {
        const newGateways = [...new Set([...gateways, finalGatewayId])];
        await api.buildingUpdate({ id: buildingId, gateways: newGateways });
      }
      showToast('Modul zaregistrován', 'success');
      navigate(`/building/${buildingId}`);
    } catch (err) {
      setError(err.message || 'Chyba při registraci modulu');
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <h1>Registrace IoT modulu</h1>
          <p>{building ? <>Budova: <strong>{building.name}</strong></> : 'Načítání…'}</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Module ID (sériové číslo)</label>
            <input className="form-input" type="text" placeholder="např. SN-MODULE-2026-001"
              value={moduleId} onChange={(e) => setModuleId(e.target.value)} required />
            <small style={{ color: 'var(--text-tertiary)', fontSize: '.78rem' }}>
              Unikátní HW identifikátor modulu. Modul má integrovaný teplotní senzor, akcelerometr a SOS tlačítko.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Gateway</label>
            <select className="form-input" value={gatewayChoice} onChange={(e) => setGatewayChoice(e.target.value)}>
              {gateways.map((g) => <option key={g} value={g}>📡 {g}</option>)}
              <option value="__new__">+ Nová gateway…</option>
            </select>
            <small style={{ color: 'var(--text-tertiary)', fontSize: '.78rem' }}>
              Gateway propojuje moduly s naším systémem. Vyberte existující bránu nebo přidejte novou.
            </small>
          </div>

          {gatewayChoice === '__new__' && (
            <div className="form-group">
              <label className="form-label">Nové Gateway ID</label>
              <input className="form-input" type="text" placeholder="ID gateway brány"
                value={customGateway} onChange={(e) => setCustomGateway(e.target.value)} required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Patro</label>
            <input className="form-input" type="number" placeholder="Číslo patra"
              min="1" max={building?.floors || 200}
              value={floor} onChange={(e) => setFloor(e.target.value)} required />
            <small style={{ color: 'var(--text-tertiary)', fontSize: '.78rem' }}>
              Typicky jeden modul na patro (1–{building?.floors || '?'}).
            </small>
          </div>

          {error && (
            <div style={{ color: 'var(--accent-danger)', fontSize: '.85rem', padding: '8px 12px', background: 'var(--status-danger-bg)', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => navigate(buildingId ? `/building/${buildingId}` : '/admin')}>Zrušit</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={!canSubmit || busy}>
              {busy ? 'Registruji…' : 'Registrovat modul'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
