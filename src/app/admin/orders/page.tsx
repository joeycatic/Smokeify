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
  const productIds = Array.from(
    new Set(
      orders.flatMap((order) =>
        order.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id))
      )
    )
  );
  const products = await prisma.product.findMany({
    where: productIds.length ? { id: { in: productIds } } : { id: "__none__" },
    select: { id: true, manufacturer: true },
  });
  const manufacturerByProductId = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );
  const normalizeOptions = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        const name = typeof entry?.name === "string" ? entry.name : "";
        const val = typeof entry?.value === "string" ? entry.value : "";
        return name && val ? { name, value: val } : null;
      })
      .filter(
        (entry): entry is { name: string; value: string } => Boolean(entry)
      );
  };
  const webhookFailures = await prisma.processedWebhookEvent.findMany({
    where: { status: "failed" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminOrdersClient
          webhookFailures={webhookFailures.map((event) => ({
            id: event.id,
            eventId: event.eventId,
            type: event.type,
            status: event.status,
            createdAt: event.createdAt.toISOString(),
          }))}
          orders={orders.map((order) => ({
            ...order,
            user: order.user ?? { email: null, name: null },
            items: order.items.map((item) => ({
              ...item,
              manufacturer: item.productId
                ? manufacturerByProductId.get(item.productId) ?? null
                : null,
              options: normalizeOptions(item.options),
            })),
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            confirmationEmailSentAt: order.confirmationEmailSentAt
              ? order.confirmationEmailSentAt.toISOString()
              : null,
            shippingEmailSentAt: order.shippingEmailSentAt
              ? order.shippingEmailSentAt.toISOString()
              : null,
            refundEmailSentAt: order.refundEmailSentAt
              ? order.refundEmailSentAt.toISOString()
              : null,
          }))}
        />
      </div>
    </PageLayout>
  );
}
