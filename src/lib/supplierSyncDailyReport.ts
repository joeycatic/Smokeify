import type { Prisma, PrismaClient } from "@prisma/client";

const REPORT_TIME_ZONE = "Europe/Berlin";
const REPORT_HOUR = "12";
const TELEGRAM_MESSAGE_LIMIT = 3500;
const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

type SupplierSyncJobStatus = "SUCCEEDED" | "FAILED" | "DEAD_LETTER";

type SupplierSyncReportJob = {
  status: SupplierSyncJobStatus;
  updatedAt: Date;
  completedAt: Date | null;
  lastError: string | null;
  lastResult: Prisma.JsonValue | null;
};

type SupplierSyncDailyReportSummary = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  timedOutRuns: number;
  durationMs: number;
  windowStart: Date;
  windowEnd: Date;
};

const berlinPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const berlinLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

function getBerlinParts(date: Date) {
  const parts = berlinPartsFormatter.formatToParts(date);
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function formatBerlinDateTime(date: Date) {
  return berlinLabelFormatter.format(date);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getResultRecord(lastResult: Prisma.JsonValue | null) {
  if (!lastResult || typeof lastResult !== "object" || Array.isArray(lastResult)) {
    return {};
  }

  return lastResult as Record<string, unknown>;
}

function getNumericField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarizeJobs(jobs: SupplierSyncReportJob[], windowEnd: Date): SupplierSyncDailyReportSummary {
  const windowStart = new Date(windowEnd.getTime() - REPORT_WINDOW_MS);
  const successfulJobs = jobs.filter((job) => job.status === "SUCCEEDED");
  const failedJobs = jobs.length - successfulJobs.length;

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let timedOutRuns = 0;
  let durationMs = 0;

  for (const job of successfulJobs) {
    const result = getResultRecord(job.lastResult);
    processed += getNumericField(result, "processed");
    updated += getNumericField(result, "updated");
    skipped += getNumericField(result, "skipped");
    failed += getNumericField(result, "failed");
    durationMs += getNumericField(result, "durationMs");
    if (result.timedOut === true) {
      timedOutRuns += 1;
    }
  }

  return {
    totalRuns: jobs.length,
    successfulRuns: successfulJobs.length,
    failedRuns: failedJobs,
    processed,
    updated,
    skipped,
    failed,
    timedOutRuns,
    durationMs,
    windowStart,
    windowEnd,
  };
}

async function sendTelegramMessage({
  env,
  text,
}: {
  env: NodeJS.ProcessEnv;
  text: string;
}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram failed: ${response.status}`);
  }
}

export function isSupplierSyncDailyReportTime(date = new Date()) {
  return getBerlinParts(date).hour === REPORT_HOUR;
}

export function getSupplierSyncDailyReportDedupeKey(date = new Date()) {
  const parts = getBerlinParts(date);
  return `supplier-sync-daily-report::${parts.year}-${parts.month}-${parts.day}`;
}

export function buildSupplierSyncDailyReportMessage({
  jobs,
  windowEnd = new Date(),
}: {
  jobs: SupplierSyncReportJob[];
  windowEnd?: Date;
}) {
  const summary = summarizeJobs(jobs, windowEnd);
  const lastSuccessfulRun = [...jobs]
    .reverse()
    .find((job) => job.status === "SUCCEEDED" && job.completedAt)?.completedAt;
  const recentJobErrors = jobs
    .filter((job) => job.status !== "SUCCEEDED" && job.lastError)
    .slice(-3)
    .map(
      (job) =>
        `${escapeHtml(formatBerlinDateTime(job.updatedAt))} - ${escapeHtml(job.lastError ?? "Unbekannter Fehler")}`,
    );

  let message =
    `<b>Supplier Sync Tagesreport</b>\n` +
    `Zeitfenster: ${escapeHtml(formatBerlinDateTime(summary.windowStart))} bis ${escapeHtml(
      formatBerlinDateTime(summary.windowEnd),
    )}\n\n` +
    `Runs: ${summary.totalRuns}\n` +
    `Erfolgreich: ${summary.successfulRuns}\n` +
    `Job-Fehler: ${summary.failedRuns}\n` +
    `Produkte verarbeitet: ${summary.processed}\n` +
    `Updates: ${summary.updated}\n` +
    `Skipped: ${summary.skipped}\n` +
    `Fehlgeschlagene Produkte: ${summary.failed}\n` +
    `Timeouts: ${summary.timedOutRuns}\n` +
    `Gesamtdauer: ${escapeHtml(formatDuration(summary.durationMs))}\n` +
    `Letzter erfolgreicher Lauf: ${escapeHtml(
      lastSuccessfulRun ? formatBerlinDateTime(lastSuccessfulRun) : "Keiner",
    )}\n\n` +
    `<b>Letzte Job-Fehler</b>\n` +
    `${recentJobErrors.length > 0 ? recentJobErrors.join("\n") : "Keine."}`;

  if (message.length > TELEGRAM_MESSAGE_LIMIT) {
    message = `${message.slice(0, TELEGRAM_MESSAGE_LIMIT - 3)}...`;
  }

  return {
    message,
    summary,
  };
}

export async function sendSupplierSyncDailyReport({
  prisma,
  env = process.env,
  now = new Date(),
}: {
  prisma: PrismaClient;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}) {
  const windowStart = new Date(now.getTime() - REPORT_WINDOW_MS);
  const jobs = await prisma.automationJob.findMany({
    where: {
      handler: "supplier.stock.sync",
      status: { in: ["SUCCEEDED", "FAILED", "DEAD_LETTER"] },
      updatedAt: {
        gt: windowStart,
        lte: now,
      },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      status: true,
      updatedAt: true,
      completedAt: true,
      lastError: true,
      lastResult: true,
    },
  });

  const typedJobs = jobs as SupplierSyncReportJob[];
  const { message, summary } = buildSupplierSyncDailyReportMessage({
    jobs: typedJobs,
    windowEnd: now,
  });

  await sendTelegramMessage({ env, text: message });

  return summary;
}
