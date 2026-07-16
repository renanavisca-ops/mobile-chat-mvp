import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PresenceProvider } from '@/components/presence-provider';
import { ConsentGate } from '@/components/consent-gate';
import { LanguageProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme';
import { CallProvider } from '@/lib/call/call-provider';

export const metadata: Metadata = {
  title: 'Toky Chat',
  description: 'Toky Chat — a fast, modern messaging app.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Toky Chat' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

// Make the app fit and adapt to phone browsers (device width, safe areas, and
// a matching browser-chrome color for light/dark).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <ThemeProvider>
          <LanguageProvider>
            <ConsentGate />
            <CallProvider>
              <PresenceProvider>{children}</PresenceProvider>
            </CallProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
