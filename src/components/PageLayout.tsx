// components/PageLayout.tsx
import type { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { Navbar } from "./Navbar";
import Footer from "./Footer";
import CommerceProviders from "@/components/CommerceProviders";
import { getNavbarCategories } from "@/lib/navbarCategories";

type PageLayoutProps = {
  children: ReactNode;
  commerce?: boolean;
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

export default async function PageLayout({
  children,
  commerce = false,
}: PageLayoutProps) {
  const initialCategories = await getNavbarCategories();
  const content = (
    <>
      <AnnouncementBar />
      <PageContainer>
        <Navbar initialCategories={initialCategories} />
        {children}
      </PageContainer>
      <Footer />
    </>
  );

  return (
    <PageShell>
      {commerce ? <CommerceProviders>{content}</CommerceProviders> : content}
    </PageShell>
  );
}
