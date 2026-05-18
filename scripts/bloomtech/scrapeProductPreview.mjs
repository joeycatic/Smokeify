import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["scripts/bloomtech/scrapeSupplierPreview.mjs", "--mode", "product", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: false,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
