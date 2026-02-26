import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mobile Chat MVP',
  description: 'Signal-like E2EE MVP on Next.js + Supabase'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
