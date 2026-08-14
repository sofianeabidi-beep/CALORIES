import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Symbio',
  // Aucune allégation médicale, ici comme ailleurs (section 9).
  description: 'Suivi calorique cumulé : où j’en suis vraiment, et est-ce que ça marche.',
  applicationName: 'Symbio',
  appleWebApp: { capable: true, title: 'Symbio', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Le zoom reste autorisé : le bloquer casse l'accessibilité.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#14161a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
