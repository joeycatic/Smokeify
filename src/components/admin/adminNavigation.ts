import type { ComponentProps, ComponentType } from "react";
import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  CalculatorIcon,
  BeakerIcon,
  BellAlertIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  CheckBadgeIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  SwatchIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { hasAdminScope, type AdminScope } from "@/lib/adminPermissions";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ComponentType<ComponentProps<"svg">>;
  exact?: boolean;
  scope: AdminScope;
};

export type AdminWorkspace = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<ComponentProps<"svg">>;
  items: AdminNavItem[];
};

export const ADMIN_WORKSPACES: AdminWorkspace[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Business health, analytics, and storefronts",
    icon: HomeIcon,
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon, exact: true, scope: "dashboard.read" },
      { href: "/admin/analytics", label: "Analytics", icon: ChartBarSquareIcon, scope: "analytics.read" },
      { href: "/admin/smokeify", label: "Smokeify", icon: HomeIcon, scope: "analytics.read" },
      { href: "/admin/growvault", label: "GrowVault", icon: HomeIcon, scope: "analytics.read" },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    description: "Order triage, purchasing, returns, and fulfillment flow",
    icon: CreditCardIcon,
    items: [
      { href: "/admin/orders", label: "Orders", icon: CreditCardIcon, scope: "orders.read" },
      {
        href: "/admin/procurement",
        label: "Procurement",
        icon: TruckIcon,
        scope: "procurement.read",
      },
      { href: "/admin/returns", label: "Returns", icon: ArchiveBoxIcon, scope: "returns.read" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Products, taxonomy, governance, and inventory",
    icon: CubeIcon,
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: CubeIcon, scope: "catalog.read" },
      { href: "/admin/catalog/hygiene", label: "Hygiene", icon: ClipboardDocumentListIcon, scope: "catalog.read" },
      { href: "/admin/categories", label: "Categories", icon: SwatchIcon, scope: "catalog.write" },
      { href: "/admin/collections", label: "Collections", icon: FolderIcon, scope: "catalog.write" },
      { href: "/admin/compliance", label: "Compliance", icon: CheckBadgeIcon, scope: "catalog.write" },
      { href: "/admin/suppliers", label: "Suppliers", icon: TruckIcon, scope: "suppliers.read" },
      {
        href: "/admin/supplier-import",
        label: "Supplier Import",
        icon: Squares2X2Icon,
        scope: "catalog.write",
      },
      {
        href: "/admin/inventory-adjustments",
        label: "Inventory",
        icon: TruckIcon,
        scope: "inventory.read",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    description: "Support, customer records, and feedback",
    icon: UsersIcon,
    items: [
      { href: "/admin/support", label: "Support", icon: ChatBubbleLeftRightIcon, scope: "support.read" },
      { href: "/admin/customers", label: "Contacts CRM", icon: UsersIcon, scope: "customers.read" },
      { href: "/admin/reviews", label: "Reviews", icon: ChatBubbleLeftRightIcon, scope: "catalog.write" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Campaigns, growth, content, and attribution",
    icon: ChartBarSquareIcon,
    items: [
      { href: "/admin/mcc", label: "Command Center", icon: ChartBarSquareIcon, scope: "marketing.read" },
      { href: "/admin/growth", label: "Growth", icon: ChartBarSquareIcon, scope: "marketing.read" },
      {
        href: "/admin/email-testing",
        label: "Email",
        icon: ArrowTopRightOnSquareIcon,
        scope: "marketing.send",
      },
      { href: "/admin/landing-page", label: "Landing Page", icon: RectangleStackIcon, scope: "content.landing.manage" },
      { href: "/admin/discounts", label: "Discounts", icon: TagIcon, scope: "discounts.manage" },
      {
        href: "/admin/attribution",
        label: "Attribution",
        icon: DocumentTextIcon,
        scope: "marketing.read",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance & Pricing",
    description: "Finance, tax, profitability, and pricing",
    icon: BanknotesIcon,
    items: [
      { href: "/admin/finance", label: "Finance", icon: BanknotesIcon, scope: "finance.read" },
      {
        href: "/admin/profitability",
        label: "Profitability",
        icon: PresentationChartLineIcon,
        scope: "finance.read",
      },
      { href: "/admin/pricing", label: "Pricing", icon: CalculatorIcon, scope: "pricing.read" },
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        icon: RectangleGroupIcon,
        scope: "pricing.review",
      },
      { href: "/admin/vat", label: "VAT", icon: CalculatorIcon, scope: "tax.review" },
      { href: "/admin/expenses", label: "Expenses", icon: DocumentTextIcon, scope: "tax.review" },
      { href: "/admin/reports", label: "Reports", icon: DocumentTextIcon, scope: "finance.read" },
    ],
  },
  {
    id: "system",
    label: "System",
    description: "Operations, alerts, tools, access, and audit",
    icon: CommandLineIcon,
    items: [
      { href: "/admin/ops", label: "Ops", icon: ClipboardDocumentListIcon, scope: "ops.read" },
      { href: "/admin/alerts", label: "Alerts", icon: BellAlertIcon, scope: "alerts.read" },
      { href: "/admin/analyzer", label: "Analyzer", icon: BeakerIcon, scope: "ops.read" },
      { href: "/admin/page-previews", label: "Page Previews", icon: RectangleStackIcon, scope: "ops.read" },
      { href: "/admin/scripts", label: "Scripts", icon: CommandLineIcon, scope: "scripts.execute" },
      { href: "/admin/users", label: "Users", icon: UsersIcon, scope: "users.manage" },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardDocumentListIcon, scope: "audit.read" },
    ],
  },
];

export const ADMIN_HIDDEN_ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/catalog/", title: "Product Detail" },
  { prefix: "/admin/users/", title: "User Detail" },
  { prefix: "/admin/procurement/", title: "Purchase Order" },
  { prefix: "/admin/orders/", title: "Order Detail" },
  { prefix: "/admin/compliance/", title: "Compliance Detail" },
];

export function getAdminHiddenRouteTitle(pathname: string) {
  if (pathname.startsWith("/admin/catalog/hygiene")) return null;
  return ADMIN_HIDDEN_ROUTE_TITLES.find((item) => pathname.startsWith(item.prefix))?.title ?? null;
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  if (item.href === "/admin/catalog" && pathname.startsWith("/admin/catalog/hygiene")) {
    return false;
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getVisibleAdminWorkspaces(userRole: "USER" | "ADMIN" | "STAFF") {
  return ADMIN_WORKSPACES.map((workspace) => ({
    ...workspace,
    items: workspace.items.filter((item) => hasAdminScope(userRole, item.scope)),
  })).filter((workspace) => workspace.items.length > 0);
}

export function getActiveAdminWorkspace(
  pathname: string,
  workspaces: AdminWorkspace[],
) {
  return (
    workspaces.find((workspace) =>
      workspace.items.some((item) => isAdminNavItemActive(pathname, item)),
    ) ?? workspaces[0] ?? null
  );
}

export function getActiveAdminNavItem(
  pathname: string,
  workspaces: AdminWorkspace[],
  activeWorkspace: AdminWorkspace | null,
) {
  return (
    activeWorkspace?.items.find((item) => isAdminNavItemActive(pathname, item)) ??
    workspaces.flatMap((workspace) => workspace.items).find((item) =>
      isAdminNavItemActive(pathname, item),
    ) ??
    null
  );
}
