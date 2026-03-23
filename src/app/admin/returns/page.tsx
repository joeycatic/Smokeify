import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminReturnsClient from "./AdminReturnsClient";

export default async function AdminReturnsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const requests = await prisma.returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      order: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminReturnsClient
        requests={requests.map((req) => ({
          ...req,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString(),
          order: {
            id: req.order.id,
            amountTotal: req.order.amountTotal,
            currency: req.order.currency,
            status: req.order.status,
          },
        }))}
      />
    </div>
  );
}
