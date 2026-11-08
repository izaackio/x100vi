import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'X100VI — The patient pursuit',
  description:
    'Your personal Fujifilm X100VI deal tracker. Find the right camera, at the right price.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
