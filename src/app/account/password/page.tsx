import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageLayout from "@/components/PageLayout";
import PasswordChangeClient from "./PasswordChangeClient";

export default async function AccountPasswordPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
          <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-stone-600 mb-6">
            Melde dich an, um dein Passwort zu aendern.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#2f3e36" }}
            >
              Passwort
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Aktualisiere dein Passwort.
            </p>
          </div>
          <PasswordChangeClient />
        </div>
      </div>
    </PageLayout>
  );
}
