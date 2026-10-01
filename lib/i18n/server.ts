import 'server-only';
import { cookies, headers } from 'next/headers';
import { localeTag, resolveLocale, translate } from './shared';
export async function getI18n() {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(jar.get('awp_locale')?.value, requestHeaders.get('accept-language') ?? '');
  return { locale, formatLocale: localeTag(locale), t: (message: string) => translate(locale, message) };
}
