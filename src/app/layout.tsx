import './globals.css';
import type { Metadata } from 'next';
import { PresenceProvider } from '@/components/presence-provider';
import { ConsentGate } from '@/components/consent-gate';
import { LanguageProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme';

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
            <PresenceProvider>{children}</PresenceProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
