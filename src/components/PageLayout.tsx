// components/PageLayout.tsx
import type { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { Navbar } from "./Navbar";
import CommerceShell from "./CommerceShell";
import Footer from "./Footer";
import SimpleHeader from "./SimpleHeader";

type PageLayoutProps = {
  children: ReactNode;
  commerce?: boolean;
};

type LayoutSectionProps = {
  children: ReactNode;
};

function PageShell({ children }: LayoutSectionProps) {
  return (
    <main className="smk-shell flex min-h-screen flex-col">
      {children}
    </main>
  );
}

function PageContainer({ children }: LayoutSectionProps) {
  return (
    <div className="mx-auto w-full flex-1 px-4 sm:px-6 lg:max-w-[1280px] lg:px-8">
      {children}
    </div>
  );
}

export default async function PageLayout({
  children,
  commerce = true,
}: PageLayoutProps) {
  if (!commerce) {
    return (
      <PageShell>
        <SimpleHeader />
        <PageContainer>{children}</PageContainer>
        <Footer />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <CommerceShell>
        <AnnouncementBar />
        <PageContainer>
          <Navbar />
          {children}
        </PageContainer>
        <Footer />
      </CommerceShell>
    </PageShell>
  );
}
