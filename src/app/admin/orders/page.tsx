import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminOrdersClient from "./AdminOrdersClient";

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminOrdersClient
          orders={orders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
          }))}
        />
      </div>
    </PageLayout>
  );
}
