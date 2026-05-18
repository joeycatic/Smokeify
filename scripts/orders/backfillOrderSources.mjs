import Stripe from "stripe";
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
const ONLY_MISSING = !hasFlag("--all");
const RAW_FALLBACK_STOREFRONT = readFlagValue("--fallback-storefront");

const normalizeHost = (value) =>
  value?.split(",")[0]?.trim()?.toLowerCase()?.replace(/:\d+$/, "") ?? null;

const sanitizeOrigin = (value) => {
  const trimmed = value?.split(",")[0]?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

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
      parseHostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      parseHostFromUrl(process.env.NEXTAUTH_URL),
      ...splitConfiguredHosts(process.env.MAIN_STOREFRONT_HOSTS),
    ].filter(Boolean),
  ),
  GROW: new Set(
    [
      parseHostFromUrl(process.env.NEXT_PUBLIC_GROW_APP_URL),
      ...splitConfiguredHosts(process.env.GROW_STOREFRONT_HOSTS),
    ].filter(Boolean),
  ),
});

const resolveStorefrontFromHost = (host) => {
  if (!host) return null;
  const configuredHosts = getConfiguredHostsByStorefront();
  for (const storefront of ["MAIN", "GROW"]) {
    if (configuredHosts[storefront].has(host)) {
      return storefront;
    }
  }
  return null;
};

const parseStorefront = (value) => {
  const normalized = value?.trim()?.toUpperCase();
  return normalized === "MAIN" || normalized === "GROW" ? normalized : null;
};

const FALLBACK_STOREFRONT = parseStorefront(RAW_FALLBACK_STOREFRONT);

const pickFirst = (values) => values.find(Boolean) ?? null;

const resolveSource = ({
  sourceStorefront,
  sourceHost,
  sourceOrigin,
  fallbackUrls = [],
}) => {
  const fallbackOrigin = pickFirst(fallbackUrls.map((value) => sanitizeOrigin(value)));
  const fallbackHost = pickFirst(fallbackUrls.map((value) => parseHostFromUrl(value)));
  const normalizedOrigin = sanitizeOrigin(sourceOrigin) ?? fallbackOrigin;
  const normalizedHost =
    normalizeHost(sourceHost) ?? parseHostFromUrl(normalizedOrigin) ?? fallbackHost;
  const explicitStorefront = parseStorefront(sourceStorefront);

  return {
    sourceStorefront: explicitStorefront ?? resolveStorefrontFromHost(normalizedHost),
    sourceHost: normalizedHost,
    sourceOrigin: normalizedOrigin,
  };
};

const getConfiguredOriginForStorefront = (storefront) => {
  if (storefront === "GROW") {
    return sanitizeOrigin(process.env.NEXT_PUBLIC_GROW_APP_URL) ?? null;
  }
  return (
    sanitizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    sanitizeOrigin(process.env.NEXTAUTH_URL) ??
    null
  );
};

const getConfiguredHostForStorefront = (storefront) => {
  const configuredHosts = getConfiguredHostsByStorefront();
  const [firstHost] = Array.from(configuredHosts[storefront] ?? []);
  return firstHost ?? parseHostFromUrl(getConfiguredOriginForStorefront(storefront));
};

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is required for order source backfill.");
  }
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const isImprovement = (current, next) =>
  (next.sourceStorefront && next.sourceStorefront !== current.sourceStorefront) ||
  (next.sourceHost && next.sourceHost !== current.sourceHost) ||
  (next.sourceOrigin && next.sourceOrigin !== current.sourceOrigin);

const run = async () => {
  const stripe = getStripe();
  const orders = await prisma.order.findMany({
    where: ORDER_ID
      ? { id: ORDER_ID }
      : ONLY_MISSING
        ? {
            OR: [
              { sourceStorefront: null },
              { sourceHost: null },
              { sourceOrigin: null },
            ],
          }
        : undefined,
    orderBy: { createdAt: "asc" },
    take: ORDER_ID ? 1 : LIMIT,
    select: {
      id: true,
      stripeSessionId: true,
      sourceStorefront: true,
      sourceHost: true,
      sourceOrigin: true,
      createdAt: true,
    },
  });

  if (orders.length === 0) {
    console.log("[backfill] no matching orders.");
    return;
  }

  let updatedOrders = 0;
  let skippedOrders = 0;

  for (const order of orders) {
    const current = resolveSource({
      sourceStorefront: order.sourceStorefront,
      sourceHost: order.sourceHost,
      sourceOrigin: order.sourceOrigin,
    });

    let candidate = current;

    if (
      (!candidate.sourceStorefront || !candidate.sourceHost || !candidate.sourceOrigin) &&
      order.stripeSessionId
    ) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        candidate = resolveSource({
          sourceStorefront: session.metadata?.sourceStorefront ?? current.sourceStorefront,
          sourceHost: session.metadata?.sourceHost ?? current.sourceHost,
          sourceOrigin: session.metadata?.sourceOrigin ?? current.sourceOrigin,
          fallbackUrls: [
            session.success_url,
            session.cancel_url,
            session.return_url,
            session.url,
          ],
        });
      } catch (error) {
        console.warn(
          `[backfill] unable to retrieve Stripe session for order=${order.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (
      (!candidate.sourceStorefront || !candidate.sourceHost || !candidate.sourceOrigin) &&
      FALLBACK_STOREFRONT &&
      order.stripeSessionId?.startsWith("test_session_")
    ) {
      candidate = {
        sourceStorefront: candidate.sourceStorefront ?? FALLBACK_STOREFRONT,
        sourceHost: candidate.sourceHost ?? getConfiguredHostForStorefront(FALLBACK_STOREFRONT),
        sourceOrigin:
          candidate.sourceOrigin ?? getConfiguredOriginForStorefront(FALLBACK_STOREFRONT),
      };
    }

    if (!isImprovement(current, candidate)) {
      skippedOrders += 1;
      continue;
    }

    if (!APPLY) {
      console.log(
        `[dry-run] order=${order.id} storefront=${current.sourceStorefront ?? "null"}=>${candidate.sourceStorefront ?? "null"} host=${current.sourceHost ?? "null"}=>${candidate.sourceHost ?? "null"} origin=${current.sourceOrigin ?? "null"}=>${candidate.sourceOrigin ?? "null"}`,
      );
      continue;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        sourceStorefront: candidate.sourceStorefront ?? undefined,
        sourceHost: candidate.sourceHost ?? undefined,
        sourceOrigin: candidate.sourceOrigin ?? undefined,
      },
    });

    updatedOrders += 1;
    console.log(
      `[apply] order=${order.id} storefront=${candidate.sourceStorefront ?? "null"} host=${candidate.sourceHost ?? "null"}`,
    );
  }

  if (APPLY) {
    console.log(
      `[done] updated orders=${updatedOrders}, skipped orders=${skippedOrders}.`,
    );
  } else {
    console.log(
      `[done] dry-run complete. Review output and re-run with --apply to persist changes.`,
    );
  }
};

run()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
