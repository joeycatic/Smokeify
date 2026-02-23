import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminUserEditClient from "./AdminUserEditClient";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const ok =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!ok) notFound();

  const { id } = await params;

  const [user, recentOrders, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        role: true,
        customerGroup: true,
        notes: true,
        newsletterOptIn: true,
        newsletterOptInAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        amountTotal: true,
        createdAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetType: "user", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!user) notFound();

  return (
    <PageLayout>
      <AdminUserEditClient
        user={{
          ...user,
          newsletterOptInAt: user.newsletterOptInAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }}
        recentOrders={recentOrders.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        }))}
        auditLogs={auditLogs.map((l) => ({
          id: l.id,
          actorEmail: l.actorEmail,
          action: l.action,
          summary: l.summary,
          metadata: l.metadata as Record<string, unknown> | null,
          createdAt: l.createdAt.toISOString(),
        }))}
        actorRole={session.user.role}
      />
    </PageLayout>
  );
}
