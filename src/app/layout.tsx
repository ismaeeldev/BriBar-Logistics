/**
 * Root layout.
 *
 * `viewport` carries the mobile-first commitment from SRS 23.1:
 * `width=device-width` at scale 1 with no maximum, so a driver can pinch-zoom
 * the form on a phone. Capping zoom is a common default that quietly fails
 * WCAG 1.4.4, and SRS 23.10 asks for accessible behaviour throughout.
 *
 * `robots: noindex` because this is a private internal system on a BRIBAR
 * subdomain (SRS 4.4), not a public site.
 */
import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

import { THEME_SCRIPT } from '@/components/layout/theme';
import { LOCALE } from '@/lib/i18n/messages';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'BRIBAR Logistics',
    template: '%s · BRIBAR Logistics',
  },
  description: 'Internal route sheet and service management for BRIBAR Logistics.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale: pinch-zoom must stay available on the driver's phone.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` is scoped to this one element and is required:
    // the head script writes `data-theme` onto it before React arrives, so the
    // server's markup and the client's DOM legitimately differ by that
    // attribute. Nothing below it is exempted.
    <html
      lang={LOCALE}
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        `beforeInteractive` is the only strategy that runs before the browser
        paints, which is the entire requirement: a theme applied after first
        paint is a flash of the wrong theme. A bare `<script>` in a component
        tree would be moved by React and silently skipped on a client render.
      */}
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
