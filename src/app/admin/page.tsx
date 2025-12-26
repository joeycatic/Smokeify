import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
            Admin
          </h1>
          <p className="text-sm text-stone-600">
            Nutzerverwaltung und Rollensteuerung.
          </p>
        </div>
        <AdminUsersClient initialUsers={users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
        }))} />
      </div>
    </PageLayout>
  );
}
