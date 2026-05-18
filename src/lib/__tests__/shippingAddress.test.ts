import { describe, expect, it } from "vitest";
import {
  buildShippingAddressLines,
  normalizeShippingAddress,
  validateShippingAddress,
} from "@/lib/shippingAddress";

describe("shippingAddress", () => {
  it("normalizes packstation addresses and clears street fields", () => {
    expect(
      normalizeShippingAddress({
        shippingAddressType: "PACKSTATION",
        street: "Ignored",
        houseNumber: "99",
        postalCode: "10115",
        city: "Berlin",
        country: "DE",
        packstationNumber: "123",
        postNumber: "4567890",
      }),
    ).toEqual({
      shippingAddressType: "PACKSTATION",
      street: null,
      houseNumber: null,
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
      packstationNumber: "123",
      postNumber: "4567890",
    });
  });

  it("rejects non-german packstation addresses", () => {
    expect(
      validateShippingAddress(
        {
          shippingAddressType: "PACKSTATION",
          packstationNumber: "123",
          postNumber: "4567890",
          postalCode: "8000",
          city: "Zurich",
          country: "CH",
        },
        { requireComplete: true },
      ),
    ).toBe("Packstation ist derzeit nur für Deutschland verfügbar.");
  });

  it("requires street fields for street addresses", () => {
    expect(
      validateShippingAddress(
        {
          shippingAddressType: "STREET",
          postalCode: "10115",
          city: "Berlin",
          country: "DE",
        },
        { requireComplete: true },
      ),
    ).toBe("Straße, Hausnummer, PLZ, Stadt und Land sind erforderlich.");
  });

  it("builds stripe address lines for packstation addresses", () => {
    expect(
      buildShippingAddressLines({
        shippingAddressType: "PACKSTATION",
        packstationNumber: "123",
        postNumber: "4567890",
      }),
    ).toEqual({
      line1: "Packstation 123",
      line2: "Postnummer 4567890",
    });
  });
});
