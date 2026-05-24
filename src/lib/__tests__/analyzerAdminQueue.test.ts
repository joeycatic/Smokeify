import { describe, expect, it } from "vitest";
import {
  canPublishAnalyzerRunFromReviewState,
  getStoredPublicationRequestStatus,
  mergeAnalyzerAdminFeeds,
  type AnalyzerAdminRun,
} from "@/lib/analyzerAdminQueue";

const buildRun = (overrides: Partial<AnalyzerAdminRun> = {}): AnalyzerAdminRun => ({
  id: "run-1",
  userId: "user-1",
  userEmail: "admin@example.com",
  provider: "openai",
  model: "gpt-4o",
  latencyMs: 1200,
  confidence: 0.6,
  confidenceBand: "medium",
  needsHumanReview: true,
  healthStatus: "WARNING",
  species: "unknown",
  reviewStatus: "UNREVIEWED",
  reviewNotes: null,
  safetyFlags: [],
  imageUri: "https://example.com/image.jpg",
  createdAt: "2026-05-24T22:06:42.627Z",
  priority: 100,
  publicationStatus: null,
  publicationEligible: false,
  feedbackCount: 0,
  incorrectFeedbackCount: 0,
  lastFeedback: null,
  issues: [
    {
      id: "issue-1",
      label: "Blattverfärbung",
      confidence: 0.7,
      severity: "WARNING",
      position: 0,
    },
  ],
  ...overrides,
});

describe("analyzerAdminQueue", () => {
  it("reads stored publication requests from analyzer output", () => {
    expect(
      getStoredPublicationRequestStatus({
        publicationRequest: {
          status: "SUBMITTED",
          requestedPublicImage: false,
          submittedAt: "2026-05-24T22:16:09.205Z",
        },
      }),
    ).toBe("SUBMITTED");
  });

  it("blocks publication for unresolved review states", () => {
    expect(
      canPublishAnalyzerRunFromReviewState({
        reviewStatus: "UNREVIEWED",
        safetyFlags: [],
      }),
    ).toBe(false);
  });

  it("deduplicates local runs that are already present in the growvault bridge feed", () => {
    const localRun = buildRun();
    const bridgedRun = buildRun({
      userId: null,
      latencyMs: null,
      confidenceBand: "low",
      priority: 260,
      publicationStatus: "SUBMITTED",
    });

    expect(mergeAnalyzerAdminFeeds([localRun], [bridgedRun])).toEqual([bridgedRun]);
  });
});
