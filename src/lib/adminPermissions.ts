export type AdminAction =
  | "order.fulfillment.update"
  | "order.email.send"
  | "order.refund.process"
  | "catalog.product.write"
  | "pricing.read"
  | "pricing.review"
  | "pricing.run"
  | "pricing.write"
  | "crm.write"
  | "tax.review"
  | "admin.script.execute"
  | "user.manage";

type AdminRole = "ADMIN" | "STAFF";

const ACTION_ROLE_MAP: Record<AdminAction, AdminRole[]> = {
  "order.fulfillment.update": ["ADMIN", "STAFF"],
  "order.email.send": ["ADMIN"],
  "order.refund.process": ["ADMIN"],
  "catalog.product.write": ["ADMIN", "STAFF"],
  "pricing.read": ["ADMIN", "STAFF"],
  "pricing.review": ["ADMIN"],
  "pricing.run": ["ADMIN"],
  "pricing.write": ["ADMIN"],
  "crm.write": ["ADMIN", "STAFF"],
  "tax.review": ["ADMIN"],
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
    canReadPricing: canAdminPerformAction(role, "pricing.read"),
    canReviewPricing: canAdminPerformAction(role, "pricing.review"),
    canRunPricing: canAdminPerformAction(role, "pricing.run"),
    canWritePricing: canAdminPerformAction(role, "pricing.write"),
    canWriteCrm: canAdminPerformAction(role, "crm.write"),
    canReviewTax: canAdminPerformAction(role, "tax.review"),
    canExecuteScripts: canAdminPerformAction(role, "admin.script.execute"),
    canManageUsers: canAdminPerformAction(role, "user.manage"),
  };
}
