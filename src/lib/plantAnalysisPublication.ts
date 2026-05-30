export type PlantAnalysisPublicationOwnerState = {
  status: "DRAFT" | "SUBMITTED" | "REJECTED" | "PUBLISHED";
  publicUrl: string | null;
  requestedPublicImage?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
