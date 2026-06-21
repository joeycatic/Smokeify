import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeVivaTransaction,
  retrieveVivaTransactionByOrderCode,
  vivaAmountMatches,
} from "../viva";

const VIVA_ENV_KEYS = [
  "VIVA_ENVIRONMENT",
  "VIVA_DEMO_MERCHANT_ID",
  "VIVA_DEMO_API_KEY",
  "VIVA_PRODUCTION_MERCHANT_ID",
  "VIVA_PRODUCTION_API_KEY",
  "VIVA_MERCHANT_ID",
  "VIVA_API_KEY",
] as const;

const originalEnv = { ...process.env };

const resetVivaEnv = () => {
  for (const key of VIVA_ENV_KEYS) {
    delete process.env[key];
  }
};

describe("viva transaction helpers", () => {
  beforeEach(() => {
    resetVivaEnv();
  });

  afterEach(() => {
    resetVivaEnv();
    Object.assign(process.env, originalEnv);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes legacy id fields as a transaction id", () => {
    expect(
      normalizeVivaTransaction({
        Amount: 2489,
        Id: "2b4c6b5b-49ff-4e46-adc5-f53740212361",
        OrderCode: "7680701046572600",
        StatusId: "F",
      }),
    ).toMatchObject({
      amount: 2489,
      orderCode: "7680701046572600",
      statusId: "F",
      transactionId: "2b4c6b5b-49ff-4e46-adc5-f53740212361",
    });
  });

  it("retrieves and normalizes a transaction by Viva order code", async () => {
    process.env.VIVA_ENVIRONMENT = "demo";
    process.env.VIVA_DEMO_MERCHANT_ID = "demo-merchant";
    process.env.VIVA_DEMO_API_KEY = "demo-api-key";

    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json({
        Transactions: [
          {
            Id: "2b4c6b5b-49ff-4e46-adc5-f53740212361",
            Amount: 2489,
            OrderCode: "7680701046572600",
            StatusId: "F",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      retrieveVivaTransactionByOrderCode("7680701046572600"),
    ).resolves.toMatchObject({
      amount: 2489,
      orderCode: "7680701046572600",
      statusId: "F",
      transactionId: "2b4c6b5b-49ff-4e46-adc5-f53740212361",
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://demo.vivapayments.com/api/transactions/?ordercode=7680701046572600",
    );
    expect((options?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      `Basic ${Buffer.from("demo-merchant:demo-api-key").toString("base64")}`,
    );
  });

  it("matches Viva transaction amounts in cents or major currency units", () => {
    expect(vivaAmountMatches(2489, 2489)).toBe(true);
    expect(vivaAmountMatches(24.89, 2489)).toBe(true);
    expect(vivaAmountMatches(24.88, 2489)).toBe(false);
  });
});
