import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { SwRegister } from '@/components/sw-register';
import { PwaInstallBanner } from '@/components/pwa-install';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-plus-jakarta' });

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://sozialzync.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#6D4AE0',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Sozialzynk', template: '%s · Sozialzynk' },
  description: 'AI-powered YouTube Content Operating System. Create, grow and publish with AI — from research to viral shorts.',
  applicationName: 'Sozialzynk',
  alternates: { canonical: '/' },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  // PWA / mobile app meta
  appleWebApp: {
    capable: true,
    title: 'Sozialzynk',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Sozialzynk',
    title: 'Sozialzynk — YouTube Content OS',
    description: 'Turn long videos into publish-ready Shorts, edit with a full timeline, and publish — AI-assisted end to end.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sozialzynk',
    description: 'AI-powered YouTube content creation platform.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={plusJakarta.className}>
        <Providers>{children}</Providers>
        <SwRegister />
        <PwaInstallBanner />
      </body>
    </html>
  );
}
