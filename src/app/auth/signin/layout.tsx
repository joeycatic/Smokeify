import PageLayout from "@/components/PageLayout";

export default function AuthSigninLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageLayout>{children}</PageLayout>;
}
