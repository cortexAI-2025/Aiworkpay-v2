'use client';
import { useI18n } from './LanguageProvider';
export default function LanguageSwitcher() {
  const { locale } = useI18n();
  return <label className="inline-flex items-center gap-2 text-sm font-medium">
    <span className="sr-only">{locale === 'fr' ? 'Langue' : 'Language'}</span>
    <select aria-label={locale === 'fr' ? 'Langue' : 'Language'} value={locale}
      className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-900"
      onChange={event => {
        document.cookie = `awp_locale=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        window.location.reload();
      }}>
      <option value="fr">Français</option><option value="en">English</option>
    </select>
  </label>;
}
