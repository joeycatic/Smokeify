import {
  Storefront,
  type ExpenseStorefrontAllocation,
  type RecurringExpenseStorefrontAllocation,
} from "@prisma/client";
import { STOREFRONTS, type StorefrontCode } from "@/lib/storefronts";

export type StorefrontAllocationInput = {
  storefront: StorefrontCode;
  percent: number;
};

export type StorefrontAllocationSummary = {
  allocations: StorefrontAllocationInput[];
  totalPercent: number;
  isFullyAllocated: boolean;
  missingPercent: number;
};

const storefrontSet = new Set<string>(STOREFRONTS);

export function normalizeStorefrontAllocations(value: unknown):
  | { ok: true; allocations: StorefrontAllocationInput[] }
  | { ok: false; error: string } {
  if (typeof value === "undefined") {
    return { ok: true, allocations: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: "Allocations must be an array." };
  }

  const seen = new Set<string>();
  const allocations: StorefrontAllocationInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "Each allocation must be an object." };
    }

    const record = entry as Record<string, unknown>;
    const storefront =
      typeof record.storefront === "string"
        ? record.storefront.trim().toUpperCase()
        : "";
    const percentValue = record.percent;
    const percent =
      typeof percentValue === "number"
        ? percentValue
        : typeof percentValue === "string" && percentValue.trim()
          ? Number(percentValue)
          : Number.NaN;

    if (!storefrontSet.has(storefront)) {
      return { ok: false, error: "Allocation storefront is invalid." };
    }
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      return { ok: false, error: "Allocation percentages must be integers between 0 and 100." };
    }
    if (seen.has(storefront)) {
      return { ok: false, error: "Duplicate storefront allocations are not allowed." };
    }

    seen.add(storefront);
    allocations.push({
      storefront: storefront as StorefrontCode,
      percent,
    });
  }

  const totalPercent = allocations.reduce((sum, allocation) => sum + allocation.percent, 0);
  if (allocations.length > 0 && totalPercent !== 100) {
    return { ok: false, error: "Allocation percentages must total 100." };
  }

  return { ok: true, allocations };
}

export function summarizeStorefrontAllocations(
  allocations: Array<
    | StorefrontAllocationInput
    | ExpenseStorefrontAllocation
    | RecurringExpenseStorefrontAllocation
    | { storefront: string; percent: number }
  >,
): StorefrontAllocationSummary {
  const normalized = allocations.map((allocation) => ({
    storefront: allocation.storefront as StorefrontCode,
    percent: allocation.percent,
  }));
  const totalPercent = normalized.reduce((sum, allocation) => sum + allocation.percent, 0);
  return {
    allocations: normalized,
    totalPercent,
    isFullyAllocated: normalized.length > 0 && totalPercent === 100,
    missingPercent: Math.max(0, 100 - totalPercent),
  };
}

export function buildAllocationUpsertData(
  allocations: StorefrontAllocationInput[],
): Array<{ storefront: Storefront; percent: number }> {
  return allocations.map((allocation) => ({
    storefront: allocation.storefront as Storefront,
    percent: allocation.percent,
  }));
}

export function getAllocatedAmountCents(
  amountCents: number,
  allocations: StorefrontAllocationInput[],
  storefront: StorefrontCode,
) {
  const allocation = allocations.find((entry) => entry.storefront === storefront);
  if (!allocation) return 0;
  return Math.round((amountCents * allocation.percent) / 100);
}
