import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string;
  email: string | null;
};

export async function issueAdminStoreCredit(input: {
  userId: string;
  amountCents: number;
  reason: string;
  actor: AdminActor;
  orderId?: string;
  returnRequestId?: string;
  metadata?: Record<string, unknown>;
}) {
  const customer = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      role: true,
      storeCreditBalance: true,
    },
  });
  if (!customer || customer.role !== "USER") {
    throw new Error("Customer not found.");
  }

  const nextBalance = customer.storeCreditBalance + input.amountCents;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: customer.id },
      data: { storeCreditBalance: nextBalance },
    }),
    prisma.storeCreditTransaction.create({
      data: {
        userId: customer.id,
        returnRequestId: input.returnRequestId,
        orderId: input.orderId,
        amountDelta: input.amountCents,
        reason: input.reason,
        metadata: {
          source: input.returnRequestId ? "admin.returns" : "admin.crm",
          issuedById: input.actor.id,
          issuedByEmail: input.actor.email,
          previousBalance: customer.storeCreditBalance,
          nextBalance,
          ...input.metadata,
        },
      },
    }),
  ]);

  return {
    customer,
    nextBalance,
    previousBalance: customer.storeCreditBalance,
  };
}
