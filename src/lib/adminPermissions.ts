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

export type AdminRole = "ADMIN" | "STAFF";

export type AdminScope =
  | "dashboard.read"
  | "analytics.read"
  | "alerts.read"
  | "alerts.write"
  | "audit.read"
  | "finance.read"
  | "pricing.read"
  | "pricing.review"
  | "pricing.run"
  | "pricing.write"
  | "catalog.read"
  | "catalog.write"
  | "discounts.manage"
  | "content.landing.manage"
  | "content.publish"
  | "orders.read"
  | "orders.fulfillment.write"
  | "orders.email.send"
  | "orders.refund.process"
  | "returns.read"
  | "customers.read"
  | "crm.write"
  | "suppliers.read"
  | "suppliers.write"
  | "users.manage"
  | "tax.review"
  | "scripts.execute"
  | "procurement.read"
  | "procurement.write"
  | "inventory.read"
  | "support.read"
  | "support.write"
  | "ops.read"
  | "ops.write";

type ScopeMatcher = {
  prefix: string;
  scope: AdminScope | null;
  methods?: Array<"GET" | "POST" | "PATCH" | "PUT" | "DELETE">;
};

const STAFF_SCOPES: AdminScope[] = [
  "dashboard.read",
  "analytics.read",
  "alerts.read",
  "alerts.write",
  "catalog.read",
  "catalog.write",
  "orders.read",
  "orders.fulfillment.write",
  "returns.read",
  "customers.read",
  "crm.write",
  "suppliers.read",
  "suppliers.write",
  "procurement.read",
  "procurement.write",
  "inventory.read",
  "support.read",
  "support.write",
];

const ALL_SCOPES: AdminScope[] = [
  "dashboard.read",
  "analytics.read",
  "alerts.read",
  "alerts.write",
  "audit.read",
  "finance.read",
  "pricing.read",
  "pricing.review",
  "pricing.run",
  "pricing.write",
  "catalog.read",
  "catalog.write",
  "discounts.manage",
  "content.landing.manage",
  "content.publish",
  "orders.read",
  "orders.fulfillment.write",
  "orders.email.send",
  "orders.refund.process",
  "returns.read",
  "customers.read",
  "crm.write",
  "suppliers.read",
  "suppliers.write",
  "users.manage",
  "tax.review",
  "scripts.execute",
  "procurement.read",
  "procurement.write",
  "inventory.read",
  "support.read",
  "support.write",
  "ops.read",
  "ops.write",
];

const ROLE_SCOPE_MAP: Record<AdminRole, ReadonlySet<AdminScope>> = {
  ADMIN: new Set(ALL_SCOPES),
  STAFF: new Set(STAFF_SCOPES),
};

const ACTION_SCOPE_MAP: Record<AdminAction, AdminScope> = {
  "order.fulfillment.update": "orders.fulfillment.write",
  "order.email.send": "orders.email.send",
  "order.refund.process": "orders.refund.process",
  "catalog.product.write": "catalog.write",
  "pricing.read": "pricing.read",
  "pricing.review": "pricing.review",
  "pricing.run": "pricing.run",
  "pricing.write": "pricing.write",
  "crm.write": "crm.write",
  "tax.review": "tax.review",
  "admin.script.execute": "scripts.execute",
  "user.manage": "users.manage",
};

const ADMIN_PAGE_SCOPE_MATCHERS: ScopeMatcher[] = [
  { prefix: "/admin/audit", scope: "audit.read" },
  { prefix: "/admin/finance", scope: "finance.read" },
  { prefix: "/admin/reports", scope: "finance.read" },
  { prefix: "/admin/vat", scope: "tax.review" },
  { prefix: "/admin/expenses", scope: "tax.review" },
  { prefix: "/admin/profitability", scope: "finance.read" },
  { prefix: "/admin/pricing", scope: "pricing.read" },
  { prefix: "/admin/discounts", scope: "discounts.manage" },
  { prefix: "/admin/landing-page", scope: "content.landing.manage" },
  { prefix: "/admin/orders", scope: "orders.read" },
  { prefix: "/admin/returns", scope: "returns.read" },
  { prefix: "/admin/inventory-adjustments", scope: "inventory.read" },
  { prefix: "/admin/customers", scope: "customers.read" },
  { prefix: "/admin/users", scope: "users.manage" },
  { prefix: "/admin/suppliers", scope: "suppliers.read" },
  { prefix: "/admin/recommendations", scope: "pricing.review" },
  { prefix: "/admin/scripts", scope: "scripts.execute" },
  { prefix: "/admin/email-testing", scope: "ops.read" },
  { prefix: "/admin/compliance", scope: "catalog.write" },
  { prefix: "/admin/catalog", scope: "catalog.read" },
  { prefix: "/admin/categories", scope: "catalog.write" },
  { prefix: "/admin/collections", scope: "catalog.write" },
  { prefix: "/admin/reviews", scope: "catalog.write" },
  { prefix: "/admin/analytics", scope: "analytics.read" },
  { prefix: "/admin/growvault", scope: "analytics.read" },
  { prefix: "/admin/analyzer", scope: "ops.read" },
  { prefix: "/admin/alerts", scope: "alerts.read" },
  { prefix: "/admin/procurement", scope: "procurement.read" },
  { prefix: "/admin/support", scope: "support.read" },
  { prefix: "/admin/ops", scope: "ops.read" },
  { prefix: "/admin", scope: "dashboard.read" },
];

