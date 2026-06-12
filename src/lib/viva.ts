type VivaEnvironment = "demo" | "production";

export type VivaCustomer = {
  countryCode?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  requestLang?: string;
};

export type VivaOrderRequest = {
  amount: number;
  customer?: VivaCustomer;
  customerTrns: string;
  merchantTrns?: string;
  paymentTimeout?: number;
  sourceCode?: string;
  tags?: string[];
};

export type VivaOrderResponse = {
  orderCode: string;
};

export type VivaTransaction = {
  amount?: number;
  cardNumber?: string | null;
  currencyCode?: number | string | null;
  customerTrns?: string | null;
  email?: string | null;
  fullName?: string | null;
  merchantTrns?: string | null;
  orderCode?: string | number | null;
  statusId?: string | null;
  transactionId?: string | null;
};

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

const getEnvironment = (): VivaEnvironment =>
  process.env.VIVA_ENVIRONMENT === "production" ? "production" : "demo";

const getEndpoints = (environment = getEnvironment()) =>
  environment === "production"
    ? {
        accountsBaseUrl: "https://accounts.vivapayments.com",
        apiBaseUrl: "https://api.vivapayments.com",
        checkoutBaseUrl: "https://www.vivapayments.com",
      }
    : {
        accountsBaseUrl: "https://demo-accounts.vivapayments.com",
        apiBaseUrl: "https://demo-api.vivapayments.com",
        checkoutBaseUrl: "https://demo.vivapayments.com",
      };

const readRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
};

export const getVivaSourceCode = () => readRequiredEnv("VIVA_SOURCE_CODE");

export const getVivaCheckoutUrl = (orderCode: string) => {
  const { checkoutBaseUrl } = getEndpoints();
  const url = new URL("/web/checkout", checkoutBaseUrl);
  url.searchParams.set("ref", orderCode);
  return url.toString();
};

export const getVivaAccessToken = async () => {
  const environment = getEnvironment();
  const clientId = readRequiredEnv("VIVA_CLIENT_ID");
  const clientSecret = readRequiredEnv("VIVA_CLIENT_SECRET");
  const cacheKey = `${environment}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.accessToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getEndpoints(environment).accountsBaseUrl}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        error?: string;
        error_description?: string;
        expires_in?: number;
      }
    | null;

  if (!response.ok || !data?.access_token) {
    if (data?.error === "invalid_client") {
      throw new Error(
        `Viva credentials were rejected for VIVA_ENVIRONMENT=${environment}. Check VIVA_CLIENT_ID and VIVA_CLIENT_SECRET for that environment.`,
      );
    }
    throw new Error(data?.error_description ?? data?.error ?? "Viva access token request failed.");
  }

  tokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 300) * 1000,
  });
  return data.access_token;
};

export const createVivaPaymentOrder = async (payload: VivaOrderRequest) => {
  const token = await getVivaAccessToken();
  const response = await fetch(`${getEndpoints().apiBaseUrl}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; orderCode?: number | string }
    | null;
  if (!response.ok || !data?.orderCode) {
    throw new Error(data?.message ?? data?.error ?? "Viva order creation failed.");
  }
  return { orderCode: String(data.orderCode) } satisfies VivaOrderResponse;
};

export const retrieveVivaTransaction = async (transactionId: string) => {
  const token = await getVivaAccessToken();
  const response = await fetch(
    `${getEndpoints().apiBaseUrl}/checkout/v2/transactions/${encodeURIComponent(transactionId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  const data = (await response.json().catch(() => null)) as VivaTransaction | null;
  if (!response.ok || !data) {
    throw new Error("Viva transaction lookup failed.");
  }
  return data;
};

export const refundVivaTransaction = async ({
  amount,
  sourceCode,
  transactionId,
}: {
  amount: number;
  sourceCode?: string;
  transactionId: string;
}) => {
  const merchantId = readRequiredEnv("VIVA_MERCHANT_ID");
  const apiKey = readRequiredEnv("VIVA_API_KEY");
  const credentials = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
  const url = new URL(
    `/api/transactions/${encodeURIComponent(transactionId)}/`,
    getEndpoints().checkoutBaseUrl,
  );
  url.searchParams.set("amount", String(Math.max(0, Math.round(amount))));
  if (sourceCode) url.searchParams.set("sourceCode", sourceCode);

  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { ErrorText?: string | null; StatusId?: string; TransactionId?: string }
    | null;
  if (!response.ok || data?.StatusId !== "F") {
    throw new Error(data?.ErrorText ?? "Viva refund failed.");
  }
  return data;
};

export const getVivaWebhookVerificationKey = async () => {
  if (process.env.VIVA_WEBHOOK_VERIFICATION_KEY?.trim()) {
    return process.env.VIVA_WEBHOOK_VERIFICATION_KEY.trim();
  }
  const merchantId = readRequiredEnv("VIVA_MERCHANT_ID");
  const apiKey = readRequiredEnv("VIVA_API_KEY");
  const credentials = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
  const response = await fetch(`${getEndpoints().checkoutBaseUrl}/api/messages/config/token`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { Key?: string } | null;
  if (!response.ok || !data?.Key) {
    throw new Error("Viva webhook verification key lookup failed.");
  }
  return data.Key;
};

export const normalizeVivaStatus = (statusId?: string | null) => {
  switch ((statusId ?? "").toUpperCase()) {
    case "F":
    case "C":
      return "paid";
    case "R":
      return "refunded";
    case "E":
    case "X":
      return "failed";
    default:
      return "pending";
  }
};

export const mapVivaCurrencyCode = (currencyCode?: number | string | null) => {
  const normalized = String(currencyCode ?? "").trim();
  if (normalized === "978") return "EUR";
  if (normalized === "826") return "GBP";
  if (normalized.length === 3 && /^[A-Z]{3}$/.test(normalized)) return normalized;
  return "EUR";
};
