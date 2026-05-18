import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readFlagValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const APPLY = hasFlag("--apply");
const LIMIT = Math.max(1, Number(readFlagValue("--limit") ?? 200));
const ORDER_ID = readFlagValue("--order-id");

const KNOWN_STOREFRONT_HOSTS = {
  MAIN: ["smokeify.de", "www.smokeify.de"],
  GROW: ["growvault.de", "www.growvault.de"],
};

const normalizeEmail = (value) => value?.trim()?.toLowerCase() ?? null;
const normalizeHost = (value) =>
  value?.split(",")[0]?.trim()?.toLowerCase()?.replace(/:\d+$/, "") ?? null;

const parseHostFromUrl = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return normalizeHost(new URL(trimmed).host);
  } catch {
    return normalizeHost(trimmed);
  }
};

const splitConfiguredHosts = (value) =>
  (value ?? "")
    .split(",")
    .map((entry) => parseHostFromUrl(entry))
    .filter(Boolean);

const getConfiguredHostsByStorefront = () => ({
  MAIN: new Set(
    [
      ...KNOWN_STOREFRONT_HOSTS.MAIN,
      parseHostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      parseHostFromUrl(process.env.NEXTAUTH_URL),
      ...splitConfiguredHosts(process.env.MAIN_STOREFRONT_HOSTS),
    ].filter(Boolean),
  ),
  GROW: new Set(
    [
      ...KNOWN_STOREFRONT_HOSTS.GROW,
      parseHostFromUrl(process.env.NEXT_PUBLIC_GROW_APP_URL),
      ...splitConfiguredHosts(process.env.GROW_STOREFRONT_HOSTS),
    ].filter(Boolean),
  ),
});

const resolveStorefrontFromHost = (host) => {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;
  const configuredHosts = getConfiguredHostsByStorefront();
  for (const storefront of ["MAIN", "GROW"]) {
    if (configuredHosts[storefront].has(normalizedHost)) {
      return storefront;
    }
  }
  return null;
};

const loadHistoryStorefronts = async (order) => {
  const email = normalizeEmail(order.customerEmail);
  const history = await prisma.order.findMany({
    where: {
      id: { not: order.id },
      sourceStorefront: { not: null },
      OR: [
        ...(order.userId ? [{ userId: order.userId }] : []),
        ...(email
          ? [{ customerEmail: { equals: email, mode: "insensitive" } }]
          : []),
      ],
    },
    select: { sourceStorefront: true },
    take: 10,
  });

  return Array.from(
    new Set(history.map((entry) => entry.sourceStorefront).filter(Boolean)),
  );
};

const deriveCandidate = async (order) => {
  const hostStorefront = resolveStorefrontFromHost(order.sourceHost);
  if (hostStorefront) {
    return {
      storefront: hostStorefront,
      sourceType: "host",
      detail: `Exact host match ${order.sourceHost}`,
      exact: true,
    };
  }

  const originStorefront = resolveStorefrontFromHost(parseHostFromUrl(order.sourceOrigin));
  if (originStorefront) {
    return {
      storefront: originStorefront,
      sourceType: "origin",
      detail: `Exact origin match ${order.sourceOrigin}`,
      exact: true,
    };
  }

  const historyStorefronts = await loadHistoryStorefronts(order);
  if (historyStorefronts.length === 1) {
    return {
      storefront: historyStorefronts[0],
      sourceType: "customer_history",
      detail: `Unique prior storefront history (${historyStorefronts[0]})`,
      exact: true,
    };
  }

  if (historyStorefronts.length > 1) {
    return {
      storefront: null,
      sourceType: "ambiguous",
      detail: "Customer history spans multiple storefronts.",
      exact: false,
    };
  }

  return {
    storefront: null,
    sourceType: "none",
    detail: "No exact attribution source found.",
    exact: false,
  };
};

const run = async () => {
  const orders = await prisma.order.findMany({
    where: ORDER_ID ? { id: ORDER_ID } : { sourceStorefront: null },
    orderBy: { createdAt: "desc" },
    take: ORDER_ID ? 1 : LIMIT,
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      customerEmail: true,
      sourceHost: true,
      sourceOrigin: true,
      sourceStorefront: true,
      createdAt: true,
    },
  });

  if (orders.length === 0) {
    console.log("[backfill] no matching orders.");
    return;
  }

  const summary = {
    host: 0,
    origin: 0,
    customer_history: 0,
    ambiguous: 0,
    none: 0,
    applied: 0,
    skipped: 0,
  };

  for (const order of orders) {
    const candidate = await deriveCandidate(order);
    summary[candidate.sourceType] += 1;

    if (!candidate.exact || !candidate.storefront) {
      summary.skipped += 1;
      console.log(
        `[skip] order=${order.id} #${order.orderNumber} candidate=${candidate.sourceType} detail=${candidate.detail}`,
      );
      continue;
    }

    if (!APPLY) {
      console.log(
        `[dry-run] order=${order.id} #${order.orderNumber} storefront=${candidate.storefront} source=${candidate.sourceType} detail=${candidate.detail}`,
      );
      continue;
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { sourceStorefront: candidate.storefront },
      }),
      prisma.adminAuditLog.create({
        data: {
          action: "order.attribution.backfill",
          targetType: "order",
          targetId: order.id,
          summary: `Backfilled storefront attribution for order #${order.orderNumber}`,
          metadata: {
            storefront: candidate.storefront,
            sourceType: candidate.sourceType,
            detail: candidate.detail,
          },
        },
      }),
    ]);

    summary.applied += 1;
    console.log(
      `[apply] order=${order.id} #${order.orderNumber} storefront=${candidate.storefront} source=${candidate.sourceType}`,
    );
  }

  console.log(
    `[summary] exact host=${summary.host}, origin=${summary.origin}, unique_history=${summary.customer_history}, ambiguous=${summary.ambiguous}, none=${summary.none}`,
  );
  console.log(
    APPLY
      ? `[done] applied=${summary.applied}, skipped=${summary.skipped}.`
      : "[done] dry-run complete. Re-run with --apply to persist exact matches.",
  );
};

run()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
