import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LangContext, applyLang, readLang, translate, type Lang } from './lang';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang);
  useEffect(() => applyLang(lang), [lang]);
  const t = useCallback((en: string) => translate(lang, en), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
