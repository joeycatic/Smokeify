// components/PageLayout.tsx
import type { ReactNode } from 'react';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';

type PageLayoutProps = {
  children: ReactNode
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <main className="bg-stone-200">
        <AnnouncementBar />
        <div className="mx-auto max-w-6xl px-6">
            <Navbar />
    
            {children}
         </div>
    </main>
  );
}