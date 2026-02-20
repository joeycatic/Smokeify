import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OLD_HANDLE = "hash-bowl";
const NEW_HANDLE = "kraeuterschale";
const NEW_NAME = "Kräuterschale";

const run = async () => {
  const existingNew = await prisma.category.findUnique({
    where: { handle: NEW_HANDLE },
    select: { id: true, name: true, handle: true },
  });

  if (existingNew) {
    console.log(
      `[rename] Skipped: target handle already exists (id=${existingNew.id}, name=${existingNew.name}, handle=${existingNew.handle}).`
    );
    return;
  }

  const existingOld = await prisma.category.findUnique({
    where: { handle: OLD_HANDLE },
    select: { id: true, name: true, handle: true },
  });

  if (!existingOld) {
    console.log(`[rename] Skipped: source handle '${OLD_HANDLE}' not found.`);
    return;
  }

  const updated = await prisma.category.update({
    where: { id: existingOld.id },
    data: {
      handle: NEW_HANDLE,
      name: NEW_NAME,
    },
    select: { id: true, name: true, handle: true },
  });

  console.log(
    `[rename] Updated category id=${updated.id} -> name='${updated.name}', handle='${updated.handle}'.`
  );
};

run()
  .catch((error) => {
    console.error("[rename] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
