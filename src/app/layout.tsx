import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { CLUB } from '@/config/club';
import '@/styles/modernist.css';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: `Schiriplan · ${CLUB.name}`,
  description: `Schiedsrichter-Planung der Basketballabteilung ${CLUB.name}.`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="de">
    <body>{children}</body>
  </html>
);

export default RootLayout;
