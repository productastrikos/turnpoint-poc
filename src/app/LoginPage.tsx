import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_USERNAME, DEMO_PASSWORD } from './auth';
import { Icon } from './icons';
import { useLang } from '../i18n/lang';
import { LangToggle } from '../i18n/LangToggle';

/** Plain centered sign-in card. Generic on purpose: no company names. Always dark, like the other PoC sign-in pages. */
export function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useLang();
  // Pre-filled for the demo: just press Sign In (the button has focus).
  const [name, setName] = useState(DEFAULT_USERNAME);
  const [pass, setPass] = useState(DEMO_PASSWORD);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !pass) return setErr(t('Enter your username and password.'));
    if (!signIn(name, pass)) setErr(t('Invalid username or password.'));
  }

  return (
    <div className="login">
      <LangToggle className="login-lang" />
      <form className="login-card" onSubmit={submit} noValidate>
        <h1>{t('Turnaround Management')}</h1>
        <p className="login-sub">{t('Sign in to access your dashboard')}</p>

        <label htmlFor="login-user">{t('Username')}</label>
        <div className="login-field">
          <Icon name="user" size={18} />
          <input id="login-user" autoComplete="username" autoCapitalize="off" spellCheck={false} dir="ltr" value={name} placeholder={t('Enter username')} onChange={(e) => { setName(e.target.value); setErr(''); }} />
        </div>

        <label htmlFor="login-pass">{t('Password')}</label>
        <div className="login-field">
          <Icon name="lock" size={18} />
          <input id="login-pass" type={show ? 'text' : 'password'} autoComplete="current-password" dir="ltr" value={pass} placeholder={t('Enter password')} onChange={(e) => { setPass(e.target.value); setErr(''); }} />
          <button type="button" className="login-eye" onClick={() => setShow((s) => !s)} aria-label={t(show ? 'Hide password' : 'Show password')}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={19} />
          </button>
        </div>

        <div className="login-error" role="alert">{err}</div>
        <button type="submit" className="login-submit" autoFocus>{t('Sign In')}</button>
      </form>
    </div>
  );
}
