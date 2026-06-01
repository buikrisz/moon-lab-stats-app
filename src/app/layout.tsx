import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Moon Lab Stats App',
  description: 'Moon Lab Pilates finance and attendance dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