const ADMIN_API_SCOPE_MATCHERS: ScopeMatcher[] = [
  { prefix: "/api/admin/audit", scope: "audit.read" },
  { prefix: "/api/admin/analytics", scope: "analytics.read" },
  { prefix: "/api/admin/alerts", scope: "alerts.write" },
  { prefix: "/api/admin/analyzer", scope: "ops.read" },
  { prefix: "/api/admin/categories", scope: "catalog.write" },
  { prefix: "/api/admin/collections", scope: "catalog.write" },
  { prefix: "/api/admin/compliance", scope: "catalog.write" },
  { prefix: "/api/admin/customer-tasks", scope: "crm.write" },
  { prefix: "/api/admin/customers/cohorts", scope: "crm.write" },
  { prefix: "/api/admin/customers", scope: "customers.read", methods: ["GET"] },
  { prefix: "/api/admin/customers", scope: "crm.write" },
  { prefix: "/api/admin/discounts", scope: "discounts.manage" },
  { prefix: "/api/admin/email-testing", scope: "ops.read", methods: ["GET"] },
  { prefix: "/api/admin/email-testing", scope: "ops.write" },
  { prefix: "/api/admin/expenses/export", scope: "tax.review" },
  { prefix: "/api/admin/expenses/recurring", scope: "tax.review" },
  { prefix: "/api/admin/expenses", scope: "tax.review" },
  { prefix: "/api/admin/images", scope: "catalog.write" },
  { prefix: "/api/admin/landing-page", scope: "content.publish" },
  { prefix: "/api/admin/newsletters", scope: "ops.write" },
  { prefix: "/api/admin/orders", scope: "orders.read", methods: ["GET"] },
  { prefix: "/api/admin/orders", scope: "orders.fulfillment.write" },
  { prefix: "/api/admin/pricing/run", scope: "pricing.run" },
  { prefix: "/api/admin/pricing/recommendations", scope: "pricing.review" },
  { prefix: "/api/admin/pricing/variants", scope: "pricing.write" },
  { prefix: "/api/admin/pricing", scope: "pricing.read", methods: ["GET"] },
  { prefix: "/api/admin/pricing", scope: "pricing.write" },
  { prefix: "/api/admin/products/search", scope: "catalog.read" },
  { prefix: "/api/admin/products", scope: "catalog.read", methods: ["GET"] },
  { prefix: "/api/admin/products", scope: "catalog.write" },
  { prefix: "/api/admin/recommendations/explain", scope: "pricing.review" },
  { prefix: "/api/admin/recommendations", scope: "pricing.review" },
  { prefix: "/api/admin/reports", scope: "finance.read" },
  { prefix: "/api/admin/returns", scope: "returns.read", methods: ["GET"] },
  { prefix: "/api/admin/returns", scope: "orders.fulfillment.write" },
  { prefix: "/api/admin/reviews", scope: "catalog.write" },
  { prefix: "/api/admin/scripts", scope: "scripts.execute" },
  { prefix: "/api/admin/search", scope: "dashboard.read" },
  { prefix: "/api/admin/suppliers", scope: "suppliers.read", methods: ["GET"] },
  { prefix: "/api/admin/suppliers", scope: "suppliers.write" },
  { prefix: "/api/admin/uploads", scope: "catalog.write" },
  { prefix: "/api/admin/users", scope: "users.manage" },
  { prefix: "/api/admin/variants", scope: "catalog.write" },
  { prefix: "/api/admin/vat", scope: "tax.review" },
  { prefix: "/api/admin/webhooks", scope: "ops.write" },
  { prefix: "/api/admin/purchase-orders", scope: "procurement.read", methods: ["GET"] },
  { prefix: "/api/admin/purchase-orders", scope: "procurement.write" },
  { prefix: "/api/admin/support-cases", scope: "support.read", methods: ["GET"] },
  { prefix: "/api/admin/support-cases", scope: "support.write" },
  { prefix: "/api/admin/ops", scope: "ops.read", methods: ["GET"] },
  { prefix: "/api/admin/ops", scope: "ops.write" },
];

