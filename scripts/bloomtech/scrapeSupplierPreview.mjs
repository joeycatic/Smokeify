#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import {
  parseArgs,
  runBloomtechSupplierPreview,
} from "../../src/lib/bloomtech/scrapeSupplierPreview.mjs";

export { parseArgs, runBloomtechSupplierPreview };

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runBloomtechSupplierPreview(parseArgs()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
