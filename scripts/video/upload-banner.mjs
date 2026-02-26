/**
 * Upload rendered hero banner video to Vercel Blob.
 *
 * Usage:
 *   node scripts/video/upload-banner.mjs
 *
 * Render first:
 *   cd remotion && npm run render:banner && npm run render:banner:webm
 */

import { put } from "@vercel/blob";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

config({ path: resolve(root, ".env") });

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("❌  BLOB_READ_WRITE_TOKEN not found in .env");
  process.exit(1);
}

const FILES = [
  { path: "remotion/out/banner.mp4",  blobName: "videos/banner.mp4",  type: "video/mp4"  },
  { path: "remotion/out/banner.webm", blobName: "videos/banner.webm", type: "video/webm" },
];

for (const file of FILES) {
  const fullPath = resolve(root, file.path);

  if (!existsSync(fullPath)) {
    console.warn(`⚠️  Skipping ${file.path} — file not found. Did you run the render?`);
    continue;
  }

  const buffer = readFileSync(fullPath);
  const bytes = (buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`⬆️  Uploading ${file.path} (${bytes} MB)...`);

  const blob = await put(file.blobName, buffer, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`✅  ${file.blobName}`);
  console.log(`    ${blob.url}\n`);
}

console.log("Done.");
