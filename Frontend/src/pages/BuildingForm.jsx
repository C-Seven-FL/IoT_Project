// Formulář pro vytvoření / úpravu budovy (Admin Panel)
// Pole:
//   - Název nového domu (povinné)
//   - Adresa
//   - Počet pater (povinné)
//   - Přidat Gateway — seznam ID gateway zařízení připojených k budově
//     (gateway propojuje moduly s naším systémem)
//
// POZN: backend nemá `gateways` pole na Building modelu, gateway IDs proto
// ukládáme do localStorage (per building) a používáme jako zdroj pro
// ModuleForm při vytváření modulu (gateway dropdown).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function BuildingForm() {
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floors, setFloors] = useState('');
  const [gateways, setGateways] = useState([]);
  const [newGateway, setNewGateway] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Načíst data při editaci
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    async function load() {
      try {
        const state = await api.buildingGetState(editId);
        if (cancelled) return;
        setName(state.building.name);
        setAddress(state.building.address || '');
        setFloors(String(state.building.floors));

        // Načíst gateway IDs — přímo z backendu (stav budovy) a existujících modulů
        const stored = state.building.gateways || [];
        const moduleRes = await api.moduleList(editId);
        const fromModules = [...new Set((moduleRes.itemList || []).map((m) => m.gatewayId))];
        const merged = [...new Set([...stored, ...fromModules])];
        setGateways(merged);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError('Budova nenalezena');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isEdit, editId]);

  const canSubmit = useMemo(() => {
    const n = name.trim();
    const f = parseInt(floors);
    return !!n && f > 0;
  }, [name, floors]);

  function addGateway() {
    const v = newGateway.trim();
    if (!v) return;
    if (gateways.includes(v)) {
      showToast('Gateway s tímto ID už je v seznamu', 'error');
      return;
    }
    setGateways((g) => [...g, v]);
    setNewGateway('');
  }

  function removeGateway(g) {
    setGateways((list) => list.filter((x) => x !== g));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      if (isEdit) {
        await api.buildingUpdate({ id: editId, name: name.trim(), address: address.trim(), floors: parseInt(floors), gateways });
        showToast('Budova upravena', 'success');
        navigate(`/building/${editId}`);
      } else {
        const created = await api.buildingCreate({ name: name.trim(), address: address.trim(), floors: parseInt(floors), gateways });
        showToast('Budova vytvořena', 'success');
        navigate(`/building/${created._id}`);
      }
    } catch (err) {
      setError(err.message || 'Chyba při ukládání budovy');
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="loading-page"><div className="spinner" /><span>Načítání…</span></div>;
  }
  if (error && !name) {
    return <div className="empty-state"><h3>{error}</h3></div>;
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <div className="auth-logo">
          <h1>{isEdit ? 'Upravit dům' : 'Nový dům'}</h1>
          <p>{isEdit ? 'Upravte informace o budově' : 'Vytvořte novou budovu pro monitoring'}</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Název nového domu</label>
            <input className="form-input" type="text" placeholder="Zadejte název domu"
              value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Adresa</label>
            <input className="form-input" type="text" placeholder="Adresa budovy"
              value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Počet pater</label>
            <input className="form-input" type="number" placeholder="Počet pater" min="1" max="100"
              value={floors} onChange={(e) => setFloors(e.target.value)} required />
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Přidat Gateway</label>
            <small style={{ color: 'var(--text-tertiary)', fontSize: '.78rem', marginBottom: 4 }}>
              Gateway propojuje IoT moduly s naším systémem. Zadejte ID každé brány instalované v této budově.
            </small>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="text" placeholder="ID Gateway"
                value={newGateway}
                onChange={(e) => setNewGateway(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGateway(); } }}
                style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addGateway}>Přidat</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Seznam přidaných Gateway</label>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 8, minHeight: 60, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gateways.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '.85rem', padding: 16, textAlign: 'center' }}>
                  Žádné přidané Gateway
                </div>
              ) : gateways.map((g) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '.85rem' }}>
                  <span>📡 {g}</span>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => removeGateway(g)} style={{ color: 'var(--accent-danger)', fontSize: '.9rem' }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--accent-danger)', fontSize: '.85rem', padding: '8px 12px', background: 'var(--status-danger-bg)', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => navigate(isEdit ? `/building/${editId}` : '/dashboard')}>Zrušit</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={!canSubmit || busy}>
              {busy ? 'Ukládám…' : (isEdit ? 'Upravit' : 'Vytvořit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
