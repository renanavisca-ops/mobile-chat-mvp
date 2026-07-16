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
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Toky Chat' },
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
