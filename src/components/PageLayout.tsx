// components/PageLayout.tsx
import type { ReactNode } from 'react';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import Footer from './Footer';

type PageLayoutProps = {
  children: ReactNode
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <main className="min-h-screen bg-stone-200 flex flex-col">
        <AnnouncementBar />
        <div className="mx-auto max-w-6xl px-6 flex-1 w-full">
            <Navbar />
    
            {children}
         </div>
         <Footer />
    </main>
  );
}
