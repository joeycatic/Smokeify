export const LOYALTY_POINTS_PER_EUR_FALLBACK = 1;
export const LOYALTY_POINTS_PER_REDEEMABLE_EUR = 100;
export const REDEEMABLE_EUR_PER_100_POINTS = 2;

export const getLoyaltyPointsPerEuro = () => {
  const raw = process.env.LOYALTY_POINTS_PER_EUR?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return LOYALTY_POINTS_PER_EUR_FALLBACK;
  }
  return Math.floor(parsed);
};

export const pointsToDiscountCents = (points: number) =>
  Math.max(
    0,
    Math.floor((Math.max(0, Math.floor(points)) * REDEEMABLE_EUR_PER_100_POINTS * 100) / LOYALTY_POINTS_PER_REDEEMABLE_EUR),
  );

export const discountCentsToPoints = (discountCents: number) =>
  Math.max(
    0,
    Math.floor((Math.max(0, Math.floor(discountCents)) * LOYALTY_POINTS_PER_REDEEMABLE_EUR) / (REDEEMABLE_EUR_PER_100_POINTS * 100)),
  );

export const formatRedeemRateLabel = () =>
  `${LOYALTY_POINTS_PER_REDEEMABLE_EUR} Smokeify Punkte = ${REDEEMABLE_EUR_PER_100_POINTS.toFixed(2).replace(".", ",")} EUR`;

export const buildLoyaltyHoldReason = (sessionId: string) =>
  `loyalty_hold:${sessionId}`;

export const buildLoyaltyRedeemedReason = (sessionId: string) =>
  `loyalty_redeemed:${sessionId}`;

export const buildLoyaltyReleasedReason = (sessionId: string) =>
  `loyalty_released:${sessionId}`;
