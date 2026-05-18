import { describe, expect, it } from "vitest";
import {
  buildPlantAnalysisImageRetentionDate,
  getPlantAnalysisReviewPriority,
  isPlantAnalysisReviewUnresolved,
  shouldIncludeInDefaultAnalyzerReviewQueue,
} from "@/lib/adminPlantAnalysis";

const createdAt = new Date("2026-04-01T00:00:00.000Z");

describe("adminPlantAnalysis", () => {
  it("prioritizes incorrect feedback above low confidence alone", () => {
    const disputed = getPlantAnalysisReviewPriority({
      confidence: 0.9,
      healthStatus: "HEALTHY",
      reviewStatus: "UNREVIEWED",
      createdAt,
      feedback: [{ isCorrect: false }],
    });
    const lowConfidence = getPlantAnalysisReviewPriority({
      confidence: 0.4,
      healthStatus: "HEALTHY",
      reviewStatus: "UNREVIEWED",
      createdAt,
      feedback: [],
    });

    expect(disputed).toBeGreaterThan(lowConfidence);
  });

  it("raises priority for unsafe and privacy-sensitive flags", () => {
    const priority = getPlantAnalysisReviewPriority({
      confidence: 0.8,
      healthStatus: "WARNING",
      reviewStatus: "PRIVACY_REVIEW",
      safetyFlags: ["UNSAFE_ACTION", "PRIVACY_SENSITIVE_IMAGE"],
      createdAt,
    });

    expect(priority).toBeGreaterThan(100);
  });

  it("treats reviewed ok as resolved", () => {
    expect(isPlantAnalysisReviewUnresolved("REVIEWED_OK")).toBe(false);
    expect(isPlantAnalysisReviewUnresolved("NEEDS_PROMPT_FIX")).toBe(true);
  });

  it("includes unresolved risky runs in the default queue", () => {
    expect(
      shouldIncludeInDefaultAnalyzerReviewQueue({
        confidence: 0.6,
        healthStatus: "CRITICAL",
        reviewStatus: "UNREVIEWED",
        createdAt,
      }),
    ).toBe(true);

    expect(
      shouldIncludeInDefaultAnalyzerReviewQueue({
        confidence: 0.6,
        healthStatus: "CRITICAL",
        reviewStatus: "REVIEWED_OK",
        createdAt,
      }),
    ).toBe(false);
  });

  it("builds image retention dates from creation time", () => {
    expect(buildPlantAnalysisImageRetentionDate(createdAt, 30)?.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z",
    );
    expect(buildPlantAnalysisImageRetentionDate(createdAt, 0)).toBeNull();
  });
});

