export type AdminAction =
  | "order.fulfillment.update"
  | "order.email.send"
  | "order.refund.process"
  | "catalog.product.write"
  | "pricing.write"
  | "admin.script.execute"
  | "user.manage";

type AdminRole = "ADMIN" | "STAFF";

const ACTION_ROLE_MAP: Record<AdminAction, AdminRole[]> = {
  "order.fulfillment.update": ["ADMIN", "STAFF"],
  "order.email.send": ["ADMIN"],
  "order.refund.process": ["ADMIN"],
  "catalog.product.write": ["ADMIN", "STAFF"],
  "pricing.write": ["ADMIN"],
  "admin.script.execute": ["ADMIN"],
  "user.manage": ["ADMIN"],
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

export function getAdminCapabilitySnapshot(role: unknown) {
  return {
    canWriteCatalog: canAdminPerformAction(role, "catalog.product.write"),
    canWritePricing: canAdminPerformAction(role, "pricing.write"),
    canExecuteScripts: canAdminPerformAction(role, "admin.script.execute"),
    canManageUsers: canAdminPerformAction(role, "user.manage"),
  };
}
