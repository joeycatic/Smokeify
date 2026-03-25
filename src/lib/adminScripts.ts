export type AdminScriptRiskLevel = "read-only" | "write";

export type AdminScriptCategory = "Suppliers" | "Catalog" | "Orders";

export type AdminScriptDefinition = {
  id: string;
  npmScript: string;
  title: string;
  category: AdminScriptCategory;
  description: string;
  impact: string;
  expectedDuration: string;
  riskLevel: AdminScriptRiskLevel;
  dryRunByDefault: boolean;
  timeoutMs: number;
  safetyNote: string;
};

export const ADMIN_SCRIPT_DEFINITIONS: readonly AdminScriptDefinition[] = [
  {
    id: "suppliers:sync-stock",
    npmScript: "suppliers:sync-stock",
    title: "Sync supplier stock",
    category: "Suppliers",
    description:
      "Pull the latest supplier availability and update local inventory quantities for tracked products.",
    impact: "Writes inventory and stock availability data.",
    expectedDuration: "2-10 minutes",
    riskLevel: "write",
    dryRunByDefault: false,
    timeoutMs: 10 * 60 * 1000,
    safetyNote: "Run deliberately. This updates sellable stock data immediately.",
  },
  {
    id: "bloomtech:scrape-preview",
    npmScript: "bloomtech:scrape-preview",
    title: "Bloomtech scrape preview",
    category: "Suppliers",
    description:
      "Fetch the latest Bloomtech supplier catalog into the local preview JSON without importing it.",
    impact: "Refreshes preview files only.",
    expectedDuration: "1-5 minutes",
    riskLevel: "read-only",
    dryRunByDefault: true,
    timeoutMs: 8 * 60 * 1000,
    safetyNote: "Safe for inspection. Review the preview before any import or override run.",
  },
  {
    id: "bloomtech:import-preview",
    npmScript: "bloomtech:import-preview",
    title: "Bloomtech import preview",
    category: "Suppliers",
    description:
      "Import the prepared Bloomtech preview into the catalog and refresh matching product data.",
    impact: "Writes supplier-linked catalog records.",
    expectedDuration: "2-8 minutes",
    riskLevel: "write",
    dryRunByDefault: false,
    timeoutMs: 10 * 60 * 1000,
    safetyNote: "Use only after validating the preview file. This changes live catalog data.",
  },
  {
    id: "bloomtech:report-missing-costs",
    npmScript: "bloomtech:report-missing-costs",
    title: "Bloomtech missing costs report",
    category: "Suppliers",
    description:
      "Report Bloomtech variants that still have missing or invalid cost data.",
    impact: "Produces a diagnostic report only.",
    expectedDuration: "30-90 seconds",
    riskLevel: "read-only",
    dryRunByDefault: true,
    timeoutMs: 3 * 60 * 1000,
    safetyNote: "Use before pricing overrides to catch incomplete supplier cost coverage.",
  },
  {
    id: "b2b-headshop:scrape-preview",
    npmScript: "b2b-headshop:scrape-preview",
    title: "B2B Headshop scrape preview",
    category: "Suppliers",
    description:
      "Fetch the latest B2B Headshop supplier catalog into the local preview JSON without importing it.",
    impact: "Refreshes preview files only.",
    expectedDuration: "1-5 minutes",
    riskLevel: "read-only",
    dryRunByDefault: true,
    timeoutMs: 8 * 60 * 1000,
    safetyNote: "Safe for inspection. Use this before any B2B Headshop override run.",
  },
  {
    id: "b2b-headshop:report-missing-costs",
    npmScript: "b2b-headshop:report-missing-costs",
    title: "B2B Headshop missing costs report",
    category: "Suppliers",
    description:
      "Report B2B Headshop variants that still have missing or invalid cost data.",
    impact: "Produces a diagnostic report only.",
    expectedDuration: "30-90 seconds",
    riskLevel: "read-only",
    dryRunByDefault: true,
    timeoutMs: 3 * 60 * 1000,
    safetyNote: "Use before pricing overrides to catch incomplete cost data.",
  },
  {
    id: "catalog:update-bestseller-scores",
    npmScript: "catalog:update-bestseller-scores",
    title: "Update bestseller scores",
    category: "Catalog",
    description:
      "Recompute bestseller scoring used by catalog merchandising and ranking surfaces.",
    impact: "Writes derived catalog ranking fields.",
    expectedDuration: "30-120 seconds",
    riskLevel: "write",
    dryRunByDefault: false,
    timeoutMs: 4 * 60 * 1000,
    safetyNote: "Safe when merchandising data needs a refresh. No checkout data is changed.",
  },
  {
    id: "orders:backfill-payment-fees",
    npmScript: "orders:backfill-payment-fees",
    title: "Backfill payment fees",
    category: "Orders",
    description:
      "Backfill Stripe payment fee data for historical orders that are missing reconciliation details.",
    impact: "Writes historical order finance fields.",
    expectedDuration: "1-6 minutes",
    riskLevel: "write",
    dryRunByDefault: false,
    timeoutMs: 8 * 60 * 1000,
    safetyNote: "Run when finance data is incomplete. This updates historical order records.",
  },
] as const;

export function getAdminScriptDefinition(scriptId: string) {
  return ADMIN_SCRIPT_DEFINITIONS.find((definition) => definition.id === scriptId) ?? null;
}
