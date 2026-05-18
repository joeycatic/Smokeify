import "server-only";

export const AUTOMATION_HANDLERS = [
  "admin.script.run",
  "supplier.stock.sync",
  "supplier.stock.daily_report",
  "supplier.pricing.sync",
  "pricing.reprice",
  "growvault.diagnostics.sync",
  "admin.report.delivery",
  "landing_page.publish_scheduled",
] as const;

export type AutomationHandler = (typeof AUTOMATION_HANDLERS)[number];

export const AUTOMATION_EVENT_TYPES = [
  "order.paid",
  "return_request.created",
  "return_request.updated",
  "analyzer.reviewed",
  "analyzer.flagged",
  "inventory.low_stock_detected",
  "growvault.diagnostics.failed",
] as const;

export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];

export const AUTOMATION_EFFECT_TYPES = [
  "admin_customer_task.created",
  "support_case.created_or_reused",
  "admin_alert.synced",
  "automation.guardrail.blocked",
] as const;

export type AutomationEffectType = (typeof AUTOMATION_EFFECT_TYPES)[number];

const COMMERCE_GUARDRAIL_ACTIONS = [
  "order.mark_paid",
  "order.change_payment_state",
  "order.change_checkout_totals",
  "refund.issue",
  "return.approve",
] as const;

export type CommerceGuardrailAction = (typeof COMMERCE_GUARDRAIL_ACTIONS)[number];

export const AUTOMATION_SCHEDULE_DEFAULTS = [
  {
    key: "supplier-stock-sync",
    label: "Supplier stock sync",
    handler: "supplier.stock.sync" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "supplier-stock-daily-report",
    label: "Supplier stock daily report",
    handler: "supplier.stock.daily_report" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "supplier-pricing-sync",
    label: "Supplier pricing sync",
    handler: "supplier.pricing.sync" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "pricing-reprice",
    label: "Pricing reprice",
    handler: "pricing.reprice" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "growvault-diagnostics",
    label: "Growvault diagnostics sync",
    handler: "growvault.diagnostics.sync" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "admin-report-delivery",
    label: "Admin report delivery",
    handler: "admin.report.delivery" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
  {
    key: "landing-page-scheduled-publish",
    label: "Landing page scheduled publish",
    handler: "landing_page.publish_scheduled" as AutomationHandler,
    cronExpression: "manual-cron",
    maxAttempts: 3,
  },
] as const;

export function assertAutomationCommerceGuardrail(action: CommerceGuardrailAction) {
  throw new Error(
    `Automation guardrail blocked "${action}". Money-sensitive order, refund, return, and checkout mutations require explicit human action or Stripe webhook authority.`,
  );
}
