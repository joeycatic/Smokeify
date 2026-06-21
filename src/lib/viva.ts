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
  id?: string | null;
  Id?: string | null;
  amount?: number;
  Amount?: number;
  cardNumber?: string | null;
  CardNumber?: string | null;
  currencyCode?: number | string | null;
  CurrencyCode?: number | string | null;
  customerTrns?: string | null;
  CustomerTrns?: string | null;
  email?: string | null;
  Email?: string | null;
  fullName?: string | null;
  FullName?: string | null;
  merchantTrns?: string | null;
  MerchantTrns?: string | null;
  orderCode?: string | number | null;
  OrderCode?: string | number | null;
  statusId?: string | null;
  StatusId?: string | null;
  transactionId?: string | null;
  TransactionId?: string | null;
};

type VivaTransactionsResponse =
  | VivaTransaction[]
  | {
      Data?: VivaTransaction[];
      Transactions?: VivaTransaction[];
      data?: VivaTransaction[];
      transactions?: VivaTransaction[];
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

const getEnvValue = (name: string) => process.env[name]?.trim() || undefined;

const getVivaScopedEnvName = (name: string, environment = getEnvironment()) =>
  environment === "production" ? `VIVA_PRODUCTION_${name}` : `VIVA_DEMO_${name}`;

const readRequiredVivaEnv = (name: string) => {
  const scopedName = getVivaScopedEnvName(name);
  const legacyName = `VIVA_${name}`;
  const value = getEnvValue(scopedName) ?? getEnvValue(legacyName);
  if (!value) {
    throw new Error(`${scopedName} or ${legacyName} is not configured.`);
  }
  return value;
};

const readOptionalVivaEnv = (name: string) =>
  getEnvValue(getVivaScopedEnvName(name)) ?? getEnvValue(`VIVA_${name}`);

export const getVivaSourceCode = () => readRequiredVivaEnv("SOURCE_CODE");

export const getVivaCheckoutUrl = (orderCode: string) => {
  const { checkoutBaseUrl } = getEndpoints();
  const url = new URL("/web/checkout", checkoutBaseUrl);
  url.searchParams.set("ref", orderCode);
  return url.toString();
};

export const getVivaAccessToken = async () => {
  const environment = getEnvironment();
  const clientId = readRequiredVivaEnv("CLIENT_ID");
  const clientSecret = readRequiredVivaEnv("CLIENT_SECRET");
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
        `Viva credentials were rejected for VIVA_ENVIRONMENT=${environment}. Check ${getVivaScopedEnvName("CLIENT_ID", environment)} and ${getVivaScopedEnvName("CLIENT_SECRET", environment)} for that environment.`,
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
  return normalizeVivaTransaction(data) as VivaTransaction;
};

const getTransactionsFromResponse = (data: VivaTransactionsResponse | null) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.transactions ?? data.Transactions ?? data.data ?? data.Data ?? [];
};

export const normalizeVivaTransaction = (
  transaction?: VivaTransaction | null,
): VivaTransaction | null => {
  if (!transaction) return null;
  return {
    ...transaction,
    amount: transaction.amount ?? transaction.Amount,
    cardNumber: transaction.cardNumber ?? transaction.CardNumber ?? null,
    currencyCode: transaction.currencyCode ?? transaction.CurrencyCode ?? null,
    customerTrns: transaction.customerTrns ?? transaction.CustomerTrns ?? null,
    email: transaction.email ?? transaction.Email ?? null,
    fullName: transaction.fullName ?? transaction.FullName ?? null,
    merchantTrns: transaction.merchantTrns ?? transaction.MerchantTrns ?? null,
    orderCode: transaction.orderCode ?? transaction.OrderCode ?? null,
    statusId: transaction.statusId ?? transaction.StatusId ?? null,
    transactionId:
      transaction.transactionId ??
      transaction.TransactionId ??
      transaction.id ??
      transaction.Id ??
      null,
  } satisfies VivaTransaction;
};

export const retrieveVivaTransactionByOrderCode = async (
  orderCode: string,
): Promise<VivaTransaction | null> => {
  const merchantId = readRequiredVivaEnv("MERCHANT_ID");
  const apiKey = readRequiredVivaEnv("API_KEY");
  const credentials = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
  const url = new URL("/api/transactions/", getEndpoints().checkoutBaseUrl);
  url.searchParams.set("ordercode", orderCode);

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as VivaTransactionsResponse | null;
  if (!response.ok) {
    throw new Error("Viva transaction lookup by order code failed.");
  }

  const transactions = getTransactionsFromResponse(data)
    .map((transaction) => normalizeVivaTransaction(transaction))
    .filter((transaction): transaction is VivaTransaction => Boolean(transaction?.transactionId));
  const paidExactMatch = transactions.find(
    (transaction) =>
      String(transaction.orderCode ?? "").trim() === orderCode &&
      ["F", "C"].includes(String(transaction.statusId ?? "").toUpperCase()),
  );
  const exactMatch = transactions.find(
    (transaction) => String(transaction.orderCode ?? "").trim() === orderCode,
  );
  const paidMatch = transactions.find((transaction) =>
    ["F", "C"].includes(String(transaction.statusId ?? "").toUpperCase()),
  );
  return paidExactMatch ?? exactMatch ?? paidMatch ?? transactions[0] ?? null;
};

export const vivaAmountMatches = (
  transactionAmount: number | null | undefined,
  expectedMinorUnits: number,
) => {
  if (typeof transactionAmount !== "number" || !Number.isFinite(transactionAmount)) {
    return false;
  }
  const absoluteAmount = Math.abs(transactionAmount);
  return (
    Math.round(absoluteAmount) === expectedMinorUnits ||
    Math.round(absoluteAmount * 100) === expectedMinorUnits
  );
};

export const normalizeVivaAmountToMinorUnits = (
  transactionAmount: number | null | undefined,
  expectedMinorUnits: number,
) => {
  if (typeof transactionAmount !== "number" || !Number.isFinite(transactionAmount)) {
    return expectedMinorUnits;
  }
  const absoluteAmount = Math.abs(transactionAmount);
  if (Math.round(absoluteAmount) === expectedMinorUnits) {
    return Math.round(absoluteAmount);
  }
  if (Math.round(absoluteAmount * 100) === expectedMinorUnits) {
    return Math.round(absoluteAmount * 100);
  }
  return Math.round(absoluteAmount);
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
  const merchantId = readRequiredVivaEnv("MERCHANT_ID");
  const apiKey = readRequiredVivaEnv("API_KEY");
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
  const configuredKey = readOptionalVivaEnv("WEBHOOK_VERIFICATION_KEY");
  if (configuredKey) {
    return configuredKey;
  }
  const merchantId = readRequiredVivaEnv("MERCHANT_ID");
  const apiKey = readRequiredVivaEnv("API_KEY");
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
