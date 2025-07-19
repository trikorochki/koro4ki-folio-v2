import { Space_Mono, Tektur } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import MusicPlayer from '@/components/MusicPlayer';
import Footer from '@/components/Footer';

const tektur = Tektur({ 
  weight: ['400', '500', '700'],
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-tektur'
});

const spaceMono = Space_Mono({ 
  weight: ['400', '700'], 
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-space-mono'
});

export const metadata = {
  title: 'kr4.pro | neuromusic production',
  description: 'Six worlds. One universe',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${tektur.variable} ${spaceMono.variable}`}>
      <body className={`${spaceMono.className} bg-bg-color text-primary-text-color`}>
        <Header />
        <main className="min-h-screen pt-20 pb-[150px]">
          {children}
        </main>
        <Footer />
        <MusicPlayer />
      </body>
    </html>
  );
}
