/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { put } = require("@vercel/blob");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const uploadsDir = path.join(process.cwd(), "public", "uploads");
const maxPerRun = Number(process.env.MIGRATE_MAX || 40);

async function main() {
  if (!fs.existsSync(uploadsDir)) {
    throw new Error(`uploads dir not found: ${uploadsDir}`);
  }

  const images = await prisma.productImage.findMany({
    where: { url: { startsWith: "/uploads/" } },
    select: { id: true, url: true },
    take: maxPerRun,
  });

  if (images.length === 0) {
    console.log("No /uploads/ images found.");
    return;
  }

  let updated = 0;
  let missing = 0;

  for (const image of images) {
    const filename = image.url.replace(/^\/uploads\//, "");
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      missing++;
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: undefined,
    });

    await prisma.productImage.update({
      where: { id: image.id },
      data: { url: blob.url },
    });

    updated++;
  }

  console.log(`Updated: ${updated}, missing files: ${missing}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
