import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import AdminReturnsClient from "./AdminReturnsClient";

export default async function AdminReturnsPage() {
  if (!(await requireAdmin())) notFound();

  const requests = await prisma.returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      order: true,
      exchangeOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
      user: { select: { email: true, name: true } },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              name: true,
              unitAmount: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminReturnsClient
        requests={requests.map((req) => ({
          ...req,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString(),
          requestedResolution: req.requestedResolution,
          exchangePreference: req.exchangePreference,
          storeCreditAmount: req.storeCreditAmount,
          exchangeApprovedAt: req.exchangeApprovedAt?.toISOString() ?? null,
          exchangeOrder: req.exchangeOrder
            ? {
                id: req.exchangeOrder.id,
                orderNumber: req.exchangeOrder.orderNumber,
                status: req.exchangeOrder.status,
              }
            : null,
          order: {
            id: req.order.id,
            amountTotal: req.order.amountTotal,
            currency: req.order.currency,
            status: req.order.status,
          },
          items: req.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            orderItemId: item.orderItemId,
            orderItemName: item.orderItem.name,
            unitAmount: item.orderItem.unitAmount,
          })),
        }))}
      />
    </div>
  );
}
