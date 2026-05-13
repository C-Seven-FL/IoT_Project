import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

function mapAuthError(err) {
  if (!err) return 'Přihlášení selhalo.';
  if (err.code === 'invalidCredentials') return 'Nesprávný email nebo heslo.';
  if (err.code === 'networkError') return 'Backend není dostupný — zkontrolujte připojení.';
  return err.message || 'Přihlášení selhalo.';
}

export default function Login() {
  const { login } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = !email.trim() || !password || busy;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (disabled) return;
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      showToast(`Vítejte, ${user.firstName || user.email}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
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
          <h1>Smart Guard System</h1>
          <p>IoT monitoring platforma</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              className="form-input" id="login-email" type="email" autoComplete="email"
              placeholder="vas@email.cz" value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Heslo</label>
            <input
              className="form-input" id="login-password" type="password" autoComplete="current-password"
              placeholder="Zadejte heslo" value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              required
            />
          </div>

          {error && (
            <div className="form-error" style={{ color: 'var(--accent-danger)', fontSize: '.85rem', padding: '8px 12px', background: 'var(--status-danger-bg)', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={disabled}>
            {busy ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>

        <div className="auth-footer">
          Nemáte účet? <a href="#/register">Zaregistrovat se</a>
        </div>
      </div>
    </div>
  );
}
