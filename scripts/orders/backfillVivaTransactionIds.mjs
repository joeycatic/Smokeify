import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (name, fallback = undefined) => {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const APPLY =
  hasFlag("--apply") && process.env.BACKFILL_VIVA_TRANSACTION_IDS_ALLOW_WRITE === "1";
const LIMIT = Math.max(1, Number.parseInt(readArg("--limit", "50"), 10) || 50);
const ORDER_ID = readArg("--order-id", "");
const ORDER_NUMBER = readArg("--order-number", "");

const getEnvironment = () =>
  process.env.VIVA_ENVIRONMENT === "production" ? "production" : "demo";

const getEndpoints = () =>
  getEnvironment() === "production"
    ? { checkoutBaseUrl: "https://www.vivapayments.com" }
    : { checkoutBaseUrl: "https://demo.vivapayments.com" };

const getEnvValue = (name) => process.env[name]?.trim() || undefined;

const getVivaScopedEnvName = (name) =>
  getEnvironment() === "production" ? `VIVA_PRODUCTION_${name}` : `VIVA_DEMO_${name}`;

const readRequiredVivaEnv = (name) => {
  const scopedName = getVivaScopedEnvName(name);
  const legacyName = `VIVA_${name}`;
  const value = getEnvValue(scopedName) ?? getEnvValue(legacyName);
  if (!value) {
    throw new Error(`${scopedName} or ${legacyName} is not configured.`);
  }
  return value;
};

const normalizeTransaction = (transaction) => {
  if (!transaction || typeof transaction !== "object") return null;
  return {
    amount: transaction.amount ?? transaction.Amount,
    orderCode: transaction.orderCode ?? transaction.OrderCode ?? null,
    statusId: transaction.statusId ?? transaction.StatusId ?? null,
    transactionId:
      transaction.transactionId ??
      transaction.TransactionId ??
      transaction.id ??
      transaction.Id ??
      null,
  };
};

const getTransactionsFromResponse = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.transactions ?? data.Transactions ?? data.data ?? data.Data ?? [];
};

const isPaidStatus = (statusId) => ["F", "C"].includes(String(statusId ?? "").toUpperCase());

const orderCodeMatches = (returnedOrderCode, expectedOrderCode) => {
  const normalized = String(returnedOrderCode ?? "").trim();
  if (!normalized) return true;
  if (normalized === expectedOrderCode) return true;
  return normalized.length >= 10 && expectedOrderCode.startsWith(normalized);
};

const amountMatches = (transactionAmount, expectedMinorUnits) => {
  if (typeof transactionAmount !== "number" || !Number.isFinite(transactionAmount)) {
    return false;
  }
  const absoluteAmount = Math.abs(transactionAmount);
  return (
    Math.round(absoluteAmount) === expectedMinorUnits ||
    Math.round(absoluteAmount * 100) === expectedMinorUnits
  );
};

const retrieveVivaTransactionByOrderCode = async (orderCode) => {
  const merchantId = readRequiredVivaEnv("MERCHANT_ID");
  const apiKey = readRequiredVivaEnv("API_KEY");
  const credentials = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
  const url = new URL("/api/transactions/", getEndpoints().checkoutBaseUrl);
  url.searchParams.set("ordercode", orderCode);

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data?.ErrorText ??
      data?.Message ??
      data?.message ??
      data?.error_description ??
      data?.error ??
      response.statusText;
    throw new Error(
      `Viva transaction lookup by order code failed (${response.status}${detail ? `: ${detail}` : ""}).`,
    );
  }

  const transactions = getTransactionsFromResponse(data)
    .map((transaction) => normalizeTransaction(transaction))
    .filter((transaction) => Boolean(transaction?.transactionId));

  const paidExactMatch = transactions.find(
    (transaction) =>
      String(transaction.orderCode ?? "").trim() === orderCode &&
      isPaidStatus(transaction.statusId),
  );
  const exactMatch = transactions.find(
    (transaction) => String(transaction.orderCode ?? "").trim() === orderCode,
  );
  const paidMatch = transactions.find((transaction) => isPaidStatus(transaction.statusId));
  return paidExactMatch ?? exactMatch ?? paidMatch ?? transactions[0] ?? null;
};

