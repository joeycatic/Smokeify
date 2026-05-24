import "server-only";

import {
  DEFAULT_CHECKOUT_RECOVERY_CONFIG,
  serializeCheckoutRecoveryConfig,
} from "@/lib/checkoutRecovery";

export const AUTOMATION_HANDLERS = [
  "admin.script.run",
  "checkout.recovery.run",
  "supplier.stock.sync",
  "supplier.stock.daily_report",
  "supplier.pricing.sync",
  "pricing.reprice",
  "growvault.diagnostics.sync",
  "admin.report.delivery",
  "catalog.hygiene.scan",
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

type AutomationScheduleDefault = {
  key: string;
  label: string;
  handler: AutomationHandler;
  cronExpression: string;
  maxAttempts: number;
  defaultStatus?: "ACTIVE" | "PAUSED";
  defaultPayload?: Record<string, unknown>;
};

export const AUTOMATION_SCHEDULE_DEFAULTS = [
  {
    key: "checkout-recovery-run",
    label: "Checkout recovery run",
    handler: "checkout.recovery.run" as AutomationHandler,
    cronExpression: "*/15 * * * *",
    maxAttempts: 3,
    defaultStatus: "PAUSED" as const,
    defaultPayload: serializeCheckoutRecoveryConfig(DEFAULT_CHECKOUT_RECOVERY_CONFIG),
  },
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
    cronExpression: "0 * * * *",
    maxAttempts: 3,
  },
  {
    key: "catalog-hygiene-scan",
    label: "Catalog hygiene scan",
    handler: "catalog.hygiene.scan" as AutomationHandler,
    cronExpression: "15 4 * * *",
    maxAttempts: 3,
  },
  {
    key: "landing-page-scheduled-publish",
    label: "Landing page scheduled publish",
    handler: "landing_page.publish_scheduled" as AutomationHandler,
    cronExpression: "*/5 * * * *",
    maxAttempts: 3,
  },
] as const satisfies readonly AutomationScheduleDefault[];

export function assertAutomationCommerceGuardrail(action: CommerceGuardrailAction) {
  throw new Error(
    `Automation guardrail blocked "${action}". Money-sensitive order, refund, return, and checkout mutations require explicit human action or Stripe webhook authority.`,
  );
}
