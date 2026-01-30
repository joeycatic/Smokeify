// components/PageLayout.tsx
import type { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { Navbar } from "./Navbar";
import Footer from "./Footer";
import AdminBackButton from "@/components/admin/AdminBackButton";

type PageLayoutProps = {
  children: ReactNode;
};

type LayoutSectionProps = {
  children: ReactNode;
};

function PageShell({ children }: LayoutSectionProps) {
  return (
    <main className="min-h-screen bg-stone-100 flex flex-col">
      {children}
    </main>
  );
}

function PageContainer({ children }: LayoutSectionProps) {
  return (
    <div className="mx-auto w-full flex-1 px-3 sm:px-4 lg:max-w-6xl">
      {children}
    </div>
  );
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <PageShell>
      <AnnouncementBar />
      <PageContainer>
        <Navbar />
        <AdminBackButton />
        {children}
      </PageContainer>
      <Footer />
    </PageShell>
  );
}
