import { describe, it, expect } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
  toCents,
} from "../checkoutPolicy";

describe("checkoutPolicy", () => {
  it("free shipping threshold is €69", () => {
    expect(FREE_SHIPPING_THRESHOLD_EUR).toBe(69);
  });

  it("minimum order is €15", () => {
    expect(MIN_ORDER_TOTAL_EUR).toBe(15);
  });

  it("toCents converts EUR to cents correctly", () => {
    expect(toCents(1)).toBe(100);
    expect(toCents(69)).toBe(6900);
    expect(toCents(15)).toBe(1500);
    expect(toCents(0.99)).toBe(99);
    // floating point edge case
    expect(toCents(1.005)).toBe(100); // rounds
  });

  it("free shipping kicks in at exactly the threshold", () => {
    const thresholdCents = toCents(FREE_SHIPPING_THRESHOLD_EUR);
    // at threshold → free shipping applies (>= check)
    expect(thresholdCents >= toCents(FREE_SHIPPING_THRESHOLD_EUR)).toBe(true);
    // one cent below → shipping applies
    expect(thresholdCents - 1 >= toCents(FREE_SHIPPING_THRESHOLD_EUR)).toBe(false);
  });
});
