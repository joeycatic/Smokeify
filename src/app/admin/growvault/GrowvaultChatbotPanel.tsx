"use client";

import { useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type { GrowvaultChatbotConfig } from "@/lib/growvaultChatbot";
import type { GrowvaultChatbotAnalytics } from "@/lib/growvaultChatbotAdmin";
import { AdminMetricCard } from "@/components/admin/AdminWorkspace";
import {
  AdminBadge,
  AdminCard,
  AdminDetailRail,
  AdminKpiStrip,
  AdminPrimaryGrid,
} from "@/components/admin/ui";

export default function GrowvaultChatbotPanel({
  initialConfig,
  analytics,
  analyticsError,
  canManage,
}: {
  initialConfig: GrowvaultChatbotConfig;
  analytics: GrowvaultChatbotAnalytics;
  analyticsError: string | null;
  canManage: boolean;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateConfig = async (patch: Partial<GrowvaultChatbotConfig>) => {
    if (!canManage || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/growvault/chatbot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        config?: GrowvaultChatbotConfig;
        error?: string;
      };
      if (!response.ok || !payload.config) throw new Error(payload.error ?? "Konfiguration konnte nicht gespeichert werden.");
      setConfig(payload.config);
      setStatus("Gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Konfiguration konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard
      title="GrowVault Chatbot"
      description="Reduzierter, KI-gestützter Shop-Assistent. Nachrichteninhalte werden nicht im Admin gespeichert; Auswertung basiert auf redigierten Ereignissen."
    >
      <AdminKpiStrip>
        <AdminMetricCard label="Öffnungen" value={String(analytics.summary.opened)} footnote="Im gewählten Zeitraum" tone="slate" />
        <AdminMetricCard label="Nachrichten" value={String(analytics.summary.messages)} footnote="Ohne Nachrichteninhalt" tone="violet" />
        <AdminMetricCard label="Antworten" value={String(analytics.summary.responses)} footnote="Erfolgreiche Antworten" tone="emerald" />
        <AdminMetricCard label="Karten-Klicks" value={String(analytics.summary.cardClicks)} footnote="Produkt, Konto oder Analyse" tone="amber" />
        <AdminMetricCard label="Fehler" value={String(analytics.summary.errors)} footnote="Antwort- oder Transportfehler" tone="slate" />
      </AdminKpiStrip>

      {analyticsError ? <p className="mt-3 rounded-xl border border-[#e2a13655] bg-[#fff4dd] px-3 py-2 text-[13px] text-[#81560e]">Chatbot-Metriken konnten nicht geladen werden: {analyticsError}</p> : null}

      <AdminPrimaryGrid className="mt-3">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminCard className="shadow-none" title="Verfügbarkeit" description="Der globale Schalter blendet den Assistenten im Store aus und lässt neue Nachrichten fehlschlagen.">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]"><ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" /></span>
              <button type="button" role="switch" aria-checked={config.enabled} disabled={!canManage || saving} onClick={() => void updateConfig({ enabled: !config.enabled })} className={`relative h-7 w-12 rounded-full transition ${config.enabled ? "bg-[var(--adm-primary)]" : "bg-[var(--adm-text-faint)]"} disabled:cursor-not-allowed disabled:opacity-55`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${config.enabled ? "left-6" : "left-1"}`} /></button>
            </div>
            <div className="mt-3"><AdminBadge variant={config.enabled ? "success" : "neutral"}>{config.enabled ? "Aktiv" : "Deaktiviert"}</AdminBadge></div>
          </AdminCard>
          <AdminCard className="shadow-none" title="Konto-Workflows" description="Bestellung, Rückgabe und Wiederbestellung führen nur in den geschützten Kundenbereich.">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--adm-accent-soft)] text-[var(--adm-accent)]"><ShieldCheckIcon className="h-4 w-4" aria-hidden="true" /></span>
              <button type="button" role="switch" aria-checked={config.accountActionsEnabled} disabled={!canManage || saving || !config.enabled} onClick={() => void updateConfig({ accountActionsEnabled: !config.accountActionsEnabled })} className={`relative h-7 w-12 rounded-full transition ${config.accountActionsEnabled ? "bg-[var(--adm-accent)]" : "bg-[var(--adm-text-faint)]"} disabled:cursor-not-allowed disabled:opacity-55`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${config.accountActionsEnabled ? "left-6" : "left-1"}`} /></button>
            </div>
            <div className="mt-3"><AdminBadge variant={config.accountActionsEnabled ? "accent" : "neutral"}>{config.accountActionsEnabled ? "Freigegeben" : "Nur Shop-Beratung"}</AdminBadge></div>
          </AdminCard>
        </div>
        <AdminDetailRail>
          <AdminCard className="shadow-none" title="Top Themen">
            <div className="flex items-center gap-2 text-[var(--adm-text-muted)]"><ChartBarIcon className="h-4 w-4" aria-hidden="true" /><span className="text-xs">Redigierte Intent-Ereignisse</span></div>
            <div className="mt-3 flex flex-wrap gap-2">{analytics.topIntents.length ? analytics.topIntents.map((item) => <AdminBadge key={item.intent} variant="info">{item.intent.replaceAll("_", " ")} · {item.count}</AdminBadge>) : <span className="text-[13px] text-[var(--adm-text-faint)]">Noch keine redigierten Themen verfügbar.</span>}</div>
          </AdminCard>
          <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3 text-[13px] leading-5 text-[var(--adm-text-muted)]">Änderungen werden im Audit-Log dokumentiert. Prompt, Modell und Chatverläufe bleiben bewusst außerhalb der Admin-Oberfläche.</div>
          {status ? <div role="status"><AdminBadge variant={status === "Gespeichert." ? "success" : "error"}>{status}</AdminBadge></div> : null}
        </AdminDetailRail>
      </AdminPrimaryGrid>
    </AdminCard>
  );
}
