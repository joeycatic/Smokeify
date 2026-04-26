import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageLayout from "@/components/PageLayout";
import PasswordChangeClient from "./PasswordChangeClient";

export default async function AccountPasswordPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <PageLayout commerce>
        <div className="smk-storefront-legacy mx-auto max-w-md px-6 py-12 text-[var(--smk-text)]">
          <h1 className="smk-heading mb-4 text-3xl">
            Account
          </h1>
          <p className="mb-6 text-[var(--smk-text-muted)]">
            Melde dich an, um dein Passwort zu aendern.
          </p>
          <Link
            href="/api/auth/signin"
            className="smk-button-primary inline-flex rounded-full px-5 py-3 text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout commerce>
      <div className="smk-storefront-legacy mx-auto max-w-md px-6 py-12 text-[var(--smk-text)]">
        <div className="overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="h-1 w-full bg-[linear-gradient(90deg,#f1c684_0%,#e9bc74_45%,#d97745_100%)]" />
          <div className="p-6">
            <div className="mb-6">
              <h1 className="smk-heading text-xl font-semibold">
                Passwort ändern
              </h1>
              <p className="mt-1 text-sm text-[var(--smk-text-muted)]">
                Aktualisiere dein Passwort.
              </p>
            </div>
            <PasswordChangeClient />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
