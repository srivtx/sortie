import type { Metadata } from 'next';
import './globals.css';
import { themeInitScript } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'SORTIE — semantic execution debugger for Solana',
  description: 'Stop reading hex. Stop guessing error codes. SORTIE reconstructs the execution tree, decodes the failure, and tells you what to fix.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
