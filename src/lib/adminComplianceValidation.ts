export const ADMIN_COMPLIANCE_ACTIONS = [
  "approve",
  "request_changes",
  "block",
  "add_manual_blocker",
  "clear_manual_blocker",
  "assign_owner",
  "add_review_note",
  "set_feed_eligibility",
  "set_ads_eligibility",
] as const;

export type AdminComplianceAction = (typeof ADMIN_COMPLIANCE_ACTIONS)[number];

export type AdminComplianceMutationInput = {
  action: AdminComplianceAction;
  note: string;
  blocker: string;
  ownerId: string | null;
  ownerEmail: string | null;
  eligible: boolean | null;
};

const normalizeText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export function normalizeAdminComplianceMutationInput(
  body: unknown,
): AdminComplianceMutationInput | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  const action = typeof payload.action === "string" ? payload.action.trim() : "";
  if (!ADMIN_COMPLIANCE_ACTIONS.includes(action as AdminComplianceAction)) {
    return null;
  }

  return {
    action: action as AdminComplianceAction,
    note: normalizeText(payload.note, 1_500),
    blocker: normalizeText(payload.blocker, 300),
    ownerId: normalizeText(payload.ownerId, 120) || null,
    ownerEmail: normalizeText(payload.ownerEmail, 240) || null,
    eligible: typeof payload.eligible === "boolean" ? payload.eligible : null,
  };
}
