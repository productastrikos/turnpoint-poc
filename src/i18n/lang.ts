import { createContext, useContext } from 'react';
import { AR } from './ar';

export type Lang = 'en' | 'ar';

export interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translates a shell string: Arabic when selected and known, otherwise the English text unchanged. */
  t: (en: string) => string;
}

const KEY = 'turnpoint-lang';

export const LangContext = createContext<LangCtx | null>(null);

export function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/** Sets <html lang dir> and remembers the choice. Also called before first paint (main.tsx) so there is no flash. */
export function applyLang(lang: Lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable: the language just is not remembered */
  }
}

export const translate = (lang: Lang, en: string) => (lang === 'ar' ? AR[en] ?? en : en);

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
