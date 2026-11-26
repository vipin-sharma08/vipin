import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { GeistSerif } from 'geist/font/serif';
import { GeistPixelSquare } from 'geist/font/pixel';
import { identity } from '@/content';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: identity.name,
  description: identity.description,
  openGraph: { title: identity.name, description: identity.ogDescription, type: 'website', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: identity.name, description: identity.ogDescription, images: ['/og.png'] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#010206' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [GeistSans.variable, GeistMono.variable, GeistSerif.variable, GeistPixelSquare.variable].join(' ');
  return (
    <html lang="en" className={fonts}>
      <body>{children}</body>
    </html>
  );
}
