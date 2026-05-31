import { describe, expect, it } from "vitest";
import { resolveTrafficAttribution } from "@/lib/analyticsShared";

describe("resolveTrafficAttribution", () => {
  it("keeps explicit UTM values", () => {
    expect(
      resolveTrafficAttribution({
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "may",
        referrer: "https://www.google.com/",
        currentHost: "www.smokeify.de",
      }),
    ).toEqual({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "may",
    });
  });

  it("classifies Google referrers as organic search", () => {
    expect(
      resolveTrafficAttribution({
        referrer: "https://www.google.com/search?q=vbx",
        currentHost: "www.smokeify.de",
      }),
    ).toEqual({
      utmSource: "google",
      utmMedium: "organic",
      utmCampaign: null,
    });
  });

  it("classifies paid click ids before referrers", () => {
    expect(
      resolveTrafficAttribution({
        paidClickSource: "google",
        paidClickCampaign: "23710421699",
        referrer: "https://www.google.com/",
        currentHost: "www.smokeify.de",
      }),
    ).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "23710421699",
    });
  });

  it("does not classify first-party referrers as acquisition", () => {
    expect(
      resolveTrafficAttribution({
        referrer: "https://www.smokeify.de/products/vbx",
        currentHost: "smokeify.de",
      }),
    ).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });
});
