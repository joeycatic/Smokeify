import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageLayout from "@/components/PageLayout";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
          Admin
        </h1>
        {isAdmin ? (
          <p className="text-stone-600">
            Du hast Admin-Zugriff. Hier kannst du spaeter Rollen und Inhalte
            verwalten.
          </p>
        ) : (
          <p className="text-stone-600">
            Kein Zugriff. Diese Seite ist nur fuer Admins sichtbar.
          </p>
        )}
      </div>
    </PageLayout>
  );
}
