import './globals.css';
import type { Metadata } from 'next';
import { PresenceProvider } from '@/components/presence-provider';
import { ConsentGate } from '@/components/consent-gate';
import { LanguageProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme';
import { CallProvider } from '@/lib/call/call-provider';

export const metadata: Metadata = {
  title: 'Toky Chat',
  description: 'Toky Chat — a fast, modern messaging app.'
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
