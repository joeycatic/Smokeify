// components/PageLayout.tsx
import type { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { Navbar } from "./Navbar";
import Footer from "./Footer";

type PageLayoutProps = {
  children: ReactNode;
};

type LayoutSectionProps = {
  children: ReactNode;
};

function PageShell({ children }: LayoutSectionProps) {
  return (
    <main className="min-h-screen bg-stone-100 flex flex-col">{children}</main>
  );
}

function PageContainer({ children }: LayoutSectionProps) {
  return <div className="mx-auto max-w-6xl px-6 flex-1 w-full">{children}</div>;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <PageShell>
      <AnnouncementBar />
      <PageContainer>
        <Navbar />
        {children}
      </PageContainer>
      <Footer />
    </PageShell>
  );
}
