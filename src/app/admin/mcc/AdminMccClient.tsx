"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChartBarSquareIcon,
  EnvelopeIcon,
  FunnelIcon,
  PlayIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTableShell,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import { fetchAdminJson } from "@/lib/adminClientFetch";
import { formatAdminMoney, formatAdminPercent } from "@/lib/adminFormatting";
import type {
  MccAudienceFilters,
  MccPagePayload,
  MccRangeDays,
  MarketingScope,
} from "@/lib/adminMcc";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  type AdminStorefrontScope,
} from "@/lib/storefronts";

type TabId =
  | "overview"
  | "contacts"
  | "audiences"
  | "campaigns"
  | "automations"
  | "content"
  | "attribution"
  | "tasks";

type Notice = { tone: "success" | "error" | "info" | "warning"; text: string } | null;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "audiences", label: "Audiences" },
  { id: "campaigns", label: "Campaigns" },
  { id: "automations", label: "Automations" },
  { id: "content", label: "Content & Offers" },
  { id: "attribution", label: "Attribution" },
  { id: "tasks", label: "Tasks" },
];

const scopeOptions: MarketingScope[] = ["ALL", "MAIN", "GROW"];
const rangeOptions: MccRangeDays[] = [7, 30, 90, 365];

const formatNumber = (value: number) => new Intl.NumberFormat("de-DE").format(value);
const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value)) : "-";

const defaultFilters: MccAudienceFilters = {
  newsletterConsent: "any",
  minOrders: 0,
};

function buildScopeHref(storefront: AdminStorefrontScope, range: MccRangeDays, q?: string) {
  const params = new URLSearchParams({ storefront, range: String(range) });
  if (q) params.set("q", q);
  return `/admin/mcc?${params.toString()}`;
}

