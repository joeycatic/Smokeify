import type { Storefront } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorefrontConfigs, type StorefrontCode } from "@/lib/storefronts";

export type AdminPagePreviewStatus = "ready" | "contextual" | "missing-context";

export type AdminPagePreview = {
  id: string;
  group: string;
  title: string;
  description: string;
  storefront: StorefrontCode;
  storefrontLabel: string;
  path: string;
  url: string;
  status: AdminPagePreviewStatus;
  source: string;
  tags: string[];
};

type PreviewContext = {
  latestGuestOrderCode: string | null;
  latestPendingDraftCode: string | null;
};

const DEFAULT_ORIGIN_BY_STOREFRONT: Record<StorefrontCode, string> = {
  MAIN: "https://www.smokeify.de",
  GROW: "https://www.growvault.de",
};

const normalizeOrigin = (value?: string | null) => {
  if (!value?.trim()) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
};

const resolveStorefrontOrigin = (storefront: StorefrontCode) => {
  const config = getStorefrontConfigs().find((entry) => entry.code === storefront);
  const envOrigin = config?.publicOriginEnvKeys
    .map((key) => normalizeOrigin(process.env[key]))
    .find((origin): origin is string => Boolean(origin));
  return envOrigin ?? DEFAULT_ORIGIN_BY_STOREFRONT[storefront];
};

const withSearch = (pathname: string, params?: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
};

const buildAbsolutePreviewUrl = (
  storefront: StorefrontCode,
  pathname: string,
  params?: Record<string, string | null | undefined>,
) => new URL(withSearch(pathname, params), `${resolveStorefrontOrigin(storefront)}/`).toString();

const sourceStorefrontWhere = (storefront: StorefrontCode) =>
  storefront === "MAIN"
    ? { OR: [{ sourceStorefront: "MAIN" as Storefront }, { sourceStorefront: null }] }
    : { sourceStorefront: storefront as Storefront };

