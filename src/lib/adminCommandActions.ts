import type { AdminScope } from "@/lib/adminPermissions";
import type { AdminStorefrontScope } from "@/lib/storefronts";

export type AdminCommandActionDefinition = {
  id: string;
  label: string;
  description: string;
  scope: AdminScope;
  href?: string;
  badge: string;
  storefrontAware?: boolean;
  queryMatch?: (query: string) => boolean;
  buildHref?: (query: string, storefrontScope: AdminStorefrontScope) => string;
  clientAction?: "save-current-view";
};

export const ADMIN_COMMAND_ACTIONS = [
  {
    id: "create-support-case",
    label: "Create support case",
    description: "Open the support workspace with the manual case form",
    scope: "support.write",
    href: "/admin/support?new=1",
    badge: "CRM",
  },
  {
    id: "create-purchase-order",
    label: "Create purchase order",
    description: "Open procurement with the purchase-order composer",
    scope: "procurement.write",
    href: "/admin/procurement?new=1",
    badge: "Supply",
  },
  {
    id: "open-failed-webhooks",
    label: "Open latest failed webhook",
    description: "Jump to operational replay and automation health",
    scope: "ops.read",
    href: "/admin/ops?status=failed",
    badge: "Ops",
  },
  {
    id: "save-current-view",
    label: "Save current view",
    description: "Persist this page and filter state in the admin sidebar",
    scope: "dashboard.read",
    badge: "View",
    clientAction: "save-current-view",
  },
  {
    id: "issue-customer-task",
    label: "Issue customer task",
    description: "Open CRM follow-up controls for customer operations",
    scope: "crm.write",
    href: "/admin/customers?task=1",
    badge: "CRM",
  },
  {
    id: "open-compliance-queue",
    label: "Open compliance queue",
    description: "Review catalog blockers, feed flags, and ads eligibility",
    scope: "catalog.write",
    href: "/admin/compliance",
    badge: "Catalog",
  },
  {
    id: "run-pricing-preview",
    label: "Run pricing preview",
    description: "Open pricing automation review before applying changes",
    scope: "pricing.run",
    href: "/admin/pricing?preview=1",
    badge: "Revenue",
  },
  {
    id: "open-order-number",
    label: "Open order by number",
    description: "Search the order queue by order number",
    scope: "orders.read",
    badge: "Order",
    queryMatch: (query) => /^\d+$/.test(query),
    buildHref: (query, storefrontScope) =>
      `/admin/orders?customer=${encodeURIComponent(query)}&storefront=${storefrontScope}`,
  },
] satisfies AdminCommandActionDefinition[];

export function filterAdminCommandActions({
  query,
  availableHrefs,
}: {
  query: string;
  availableHrefs: ReadonlySet<string>;
}) {
  const normalized = query.trim().toLowerCase();
  return ADMIN_COMMAND_ACTIONS.filter((action) => {
    if (action.href) {
      const route = action.href.split("?")[0] ?? action.href;
      if (!availableHrefs.has(route)) return false;
    }
    if (action.queryMatch?.(normalized)) return true;
    if (!normalized) return action.id !== "open-order-number";
    return `${action.label} ${action.description} ${action.badge}`
      .toLowerCase()
      .includes(normalized);
  });
}
