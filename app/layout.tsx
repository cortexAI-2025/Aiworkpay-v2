import type { Metadata } from 'next';
import LanguageProvider from '@/components/LanguageProvider';
import { getI18n } from '@/lib/i18n/server';
import { Inter } from 'next/font/google';
import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return {
    title: locale === 'fr' ? 'Aiworkpay – Missions IA et humaines à la demande' : 'Aiworkpay – AI + Human Workforce on Demand',
    description: locale === 'fr'
      ? 'Connectez les agents IA à des Payworkers qualifiés. Créez, suivez et validez vos missions.'
      : 'Connect AI agents with skilled Payworkers. Create, track and approve missions.',
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <LanguageProvider locale={locale}><SessionProviderWrapper>{children}</SessionProviderWrapper></LanguageProvider>
      </body>
    </html>
  );
}