const formatOrderLabel = (order) => `#${order.orderNumber} ${order.id}`;

const buildWhere = () => {
  const base = {
    paymentProvider: "viva",
    paymentTransactionId: null,
    paymentOrderCode: { not: null },
    paymentStatus: { in: ["paid", "succeeded", "partially_refunded"] },
  };
  if (ORDER_ID) return { ...base, id: ORDER_ID };
  if (ORDER_NUMBER) return { ...base, orderNumber: Number(ORDER_NUMBER) };
  return base;
};

const main = async () => {
  if (hasFlag("--apply") && !APPLY) {
    console.log(
      "[viva-backfill] --apply was provided, but BACKFILL_VIVA_TRANSACTION_IDS_ALLOW_WRITE is not set to 1. Running dry-run.",
    );
  }

  console.log(
    `[viva-backfill] mode=${APPLY ? "apply" : "dry-run"} env=${getEnvironment()} limit=${LIMIT}`,
  );

  const orders = await prisma.order.findMany({
    where: buildWhere(),
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      orderNumber: true,
      amountTotal: true,
      paymentOrderCode: true,
      paymentStatus: true,
    },
  });

  if (orders.length === 0) {
    console.log("[viva-backfill] no eligible orders found.");
    return;
  }

  const summary = {
    inspected: 0,
    recovered: 0,
    skipped: 0,
    conflicts: 0,
    errors: 0,
  };

  for (const order of orders) {
    summary.inspected += 1;
    const paymentOrderCode = order.paymentOrderCode;
    if (!paymentOrderCode) {
      summary.skipped += 1;
      console.log(`[skip] ${formatOrderLabel(order)} missing paymentOrderCode`);
      continue;
    }

    try {
      const transaction = await retrieveVivaTransactionByOrderCode(paymentOrderCode);
      const transactionId = transaction?.transactionId?.trim();
      const valid =
        transactionId &&
        isPaidStatus(transaction.statusId) &&
        orderCodeMatches(transaction.orderCode, paymentOrderCode) &&
        amountMatches(transaction.amount, order.amountTotal);

      if (!valid) {
        summary.skipped += 1;
        console.log(
          `[skip] ${formatOrderLabel(order)} orderCode=${paymentOrderCode} reason=no-valid-paid-amount-match status=${transaction?.statusId ?? "-"} amount=${transaction?.amount ?? "-"}`,
        );
        continue;
      }

      const existing = await prisma.order.findUnique({
        where: { paymentTransactionId: transactionId },
        select: { id: true, orderNumber: true },
      });
      if (existing && existing.id !== order.id) {
        summary.conflicts += 1;
        console.log(
          `[conflict] ${formatOrderLabel(order)} transactionId=${transactionId} already linked to #${existing.orderNumber} ${existing.id}`,
        );
        continue;
      }

      if (APPLY) {
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: { paymentTransactionId: transactionId },
          }),
          prisma.checkoutPaymentDraft.updateMany({
            where: {
              paymentOrderCode,
              paymentTransactionId: null,
            },
            data: { paymentTransactionId: transactionId },
          }),
        ]);
      }

      summary.recovered += 1;
      console.log(
        `[${APPLY ? "updated" : "dry-run"}] ${formatOrderLabel(order)} orderCode=${paymentOrderCode} transactionId=${transactionId}`,
      );
    } catch (error) {
      summary.errors += 1;
      console.log(
        `[error] ${formatOrderLabel(order)} orderCode=${paymentOrderCode} ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.log(
    `[viva-backfill] done inspected=${summary.inspected} recovered=${summary.recovered} skipped=${summary.skipped} conflicts=${summary.conflicts} errors=${summary.errors} mode=${APPLY ? "apply" : "dry-run"}`,
  );
  if (!APPLY) {
    console.log(
      "[viva-backfill] To write: BACKFILL_VIVA_TRANSACTION_IDS_ALLOW_WRITE=1 npm run orders:backfill-viva-transaction-ids -- --apply",
    );
  }
};

main()
  .catch((error) => {
    console.error("[viva-backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
