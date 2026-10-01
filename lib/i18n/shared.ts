import english from './en.json';
export type Locale = 'fr' | 'en';
export const localeTag = (locale: Locale) => locale === 'en' ? 'en-GB' : 'fr-FR';
export function translate(locale: Locale, message: string): string {
  return locale === 'en' ? (english as Record<string, string>)[message] ?? message : message;
}
export function resolveLocale(cookie?: string, acceptLanguage = ''): Locale {
  if (cookie === 'en' || cookie === 'fr') return cookie;
  const preferences = acceptLanguage.split(',').map((entry, index) => {
    const [tag, quality] = entry.trim().toLowerCase().split(';');
    return { language: tag.split('-')[0], quality: quality?.startsWith('q=') ? Number(quality.slice(2)) : 1, index };
  }).sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences.find(p => p.quality > 0 && (p.language === 'fr' || p.language === 'en'))?.language as Locale || 'fr';
}
