import { PrismaClient } from "@prisma/client";
import { runSupplierSync } from "../../src/lib/supplierStockSync.mjs";

const prisma = new PrismaClient();

const isDryRun = process.argv.includes("--dry-run");

runSupplierSync({ prisma, isDryRun })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
