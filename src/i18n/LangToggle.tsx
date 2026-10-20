import { useLang } from './lang';

/** English / Arabic switch. `className` lets the login page and the top bar style it differently. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t('Language')}>
      <button type="button" className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'} lang="en" onClick={() => setLang('en')}>EN</button>
      <button type="button" className={lang === 'ar' ? 'is-on' : ''} aria-pressed={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>العربية</button>
    </div>
  );
}
