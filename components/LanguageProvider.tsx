'use client';
import { createContext, useContext } from 'react';
import { Locale, localeTag, translate } from '@/lib/i18n/shared';
const LanguageContext = createContext<Locale>('fr');
export default function LanguageProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>;
}
export function useI18n() {
  const locale = useContext(LanguageContext);
  return { locale, formatLocale: localeTag(locale), t: (message: string) => translate(locale, message) };
}
