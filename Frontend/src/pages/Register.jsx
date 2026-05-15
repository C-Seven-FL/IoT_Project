// Registrace — pouze role USER (civil) nebo RESCUER (záchranář).
// USER musí povinně zvolit budovu (dropdown ze všech budov v DB).
// RESCUER si budovu nevybírá — vidí v aplikaci všechny budovy.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, PUBLIC_REGISTRATION_ROLES, ROLE_LABELS } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';

function mapRegError(err) {
  if (!err) return 'Registrace selhala.';
  if (err.code === 'userAlreadyExists') return 'Uživatel s tímto emailem už existuje.';
  if (err.code === 'invalidDtoIn') return err.message || 'Neplatná data.';
  if (err.code === 'invalidRole') return 'Vybraná role není povolena pro veřejnou registraci.';
  if (err.code === 'buildingRequired') return 'Pro civilní obyvatele je nutné zvolit budovu.';
  if (err.code === 'buildingDoesNotExist') return 'Vybraná budova nebyla nalezena.';
  if (err.code === 'networkError') return 'Backend není dostupný.';
  return err.message || 'Registrace selhala.';
}

export default function Register() {
  const { register } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [buildings, setBuildings] = useState([]);
  const [buildingsErr, setBuildingsErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
    role: 'USER',
    building: ''
  });

  useEffect(() => {
    api.buildingPublicList()
      .then((d) => setBuildings(d.itemList || []))
      .catch((e) => setBuildingsErr(e));
  }, []);

  const passwordsMismatch = form.confirm && form.password && form.password !== form.confirm;

  const isValid = useMemo(() => {
    if (!form.firstName.trim()) return false;
    if (!form.lastName.trim()) return false;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return false;
    if (form.password.length < 6) return false;
    if (form.password !== form.confirm) return false;
    if (!PUBLIC_REGISTRATION_ROLES.includes(form.role)) return false;
    if (form.role === 'USER' && !form.building) return false;
    return true;
  }, [form]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!isValid) {
      setError('Zkontrolujte vyplněná pole — všechna povinná musí být validní a hesla musí souhlasit.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        building: form.role === 'USER' ? form.building : null
      });
      showToast('Registrace úspěšná!', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(mapRegError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h1>Registrace</h1>
          <p>Vytvořte si účet v systému Smart Guard</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Jméno</label>
            <input className="form-input" type="text" placeholder="Vaše jméno"
              value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Příjmení</label>
            <input className="form-input" type="text" placeholder="Vaše příjmení"
              value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="vas@email.cz"
              value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Heslo</label>
            <input className="form-input" type="password" placeholder="Zvolte heslo (min. 6 znaků)"
              value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
          </div>

          <div className="form-group">
            <label className="form-label">Heslo (potvrdit)</label>
            <input className="form-input" type="password" placeholder="Zopakujte heslo"
              value={form.confirm} onChange={(e) => update('confirm', e.target.value)} required minLength={6} />
            {passwordsMismatch && (
              <small style={{ color: 'var(--accent-danger)', fontSize: '.75rem' }}>Hesla se neshodují.</small>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={(e) => update('role', e.target.value)}>
              {PUBLIC_REGISTRATION_ROLES.map((r) => (
                <option key={r} value={r}>{r} — {ROLE_LABELS[r]}</option>
              ))}
            </select>
            <small style={{ color: 'var(--text-tertiary)', fontSize: '.78rem', marginTop: 2 }}>
              {form.role === 'RESCUER'
                ? 'Záchranář vidí všechny budovy v systému — nevybírá si jednu konkrétní.'
                : 'Civilní obyvatel je přiřazen k jedné konkrétní budově.'}
            </small>
          </div>

          {form.role === 'USER' && (
            <div className="form-group">
              <label className="form-label">Budova <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              {buildingsErr ? (
                <div style={{ color: 'var(--accent-danger)', fontSize: '.85rem' }}>
                  Nepodařilo se načíst budovy: {buildingsErr.message}
                </div>
              ) : buildings.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '.85rem', padding: 10, border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  V systému zatím nejsou žádné budovy. Registrace jako <strong>USER</strong> není možná, dokud admin nějakou nevytvoří. Můžete se zaregistrovat jako <strong>RESCUER</strong>.
                </div>
              ) : (
                <select className="form-input" required
                  value={form.building} onChange={(e) => update('building', e.target.value)}>
                  <option value="">— vyberte budovu —</option>
                  {buildings.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}{b.address ? ' — ' + b.address : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <div className="form-error" style={{ color: 'var(--accent-danger)', fontSize: '.85rem', padding: '8px 12px', background: 'var(--status-danger-bg)', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={!isValid || busy}>
            {busy ? 'Registruji…' : 'Registrovat se'}
          </button>
        </form>

        <div className="auth-footer">
          Máte účet? <a href="#/login">Přihlásit se</a>
        </div>
      </div>
    </div>
  );
}
