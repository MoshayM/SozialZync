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
  themeColor: '#374151',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'SozialZynk', template: '%s · SozialZynk' },
  description: 'AI-powered creator platform. Research, script, create, and publish across all your channels — from one intelligent workspace.',
  applicationName: 'SozialZynk',
  alternates: { canonical: '/' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: [{ url: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }],
  },
  // PWA / mobile app meta
  appleWebApp: {
    capable: true,
    title: 'SozialZynk',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'SozialZynk',
    title: 'SozialZynk — AI Creator Platform',
    description: 'Your AI content team. Research, script, create, and publish to every channel — faster, smarter, and always on-brand.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SozialZynk',
    description: 'AI-powered multi-platform content creation for serious creators.',
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
