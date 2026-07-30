import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { PresenceProvider } from '@/components/presence-provider';

// Distinctive display face for the wordmark, headers and section titles; a
// warm, highly legible grotesque for body/UI text. Both are self-hosted by
// next/font at build time, so they ship inside the app bundle and render even
// when the Capacitor webview is offline. Exposed as CSS variables consumed in
// globals.css (--font-display / --font-body).
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
import { ConsentGate } from '@/components/consent-gate';
import { LanguageProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme';
import { CallProvider } from '@/lib/call/call-provider';
import { NotificationRouter } from '@/components/notification-router';
import { NativeAuthLinks } from '@/components/native-auth-links';

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
  // Android Chrome keeps the layout viewport full-height when the on-screen
  // keyboard opens, so `100dvh` panels get shoved around/behind it. Asking the
  // browser to resize the content viewport makes `dvh`/`vh` shrink to the space
  // above the keyboard, keeping the composer docked and the header in view.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <ThemeProvider>
          <LanguageProvider>
            <ConsentGate />
            <NotificationRouter />
            <NativeAuthLinks />
            <CallProvider>
              <PresenceProvider>{children}</PresenceProvider>
            </CallProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
