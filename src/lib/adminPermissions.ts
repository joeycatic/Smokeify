export type AdminAction =
  | "order.fulfillment.update"
  | "order.email.send"
  | "order.refund.process";

type AdminRole = "ADMIN" | "STAFF";

const ACTION_ROLE_MAP: Record<AdminAction, AdminRole[]> = {
  "order.fulfillment.update": ["ADMIN", "STAFF"],
  "order.email.send": ["ADMIN"],
  "order.refund.process": ["ADMIN"],
};

function normalizeRole(role: unknown): string | null {
  return typeof role === "string" ? role.trim().toUpperCase() : null;
}

export function canAdminPerformAction(role: unknown, action: AdminAction) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  return ACTION_ROLE_MAP[action].includes(normalizedRole as AdminRole);
}

export function getOrderAdminActionPermissions(role: unknown) {
  return {
    canUpdateFulfillment: canAdminPerformAction(role, "order.fulfillment.update"),
    canSendOrderEmail: canAdminPerformAction(role, "order.email.send"),
    canProcessRefund: canAdminPerformAction(role, "order.refund.process"),
  };
}