async function readLatestGuestOrderCode(storefront: StorefrontCode) {
  try {
    const latestGuestOrder = await prisma.order.findFirst({
      where: {
        ...sourceStorefrontWhere(storefront),
        paymentOrderCode: { not: null },
        userId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { paymentOrderCode: true },
    });

    return latestGuestOrder?.paymentOrderCode ?? null;
  } catch (error) {
    console.warn("Failed to read admin preview order context", { storefront, error });
    return null;
  }
}

async function readLatestPendingDraftCode(storefront: StorefrontCode) {
  try {
    const latestPendingDraft = await prisma.checkoutPaymentDraft.findFirst({
      where: {
        ...sourceStorefrontWhere(storefront),
        paymentStatus: "pending",
        userId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { paymentOrderCode: true },
    });

    return latestPendingDraft?.paymentOrderCode ?? null;
  } catch (error) {
    console.warn("Failed to read admin preview checkout context", { storefront, error });
    return null;
  }
}

async function getPreviewContext(storefront: StorefrontCode): Promise<PreviewContext> {
  const [latestGuestOrderCode, latestPendingDraftCode] = await Promise.all([
    readLatestGuestOrderCode(storefront),
    readLatestPendingDraftCode(storefront),
  ]);

  return {
    latestGuestOrderCode,
    latestPendingDraftCode,
  };
}

const staticPreviewTemplates = [
  {
    id: "cart-empty",
    group: "Checkout",
    title: "Cart shell",
    description: "Cart layout before a customer has a recoverable cart state.",
    path: "/cart",
    source: "Static storefront route",
    tags: ["cart", "empty", "checkout"],
  },
  {
    id: "checkout-start",
    group: "Checkout",
    title: "Checkout address step",
    description: "Shipping/contact form and cart summary with default German country context.",
    path: "/checkout/start",
    params: { country: "DE" },
    source: "Static checkout route",
    tags: ["checkout", "address", "shipping"],
  },
  {
    id: "checkout-payment",
    group: "Checkout",
    title: "Payment continuation",
    description: "Payment-step fallback when browser checkout state is missing or expired.",
    path: "/checkout/payment",
    source: "Static checkout route",
    tags: ["checkout", "payment", "viva"],
  },
  {
    id: "order-failure",
    group: "Orders",
    title: "Order failure",
    description: "Failed or cancelled payment recovery screen.",
    path: "/order/failure",
    params: { order_code: "preview" },
    source: "Static order route",
    tags: ["order", "failure", "payment"],
  },
  {
    id: "signin",
    group: "Auth",
    title: "Sign-in return",
    description: "Login screen with a customer account callback destination.",
    path: "/auth/signin",
    params: { callbackUrl: "/account" },
    source: "Static auth route",
    tags: ["auth", "login"],
  },
  {
    id: "password-reset",
    group: "Auth",
    title: "Password reset token",
    description: "Reset form/error path using an intentionally invalid preview token.",
    path: "/auth/reset",
    params: { token: "preview-token" },
    source: "Static auth route",
    tags: ["auth", "password", "token"],
  },
  {
    id: "verify-token",
    group: "Auth",
    title: "Email verification token",
    description: "Verification flow using an intentionally invalid preview token.",
    path: "/auth/verify",
    params: { token: "preview-token" },
    source: "Static auth route",
    tags: ["auth", "verify", "token"],
  },
  {
    id: "not-found",
    group: "System",
    title: "404 / not found",
    description: "Public missing-page treatment without manually entering a bad URL.",
    path: "/admin-preview-missing-page",
    source: "Intentional missing route",
    tags: ["404", "system"],
  },
  {
    id: "maintenance",
    group: "System",
    title: "Maintenance",
    description: "Public maintenance-mode page.",
    path: "/maintenance",
    source: "Static system route",
    tags: ["maintenance", "system"],
  },
] as const;

const storefrontSpecificTemplates: Record<
  StorefrontCode,
  Array<{
    id: string;
    group: string;
    title: string;
    description: string;
    path: string;
    source: string;
    tags: string[];
  }>
> = {
  MAIN: [
    {
      id: "plant-analysis",
      group: "Tools",
      title: "Plant analysis",
      description: "Public analyzer landing and upload entry state.",
      path: "/pflanzen-analyse",
      source: "Smokeify tool route",
      tags: ["analyzer", "tool"],
    },
    {
      id: "customizer",
      group: "Tools",
      title: "Setup customizer",
      description: "Configurator entry point with its default recommendation state.",
      path: "/customizer",
      source: "Smokeify tool route",
      tags: ["customizer", "setup"],
    },
    {
      id: "bestseller",
      group: "Storefront",
      title: "Bestseller collection",
      description: "Collection surface frequently reached from ads and navigation.",
      path: "/bestseller",
      source: "Smokeify storefront route",
      tags: ["collection", "merchandising"],
    },
  ],
  GROW: [
    {
      id: "plant-analyzer",
      group: "Tools",
      title: "GrowVault plant analyzer",
      description: "GrowVault analyzer landing and upload entry state.",
      path: "/pflanzen-analyzer",
      source: "GrowVault tool route",
      tags: ["analyzer", "growvault"],
    },
    {
      id: "customizer",
      group: "Tools",
      title: "GrowVault setup customizer",
      description: "GrowVault setup configurator entry state.",
      path: "/customizer",
      source: "GrowVault tool route",
      tags: ["customizer", "growvault"],
    },
    {
      id: "wishlist",
      group: "Storefront",
      title: "Wishlist",
      description: "Saved-product state and empty wishlist treatment.",
      path: "/wishlist",
      source: "GrowVault storefront route",
      tags: ["wishlist", "account"],
    },
  ],
};

function previewFromTemplate(
  storefront: StorefrontCode,
  storefrontLabel: string,
  template: (typeof staticPreviewTemplates)[number],
): AdminPagePreview {
  return {
    id: `${storefront}:${template.id}`,
    group: template.group,
    title: template.title,
    description: template.description,
    storefront,
    storefrontLabel,
    path: withSearch(template.path, "params" in template ? template.params : undefined),
    url: buildAbsolutePreviewUrl(
      storefront,
      template.path,
      "params" in template ? template.params : undefined,
    ),
    status: "ready",
    source: template.source,
    tags: [...template.tags],
  };
}

export async function getAdminPagePreviews() {
  const storefronts = getStorefrontConfigs();
  const contexts = Object.fromEntries(
    await Promise.all(
      storefronts.map(async (storefront) => [
        storefront.code,
        await getPreviewContext(storefront.code),
      ]),
    ),
  ) as Record<StorefrontCode, PreviewContext>;

  const previews: AdminPagePreview[] = [];

  for (const storefront of storefronts) {
    const context = contexts[storefront.code];
    previews.push(
      ...staticPreviewTemplates.map((template) =>
        previewFromTemplate(storefront.code, storefront.label, template),
      ),
      ...storefrontSpecificTemplates[storefront.code].map((template) => ({
        id: `${storefront.code}:${template.id}`,
        group: template.group,
        title: template.title,
        description: template.description,
        storefront: storefront.code,
        storefrontLabel: storefront.label,
        path: template.path,
        url: buildAbsolutePreviewUrl(storefront.code, template.path),
        status: "ready" as const,
        source: template.source,
        tags: [...template.tags],
      })),
      {
        id: `${storefront.code}:order-success`,
        group: "Orders",
        title: "Order success",
        description: context.latestGuestOrderCode
          ? "Latest guest order confirmation using a real order code."
          : "Order confirmation route. Add a guest order to enable a direct sample.",
        storefront: storefront.code,
        storefrontLabel: storefront.label,
        path: withSearch("/order/success", {
          order_code: context.latestGuestOrderCode ?? "missing-preview-order",
        }),
        url: buildAbsolutePreviewUrl(storefront.code, "/order/success", {
          order_code: context.latestGuestOrderCode ?? "missing-preview-order",
        }),
        status: context.latestGuestOrderCode ? "ready" : "missing-context",
        source: context.latestGuestOrderCode ? "Latest guest order" : "Missing guest order",
        tags: ["order", "success", "confirmation"],
      },
      {
        id: `${storefront.code}:pending-order-confirmation`,
        group: "Orders",
        title: "Pending payment confirmation",
        description: context.latestPendingDraftCode
          ? "Pending checkout confirmation. Same-origin admin session may be required."
          : "Pending payment route. Add a pending guest checkout draft to enable a sample.",
        storefront: storefront.code,
        storefrontLabel: storefront.label,
        path: withSearch("/order/success", {
          order_code: context.latestPendingDraftCode ?? "missing-pending-draft",
        }),
        url: buildAbsolutePreviewUrl(storefront.code, "/order/success", {
          order_code: context.latestPendingDraftCode ?? "missing-pending-draft",
        }),
        status: context.latestPendingDraftCode ? "contextual" : "missing-context",
        source: context.latestPendingDraftCode
          ? "Latest pending checkout draft"
          : "Missing pending checkout draft",
        tags: ["order", "pending", "viva"],
      },
    );
  }

  return previews.sort((left, right) =>
    left.group.localeCompare(right.group) ||
    left.storefrontLabel.localeCompare(right.storefrontLabel) ||
    left.title.localeCompare(right.title),
  );
}