export default function AdminMccClient({
  initialData,
  initialStorefrontScope,
  initialRangeDays,
  initialQuery,
}: {
  initialData: MccPagePayload;
  initialStorefrontScope: AdminStorefrontScope;
  initialRangeDays: MccRangeDays;
  initialQuery: string;
}) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [storefrontScope, setStorefrontScope] = useState(initialStorefrontScope);
  const [rangeDays, setRangeDays] = useState(initialRangeDays);
  const [query, setQuery] = useState(initialQuery);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [audienceName, setAudienceName] = useState("High-intent newsletter audience");
  const [audienceFilters, setAudienceFilters] = useState<MccAudienceFilters>(defaultFilters);
  const [campaignName, setCampaignName] = useState("MCC newsletter campaign");
  const [campaignAudienceId, setCampaignAudienceId] = useState(data.audiences[0]?.id ?? "");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState(data.campaigns[0]?.id ?? "");

  const selectedCampaign = useMemo(
    () => data.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [data.campaigns, selectedCampaignId],
  );

  const refresh = async (nextScope = storefrontScope, nextRange = rangeDays, nextQuery = query) => {
    const params = new URLSearchParams({
      storefront: nextScope,
      range: String(nextRange),
      q: nextQuery,
    });
    const { response, data: overview } = await fetchAdminJson<MccPagePayload["overview"]>(
      `/api/admin/mcc/overview?${params.toString()}`,
    );
    if (!response.ok) return;
    const [contacts, audiences, campaigns, automations, activities] = await Promise.all([
      fetchAdminJson<MccPagePayload["contacts"]>(
        `/api/admin/mcc/contacts?${params.toString()}`,
      ),
      fetchAdminJson<MccPagePayload["audiences"]>(
        `/api/admin/mcc/audiences?storefront=${nextScope}`,
      ),
      fetchAdminJson<MccPagePayload["campaigns"]>(
        `/api/admin/mcc/campaigns?storefront=${nextScope}`,
      ),
      fetchAdminJson<MccPagePayload["automations"]>(
        `/api/admin/mcc/automations?storefront=${nextScope}`,
      ),
      fetchAdminJson<MccPagePayload["activities"]>(
        `/api/admin/mcc/timeline?storefront=${nextScope}`,
      ),
    ]);
    setData({
      ...data,
      overview,
      contacts: contacts.data,
      audiences: audiences.data,
      campaigns: campaigns.data,
      automations: automations.data,
      activities: activities.data,
    });
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setPending(key);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "MCC action failed.",
      });
    } finally {
      setPending(null);
    }
  };

  const createAudience = () =>
    runAction("audience", async () => {
      const { response, data: result } = await fetchAdminJson<{ error?: string }>(
        "/api/admin/mcc/audiences",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: audienceName,
            storefront: storefrontScope,
            filters: audienceFilters,
          }),
        },
      );
      if (!response.ok) throw new Error(result.error ?? "Audience save failed.");
      setNotice({ tone: "success", text: "Audience saved." });
      await refresh();
    });

  const createCampaign = () =>
    runAction("campaign", async () => {
      const { response, data: result } = await fetchAdminJson<{
        error?: string;
        campaign?: { id: string };
      }>("/api/admin/mcc/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          name: campaignName,
          storefront: storefrontScope,
          audienceId: campaignAudienceId || null,
          subject: campaignSubject,
          body: campaignBody,
        }),
      });
      if (!response.ok) throw new Error(result.error ?? "Campaign save failed.");
      setNotice({ tone: "success", text: "Campaign draft saved." });
      if (result.campaign?.id) setSelectedCampaignId(result.campaign.id);
      await refresh();
    });

  const sendTest = () =>
    runAction("test", async () => {
      if (!selectedCampaignId) throw new Error("Select a campaign first.");
      const { response, data: result } = await fetchAdminJson<{ error?: string }>(
        "/api/admin/mcc/campaigns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test",
            campaignId: selectedCampaignId,
            recipient: testRecipient,
          }),
        },
      );
      if (!response.ok) throw new Error(result.error ?? "Test send failed.");
      setNotice({ tone: "success", text: "Test email sent." });
      await refresh();
    });

  const launchCampaign = () =>
    runAction("launch", async () => {
      if (!selectedCampaignId) throw new Error("Select a campaign first.");
      const { response, data: result } = await fetchAdminJson<{ error?: string }>(
        "/api/admin/mcc/campaigns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "launch",
            campaignId: selectedCampaignId,
            confirm: true,
          }),
        },
      );
      if (!response.ok) throw new Error(result.error ?? "Campaign send failed.");
      setNotice({ tone: "success", text: "Campaign send completed." });
      await refresh();
    });

  const metrics = data.overview.metrics;

  return (
    <div className="space-y-4">
      <AdminPageIntro
        eyebrow="Marketing Command Center"
        title="MCC"
        description="One operating surface for contacts, audiences, campaigns, automations, content, offers, attribution, and CRM tasks across Smokeify and GrowVault."
        actions={
          <>
            <AdminSelect
              aria-label="Storefront scope"
              value={storefrontScope}
              onChange={(event) => {
                const nextScope = event.target.value as AdminStorefrontScope;
                setStorefrontScope(nextScope);
                void refresh(nextScope);
              }}
            >
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {ADMIN_STOREFRONT_SCOPE_LABELS[scope]}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              aria-label="Range"
              value={rangeDays}
              onChange={(event) => {
                const nextRange = Number(event.target.value) as MccRangeDays;
                setRangeDays(nextRange);
                void refresh(storefrontScope, nextRange);
              }}
            >
              {rangeOptions.map((range) => (
                <option key={range} value={range}>
                  {range} days
                </option>
              ))}
            </AdminSelect>
          </>
        }
        metrics={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Revenue influenced"
              value={formatAdminMoney(metrics.revenueInfluencedCents)}
              detail={`${rangeDays} days`}
              tone="emerald"
            />
            <AdminMetricCard
              label="Audience size"
              value={formatNumber(metrics.activeAudienceSize)}
              detail={`${metrics.newsletterRecipients} reachable`}
              tone="violet"
            />
            <AdminMetricCard
              label="Campaign sends"
              value={formatNumber(metrics.campaignSends)}
              detail={`${metrics.activeCampaigns} active`}
              tone="amber"
            />
            <AdminMetricCard
              label="Automation health"
              value={formatAdminPercent(metrics.automationHealthRate / 100)}
              detail={`${metrics.activeAutomations} active`}
              tone="slate"
            />
          </div>
        }
      />

      {notice ? <AdminNotice tone={notice.tone}>{notice.text}</AdminNotice> : null}

      <div className="admin-scroll-x flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-cyan-400 text-slate-950"
                : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <AdminPanel
            eyebrow="Live operating view"
            title="Lifecycle and storefront split"
            description="Contacts are consolidated from registered users, guest orders, subscribers, recovery sessions, restock intent, support, and analyzer activity."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(data.overview.split).map(([storefront, row]) => (
                <div key={storefront} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{storefront === "MAIN" ? "Smokeify" : "GrowVault"}</div>
                    <div className="text-xs text-slate-500">{formatNumber(row.orders)} orders</div>
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">{formatNumber(row.contacts)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatAdminMoney(row.revenueCents)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              {data.overview.lifecycle.map((row) => (
                <div key={row.stage} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-slate-300">{row.stage}</span>
                  <span className="text-sm font-semibold text-white">{formatNumber(row.count)}</span>
                </div>
              ))}
            </div>
          </AdminPanel>
          <AdminPanel
            eyebrow="Queues"
            title="Open CRM and support load"
            description="Use MCC Tasks for retention playbooks and service recovery."
          >
            <div className="grid gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm text-slate-400">Open CRM tasks</div>
                <div className="mt-2 text-2xl font-semibold text-white">{metrics.openCrmTasks}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm text-slate-400">Open support cases</div>
                <div className="mt-2 text-2xl font-semibold text-white">{metrics.openSupportCases}</div>
              </div>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeTab === "contacts" ? (
        <AdminPanel
          eyebrow="CRM"
          title="Unified contacts"
          description="Searchable customer, guest, subscriber, checkout recovery, restock, support, and analyzer signals."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <AdminInput
                value={query}
                placeholder="Search contacts"
                onChange={(event) => setQuery(event.target.value)}
              />
              <AdminButton
                type="button"
                tone="secondary"
                onClick={() => void refresh(storefrontScope, rangeDays, query)}
              >
                Search
              </AdminButton>
            </div>
          }
        >
          <AdminTableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Signals</th>
                  <th className="px-3 py-3">Revenue</th>
                  <th className="px-3 py-3">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.contacts.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-white">{contact.name ?? contact.email}</div>
                      <div className="text-xs text-slate-500">{contact.email}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{contact.lifecycleStage}</td>
                    <td className="px-3 py-3 text-slate-400">{contact.signals.slice(0, 4).join(", ") || "-"}</td>
                    <td className="px-3 py-3 font-semibold text-white">{formatAdminMoney(contact.totalRevenueCents)}</td>
                    <td className="px-3 py-3 text-slate-400">{formatDate(contact.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        </AdminPanel>
      ) : null}

      {activeTab === "audiences" ? (
        <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
          <AdminPanel eyebrow="Builder" title="Saved audience" description="Create v1 audiences from the unified contact graph.">
            <div className="grid gap-3">
              <AdminField label="Audience name">
                <AdminInput value={audienceName} onChange={(event) => setAudienceName(event.target.value)} />
              </AdminField>
              <AdminField label="Minimum orders">
                <AdminInput
                  type="number"
                  min={0}
                  value={audienceFilters.minOrders ?? 0}
                  onChange={(event) =>
                    setAudienceFilters((current) => ({
                      ...current,
                      minOrders: Number(event.target.value) || 0,
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Newsletter consent">
                <AdminSelect
                  value={audienceFilters.newsletterConsent ?? "any"}
                  onChange={(event) =>
                    setAudienceFilters((current) => ({
                      ...current,
                      newsletterConsent: event.target.value as MccAudienceFilters["newsletterConsent"],
                    }))
                  }
                >
                  <option value="any">Any</option>
                  <option value="opted_in">Opted in</option>
                  <option value="not_opted_in">Not opted in</option>
                </AdminSelect>
              </AdminField>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={audienceFilters.hasBackInStockIntent === true}
                  onChange={(event) =>
                    setAudienceFilters((current) => ({
                      ...current,
                      hasBackInStockIntent: event.target.checked ? true : undefined,
                    }))
                  }
                />
                Back-in-stock intent
              </label>
              <AdminButton type="button" disabled={pending === "audience"} onClick={createAudience}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Save audience
              </AdminButton>
            </div>
          </AdminPanel>
          <AdminPanel eyebrow="Segments" title="Saved audiences">
            <div className="grid gap-2">
              {data.audiences.length === 0 ? <AdminEmptyState copy="No saved audiences yet." /> : null}
              {data.audiences.map((audience) => (
                <button
                  key={audience.id}
                  type="button"
                  onClick={() => setCampaignAudienceId(audience.id)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-400/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{audience.name}</div>
                    <div className="text-sm text-cyan-200">{formatNumber(audience.computedCount)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {audience.storefrontScope} · updated {formatDate(audience.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeTab === "campaigns" ? (
        <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
          <AdminPanel eyebrow="Composer" title="Campaign planner">
            <div className="grid gap-3">
              <AdminField label="Campaign name">
                <AdminInput value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </AdminField>
              <AdminField label="Audience">
                <AdminSelect value={campaignAudienceId} onChange={(event) => setCampaignAudienceId(event.target.value)}>
                  <option value="">Select audience</option>
                  {data.audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="Subject">
                <AdminInput value={campaignSubject} onChange={(event) => setCampaignSubject(event.target.value)} />
              </AdminField>
              <AdminField label="Body">
                <AdminTextarea rows={7} value={campaignBody} onChange={(event) => setCampaignBody(event.target.value)} />
              </AdminField>
              <AdminButton type="button" disabled={pending === "campaign"} onClick={createCampaign}>
                <EnvelopeIcon className="mr-2 h-4 w-4" />
                Save draft
              </AdminButton>
            </div>
          </AdminPanel>
          <AdminPanel eyebrow="Send controls" title="Campaigns">
            <div className="grid gap-3">
              <AdminField label="Selected campaign">
                <AdminSelect value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)}>
                  <option value="">Select campaign</option>
                  {data.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} · {campaign.status}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              {selectedCampaign ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold text-white">{selectedCampaign.name}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedCampaign.audienceName ?? "No audience"} · {selectedCampaign.sentCount} sent · {selectedCampaign.status}
                  </div>
                </div>
              ) : null}
              <AdminField label="Test recipient">
                <AdminInput value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} />
              </AdminField>
              <div className="flex flex-col gap-2 sm:flex-row">
                <AdminButton
                  type="button"
                  tone="secondary"
                  disabled={!data.capabilities.canSendMarketing || pending === "test"}
                  onClick={sendTest}
                >
                  Send test
                </AdminButton>
                <AdminButton
                  type="button"
                  disabled={!data.capabilities.canSendMarketing || pending === "launch"}
                  onClick={launchCampaign}
                >
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Launch confirmed send
                </AdminButton>
              </div>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeTab === "automations" ? (
        <AdminPanel eyebrow="Lifecycle" title="Automations" description="Existing growth and recovery flows are surfaced with MCC-owned automation definitions.">
          <div className="grid gap-3 lg:grid-cols-2">
            {data.automations.map((flow) => (
              <div key={flow.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{flow.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{flow.type} · {flow.storefrontScope}</div>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                    {flow.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      ) : null}

      {activeTab === "content" ? (
        <AdminPanel eyebrow="Content and offers" title="Linked marketing workspaces">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["/admin/landing-page", "Landing Page", "Merchandising sections and scheduled revisions"],
              ["/admin/discounts", "Discounts", "Promotion codes and incentive setup"],
              ["/admin/recommendations", "Recommendations", "Cross-sell and offer logic"],
              ["/admin/growth", "Growth Hub", "GrowVault content cadence and capture"],
            ].map(([href, title, description]) => (
              <Link key={href} href={href} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-400/30">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm text-slate-400">{description}</div>
              </Link>
            ))}
          </div>
        </AdminPanel>
      ) : null}

      {activeTab === "attribution" ? (
        <AdminPanel eyebrow="Measurement" title="Attribution context">
          <div className="grid gap-3 md:grid-cols-3">
            <Link href={buildScopeHref(storefrontScope, rangeDays, query)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <ChartBarSquareIcon className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 font-semibold text-white">MCC scope</div>
              <div className="mt-1 text-sm text-slate-400">{ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]}</div>
            </Link>
            <Link href="/admin/attribution" className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <FunnelIcon className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 font-semibold text-white">Attribution repair</div>
              <div className="mt-1 text-sm text-slate-400">Resolve orders missing storefront attribution.</div>
            </Link>
            <Link href="/admin/analytics" className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <UserGroupIcon className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 font-semibold text-white">Analytics</div>
              <div className="mt-1 text-sm text-slate-400">Funnel, acquisition, and storefront reporting.</div>
            </Link>
          </div>
        </AdminPanel>
      ) : null}

      {activeTab === "tasks" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminPanel eyebrow="CRM tasks" title="Open tasks">
            <div className="grid gap-2">
              {data.overview.openTasks.length === 0 ? <AdminEmptyState copy="No open CRM tasks." /> : null}
              {data.overview.openTasks.map((task) => (
                <Link key={task.id} href="/admin/customers" className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold text-white">{task.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{task.status} · due {formatDate(task.dueAt)}</div>
                </Link>
              ))}
            </div>
          </AdminPanel>
          <AdminPanel eyebrow="Timeline" title="Recent MCC activity">
            <div className="grid gap-2">
              {data.activities.length === 0 ? <AdminEmptyState copy="No MCC timeline activity yet." /> : null}
              {data.activities.map((activity) => (
                <div key={activity.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold text-white">{activity.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{activity.activityType} · {formatDate(activity.createdAt)}</div>
                  {activity.summary ? <div className="mt-2 text-sm text-slate-300">{activity.summary}</div> : null}
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>
      ) : null}
    </div>
  );
}
