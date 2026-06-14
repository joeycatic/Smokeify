/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TEST_PAYMENT_ORDER_PREFIX = "test_payment_order_";

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      AND: [
        { orders: { some: { paymentOrderCode: { startsWith: TEST_PAYMENT_ORDER_PREFIX } } } },
        { orders: { every: { paymentOrderCode: { startsWith: TEST_PAYMENT_ORDER_PREFIX } } } },
      ],
      accounts: { none: {} },
      sessions: { none: {} },
      wishlistItems: { none: {} },
      savedSetups: { none: {} },
      returnRequests: { none: {} },
      reviews: { none: {} },
      devices: { none: {} },
      verificationCodes: { none: {} },
      backInStockRequests: { none: {} },
    },
    select: { id: true, email: true },
  });

  if (candidates.length === 0) {
    console.log("No test users found.");
    return;
  }

  const ids = candidates.map((user) => user.id);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${ids.length} test users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
