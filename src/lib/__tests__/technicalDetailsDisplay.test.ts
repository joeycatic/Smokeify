import { describe, expect, it } from "vitest";
import { normalizeTechnicalDetailsHtmlForDisplay } from "@/lib/technicalDetailsDisplay";

describe("normalizeTechnicalDetailsHtmlForDisplay", () => {
  it("removes a stray semicolon directly before GTIN", () => {
    expect(normalizeTechnicalDetailsHtmlForDisplay("<p>; GTIN: 4260617974255</p>")).toBe(
      "<p>GTIN: 4260617974255</p>",
    );
  });

  it("renders structured technical rows as a table", () => {
    expect(
      normalizeTechnicalDetailsHtmlForDisplay(
        "<p>Größe: 60 x 60 x 160 cm</p><p>Material: 1680D Silber-Mylar</p><p>Gewicht: 5,8 kg</p>",
      ),
    ).toBe(
      "<table><tbody><tr><td>Größe</td><td>60 x 60 x 160 cm</td></tr><tr><td>Material</td><td>1680D Silber-Mylar</td></tr><tr><td>Gewicht</td><td>5,8 kg</td></tr></tbody></table>",
    );
  });

  it("preserves prose content that is not structured as specs", () => {
    expect(normalizeTechnicalDetailsHtmlForDisplay("<p>Robustes Zelt für den Alltag.</p>")).toBe(
      "<p>Robustes Zelt für den Alltag.</p>",
    );
  });

  it("preserves existing table markup", () => {
    expect(
      normalizeTechnicalDetailsHtmlForDisplay(
        "<table><tbody><tr><td>Größe</td><td>60 x 60 x 160 cm</td></tr></tbody></table>",
      ),
    ).toBe("<table><tbody><tr><td>Größe</td><td>60 x 60 x 160 cm</td></tr></tbody></table>");
  });
});
