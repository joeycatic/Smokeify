const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TEST_SESSION_PREFIX = "test_session_";

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      orders: { some: { stripeSessionId: { startsWith: TEST_SESSION_PREFIX } } },
      orders: { every: { stripeSessionId: { startsWith: TEST_SESSION_PREFIX } } },
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
