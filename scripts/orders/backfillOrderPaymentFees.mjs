import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAYMENT_FEE_BY_METHOD = {
  card: { percentBasisPoints: 150, fixedCents: 25 },
  link: { percentBasisPoints: 150, fixedCents: 25 },
  paypal: { percentBasisPoints: 299, fixedCents: 35 },
  klarna: { percentBasisPoints: 329, fixedCents: 35 },
  amazon_pay: { percentBasisPoints: 299, fixedCents: 35 },
};

const DEFAULT_PAYMENT_FEE = { percentBasisPoints: 150, fixedCents: 25 };
const HIGH_PRICE_SHIPPING_THRESHOLD_CENTS = 10_000;

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readFlagValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const APPLY = hasFlag("--apply");
const LIMIT = Math.max(1, Number(readFlagValue("--limit") ?? 500));
const ORDER_ID = readFlagValue("--order-id");
const ONLY_MISSING = !hasFlag("--all");

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const allocateByWeight = (total, weights) => {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const positiveWeights = weights.map((weight) => Math.max(0, weight));
  const weightSum = positiveWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const allocations = positiveWeights.map((weight) =>
    Math.floor((total * weight) / weightSum)
  );
  let remainder = total - allocations.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (remainder > 0) {
    if (positiveWeights[index] > 0) {
      allocations[index] += 1;
      remainder -= 1;
    }
    index = (index + 1) % allocations.length;
  }
  return allocations;
};

const applyPaymentFeesToCosts = (items, shippingAmount, feeConfig) => {
  if (!items.length) return [];

  const shippingEligibleWeights = items.map((item) =>
    item.unitAmount >= HIGH_PRICE_SHIPPING_THRESHOLD_CENTS ? item.totalAmount : 0
  );
  const shippingShares = allocateByWeight(
    Math.max(0, shippingAmount),
    shippingEligibleWeights
  );

  const percentageFees = items.map((item, index) => {
    const base = Math.max(0, item.totalAmount) + (shippingShares[index] ?? 0);
    return Math.max(
      0,
      Math.round((base * feeConfig.percentBasisPoints) / 10_000)
    );
  });

  const fixedShares = allocateByWeight(
    Math.max(0, feeConfig.fixedCents),
    items.map((item) => Math.max(0, item.totalAmount))
  );

  return items.map((item, index) => {
    const paymentFeeAmount = (percentageFees[index] ?? 0) + (fixedShares[index] ?? 0);
    return {
      ...item,
      paymentFeeAmount,
      adjustedCostAmount: Math.max(0, item.baseCostAmount + paymentFeeAmount),
    };
  });
};

const resolvePaymentMethodForOrder = async (stripe, order) => {
  if (order.paymentMethod) return order.paymentMethod;
  if (!stripe || !order.stripePaymentIntent) return "card";

  try {
    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntent, {
      expand: ["latest_charge"],
    });
    const latestCharge = intent.latest_charge;
    const chargeMethod =
      latestCharge && typeof latestCharge !== "string"
        ? latestCharge.payment_method_details?.type
        : null;
    return chargeMethod ?? intent.payment_method_types?.[0] ?? "card";
  } catch {
    return "card";
  }
};

const run = async () => {
  const stripe = getStripe();
  const orders = await prisma.order.findMany({
    where: ORDER_ID
      ? { id: ORDER_ID }
      : ONLY_MISSING
        ? {
            OR: [
              { paymentMethod: null },
              {
                items: {
                  some: {
                    OR: [{ adjustedCostAmount: 0 }, { paymentFeeAmount: 0 }],
                  },
                },
              },
            ],
          }
        : undefined,
    orderBy: { createdAt: "asc" },
    take: ORDER_ID ? 1 : LIMIT,
    include: {
      items: {
        select: {
          id: true,
          quantity: true,
          unitAmount: true,
          totalAmount: true,
          variantId: true,
          baseCostAmount: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    console.log("[backfill] no matching orders.");
    return;
  }

  let updatedOrders = 0;
  let updatedItems = 0;

  for (const order of orders) {
    const paymentMethod = await resolvePaymentMethodForOrder(stripe, order);
    const feeConfig = PAYMENT_FEE_BY_METHOD[paymentMethod] ?? DEFAULT_PAYMENT_FEE;
    const variantIds = Array.from(
      new Set(order.items.map((item) => item.variantId).filter(Boolean))
    );
    const variants = await prisma.variant.findMany({
      where: variantIds.length ? { id: { in: variantIds } } : { id: "__none__" },
      select: { id: true, costCents: true },
    });
    const costByVariant = new Map(variants.map((variant) => [variant.id, variant.costCents]));

    const drafts = order.items.map((item) => {
      const variantCost = item.variantId ? costByVariant.get(item.variantId) : null;
      const baseCostAmount =
        typeof variantCost === "number"
          ? Math.max(0, variantCost) * Math.max(0, item.quantity)
          : Math.max(0, item.baseCostAmount ?? 0);
      return {
        id: item.id,
        quantity: Math.max(0, item.quantity),
        unitAmount: Math.max(0, item.unitAmount),
        totalAmount: Math.max(0, item.totalAmount),
        baseCostAmount,
      };
    });

    const withFees = applyPaymentFeesToCosts(
      drafts,
      Math.max(0, order.amountShipping),
      feeConfig
    );

    if (!APPLY) {
      const feeSum = withFees.reduce((sum, item) => sum + item.paymentFeeAmount, 0);
      console.log(
        `[dry-run] order=${order.id} method=${paymentMethod} items=${withFees.length} feeTotal=${feeSum}`
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentMethod },
      });

      for (const item of withFees) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            baseCostAmount: item.baseCostAmount,
            paymentFeeAmount: item.paymentFeeAmount,
            adjustedCostAmount: item.adjustedCostAmount,
          },
        });
      }
    });

    updatedOrders += 1;
    updatedItems += withFees.length;
    console.log(
      `[apply] order=${order.id} method=${paymentMethod} updatedItems=${withFees.length}`
    );
  }

  if (APPLY) {
    console.log(
      `[done] updated orders=${updatedOrders}, updated items=${updatedItems}`
    );
  } else {
    console.log("[done] dry-run complete. Use --apply to persist changes.");
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
