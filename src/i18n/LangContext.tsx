import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LangContext, applyLang, readLang, translate, type Lang } from './lang';
import { startDomTranslation, stopDomTranslation } from './domTranslate';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang);
  useEffect(() => applyLang(lang), [lang]);
  // page bodies: translate the rendered DOM from the Arabic page dictionary (loaded only when Arabic is chosen)
  useEffect(() => {
    if (lang !== 'ar') return;
    let live = true;
    import('./ar.pages').then((m) => live && startDomTranslation(m.AR_PAGES));
    return () => {
      live = false;
      stopDomTranslation();
    };
  }, [lang]);
  const t = useCallback((en: string) => translate(lang, en), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
