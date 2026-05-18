import "server-only";

import { prisma } from "@/lib/prisma";
import { getAutomationBootstrapMessage, isAutomationControlPlaneMissingError } from "@/lib/automationQueue";
import { EXPENSE_STORAGE_UNAVAILABLE_MESSAGE, isMissingExpenseTableError } from "@/lib/expenseTableGuard";

export type AdminEnvironmentHealthStatus = "healthy" | "degraded" | "blocked";

export type AdminSubsystemHealth = {
  key: "expenses" | "recurring_expenses" | "automation";
  label: string;
  status: AdminEnvironmentHealthStatus;
  ready: boolean;
  message: string | null;
  checkedAt: string;
};

export type AdminEnvironmentHealth = {
  status: AdminEnvironmentHealthStatus;
  subsystems: AdminSubsystemHealth[];
  lastSuccessfulAutomationRunAt: string | null;
  lastMigrationBlockAt: string | null;
};

function buildSubsystem(
  key: AdminSubsystemHealth["key"],
  label: string,
  ready: boolean,
  message: string | null,
): AdminSubsystemHealth {
  return {
    key,
    label,
    status: ready ? "healthy" : "blocked",
    ready,
    message,
    checkedAt: new Date().toISOString(),
  };
}

function deriveStatus(subsystems: AdminSubsystemHealth[]): AdminEnvironmentHealthStatus {
  if (subsystems.some((subsystem) => subsystem.status === "blocked")) {
    return "blocked";
  }
  if (subsystems.some((subsystem) => subsystem.status === "degraded")) {
    return "degraded";
  }
  return "healthy";
}

export async function getAdminEnvironmentHealth(): Promise<AdminEnvironmentHealth> {
  const checkedAt = new Date().toISOString();

  const [expenseSubsystem, recurringExpenseSubsystem, automationSubsystem, lastSuccessfulAutomationRunAt] =
    await Promise.all([
      (async () => {
        try {
          await prisma.expense.count();
          return buildSubsystem("expenses", "Expense storage", true, null);
        } catch (error) {
          if (!isMissingExpenseTableError(error)) throw error;
          return buildSubsystem("expenses", "Expense storage", false, EXPENSE_STORAGE_UNAVAILABLE_MESSAGE);
        }
      })(),
      (async () => {
        try {
          await prisma.recurringExpense.count();
          return buildSubsystem("recurring_expenses", "Recurring expense storage", true, null);
        } catch (error) {
          if (!isMissingExpenseTableError(error)) throw error;
          return buildSubsystem(
            "recurring_expenses",
            "Recurring expense storage",
            false,
            EXPENSE_STORAGE_UNAVAILABLE_MESSAGE,
          );
        }
      })(),
      (async () => {
        try {
          await prisma.automationSchedule.count();
          return buildSubsystem("automation", "Automation control plane", true, null);
        } catch (error) {
          if (!isAutomationControlPlaneMissingError(error)) throw error;
          return buildSubsystem(
            "automation",
            "Automation control plane",
            false,
            getAutomationBootstrapMessage(),
          );
        }
      })(),
      prisma.adminJobRun
        .findFirst({
          where: { status: "SUCCEEDED" },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true },
        })
        .then((run) => run?.finishedAt?.toISOString() ?? null)
        .catch(() => null),
    ]);

  const subsystems = [expenseSubsystem, recurringExpenseSubsystem, automationSubsystem].map(
    (subsystem) => ({ ...subsystem, checkedAt }),
  );

  return {
    status: deriveStatus(subsystems),
    subsystems,
    lastSuccessfulAutomationRunAt,
    lastMigrationBlockAt: subsystems.some((subsystem) => !subsystem.ready) ? checkedAt : null,
  };
}
