import "server-only";

import type { StorefrontCode } from "@/lib/storefronts";
import { getStorefrontOrigin } from "@/lib/storefrontEmailBrand";
import { sendTelegramMessage } from "@/lib/telegram";

type GrowvaultReviewNotificationInput = {
  storefront: StorefrontCode | null;
  fallbackOrigin?: string | null;
  product: {
    title: string;
    handle: string;
  };
  review: {
    rating: number;
    title?: string | null;
    body?: string | null;
    guestName?: string | null;
    createdAt: Date;
  };
  reviewer?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

const REVIEW_TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const formatReviewerLabel = ({
  guestName,
  reviewer,
}: {
  guestName?: string | null;
  reviewer?: GrowvaultReviewNotificationInput["reviewer"];
}) => {
  const name = guestName?.trim() || reviewer?.name?.trim() || reviewer?.email?.trim();
  return name || "Anonym";
};

export function buildGrowvaultReviewTelegramMessage(
  input: GrowvaultReviewNotificationInput,
) {
  if (input.storefront !== "GROW") {
    return null;
  }

  const reviewUrl = new URL(
    `/products/${input.product.handle}`,
    getStorefrontOrigin("GROW", input.fallbackOrigin),
  ).toString();

  const lines = [
    "New GrowVault review",
    "",
    `Product: ${input.product.title}`,
    `Rating: ${"★".repeat(input.review.rating)}${"☆".repeat(Math.max(0, 5 - input.review.rating))} (${input.review.rating}/5)`,
    `Reviewer: ${formatReviewerLabel({
      guestName: input.review.guestName,
      reviewer: input.reviewer,
    })}`,
    `Time: ${REVIEW_TIME_FORMATTER.format(input.review.createdAt)}`,
  ];

  if (input.review.title?.trim()) {
    lines.push(`Title: ${input.review.title.trim()}`);
  }

  if (input.review.body?.trim()) {
    lines.push("", input.review.body.trim());
  }

  lines.push("", reviewUrl);

  return lines.join("\n");
}

export async function notifyGrowvaultReviewCreated(
  input: GrowvaultReviewNotificationInput,
) {
  const text = buildGrowvaultReviewTelegramMessage(input);
  if (!text) {
    return { ok: false, status: 0, skipped: true as const };
  }

  return sendTelegramMessage({ text });
}
