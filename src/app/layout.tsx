import './globals.css';
import type { Metadata } from 'next';
import { PresenceProvider } from '@/components/presence-provider';

export const metadata: Metadata = {
  title: 'Toky Chat',
  description: 'Toky Chat — a fast, modern messaging app.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <PresenceProvider>{children}</PresenceProvider>
      </body>
    </html>
  );
}
