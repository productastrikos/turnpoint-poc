import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_ACCOUNT, DEMO_ACCOUNTS, DEMO_PASSWORD } from './auth';
import { Icon } from './icons';

const HIGHLIGHTS = [
  'One live picture of scope, schedule, cost and readiness',
  'Critical-path and finish-date risk, with the recommended action',
  'SAP and Primavera P6 kept in step, with an AI assistant on top',
];

export function LoginPage() {
  const { signIn } = useAuth();
  // Pre-filled for the demo: just press Sign in (the button has focus).
  const [email, setEmail] = useState(DEFAULT_ACCOUNT.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!signIn(email, password)) setError('Email or password not recognised. Pick a demo account below.');
  }

  return (
    <div className="login">
      <aside className="login-brand" aria-hidden="true">
        <div className="login-brand-top">
          <div className="brand-mark">T</div>
          <div className="brand-text">
            <strong>TURNPOINT</strong>
            <span>Turnaround Digitalization</span>
          </div>
        </div>
        <div>
          <h2>Run the turnaround from one screen.</h2>
          <ul>
            {HIGHLIGHTS.map((h) => (
              <li key={h}><Icon name="check" size={16} /> {h}</li>
            ))}
          </ul>
        </div>
        <div className="login-brand-foot">Proof of concept · Major STO 2026 · Sohar Refinery · by Astrikos AI</div>
      </aside>

      <main className="login-panel">
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="login-card-mark"><div className="brand-mark">T</div></div>
          <h1>Sign in</h1>
          <p className="login-sub">to TURNPOINT</p>

          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="text" inputMode="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />

          <label htmlFor="login-password">Password</label>
          <div className="login-pw">
            <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
            <button type="button" className="login-pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </div>

          <div className="login-error" role="alert">{error}</div>

          <button type="submit" className="btn btn-primary login-submit" autoFocus>Sign in</button>

          <div className="login-demo">
            <div className="login-demo-head">
              <span className="eyebrow">Demo accounts</span>
              <span>Credentials are pre-filled. Pick a role to try its access rights.</span>
            </div>
            <div className="login-demo-list" role="group" aria-label="Demo accounts">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className={`login-demo-item ${email === a.email ? 'is-on' : ''}`}
                  onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(''); }}
                >
                  <strong>{a.label}</strong>
                  <span>{a.org}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
