/**
 * app/layout.tsx — корневой layout Next.js (App Router).
 * Оборачивает все страницы в ErrorBoundary, Providers, Header, Footer.
 */

import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Providers } from '@/components/common/Providers';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';

export const metadata: Metadata = {
  title: 'Конкурс — VK Mini App',
  description: 'Платформа для участия в конкурсе с интерактивными карточками',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <ErrorBoundary>
          <Providers>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
                {children}
              </main>
              <Footer />
            </div>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