export function normalizeAdminRole(role: unknown): AdminRole | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "STAFF"
    ? (normalized as AdminRole)
    : null;
}

function resolveScopeFromMatchers(
  pathname: string,
  method: string | undefined,
  matchers: ScopeMatcher[],
) {
  const normalizedMethod = method?.toUpperCase();
  return (
    matchers.find(
      (entry) =>
        pathname.startsWith(entry.prefix) &&
        (!entry.methods ||
          !normalizedMethod ||
          entry.methods.includes(
            normalizedMethod as "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
          )),
    )?.scope ?? null
  );
}

export function isAdminRole(role: unknown) {
  return normalizeAdminRole(role) !== null;
}

export function getAdminScopes(role: unknown): AdminScope[] {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) return [];
  return Array.from(ROLE_SCOPE_MAP[normalizedRole]);
}

export function hasAdminScope(role: unknown, scope: AdminScope | AdminScope[]) {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) return false;
  const availableScopes = ROLE_SCOPE_MAP[normalizedRole];
  const requiredScopes = Array.isArray(scope) ? scope : [scope];
  return requiredScopes.some((entry) => availableScopes.has(entry));
}

export function getRequiredAdminPageScope(pathname: string) {
  return resolveScopeFromMatchers(pathname, "GET", ADMIN_PAGE_SCOPE_MATCHERS);
}

export function getRequiredAdminApiScope(pathname: string, method?: string) {
  return resolveScopeFromMatchers(pathname, method, ADMIN_API_SCOPE_MATCHERS);
}

export function canAdminPerformAction(role: unknown, action: AdminAction) {
  return hasAdminScope(role, ACTION_SCOPE_MAP[action]);
}

export function getOrderAdminActionPermissions(role: unknown) {
  return {
    canUpdateFulfillment: hasAdminScope(role, "orders.fulfillment.write"),
    canSendOrderEmail: hasAdminScope(role, "orders.email.send"),
    canProcessRefund: hasAdminScope(role, "orders.refund.process"),
  };
}

export function getAdminCapabilitySnapshot(role: unknown) {
  return {
    scopes: getAdminScopes(role),
    canReadDashboard: hasAdminScope(role, "dashboard.read"),
    canReadAnalytics: hasAdminScope(role, "analytics.read"),
    canReadAlerts: hasAdminScope(role, "alerts.read"),
    canWriteAlerts: hasAdminScope(role, "alerts.write"),
    canReadAudit: hasAdminScope(role, "audit.read"),
    canReadFinance: hasAdminScope(role, "finance.read"),
    canReadCatalog: hasAdminScope(role, "catalog.read"),
    canWriteCatalog: hasAdminScope(role, "catalog.write"),
    canReadPricing: hasAdminScope(role, "pricing.read"),
    canReviewPricing: hasAdminScope(role, "pricing.review"),
    canRunPricing: hasAdminScope(role, "pricing.run"),
    canWritePricing: hasAdminScope(role, "pricing.write"),
    canReadCustomers: hasAdminScope(role, "customers.read"),
    canWriteCrm: hasAdminScope(role, "crm.write"),
    canReadSuppliers: hasAdminScope(role, "suppliers.read"),
    canWriteSuppliers: hasAdminScope(role, "suppliers.write"),
    canReadInventory: hasAdminScope(role, "inventory.read"),
    canReviewTax: hasAdminScope(role, "tax.review"),
    canExecuteScripts: hasAdminScope(role, "scripts.execute"),
    canManageUsers: hasAdminScope(role, "users.manage"),
    canReadProcurement: hasAdminScope(role, "procurement.read"),
    canWriteProcurement: hasAdminScope(role, "procurement.write"),
    canReadSupport: hasAdminScope(role, "support.read"),
    canWriteSupport: hasAdminScope(role, "support.write"),
    canReadOps: hasAdminScope(role, "ops.read"),
    canWriteOps: hasAdminScope(role, "ops.write"),
    canManageContent: hasAdminScope(role, "content.publish"),
  };
}
