"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import {
  RECOMMENDATION_RULE_TARGET_LABELS,
  RECOMMENDATION_RULE_TARGET_OPTIONS,
  RECOMMENDATION_RULE_TRIGGER_LABELS,
  RECOMMENDATION_RULE_TRIGGER_OPTIONS,
  type RecommendationRuleTargetCode,
  type RecommendationRuleTriggerCode,
} from "@/lib/recommendationConfig";

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  triggerType: RecommendationRuleTriggerCode;
  triggerValue: string;
  targetType: RecommendationRuleTargetCode;
  targetValue: string;
  priority: number;
  maxProducts: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = {
  id: string;
  name: string;
  handle: string;
};

type ProductSearchResult = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
};

type ExplainResponse = {
  product: {
    id: string;
    title: string;
    handle: string;
    tags: string[];
    productGroup: string | null;
    categories: Array<{ id: string; handle: string; name: string }>;
  };
  matchedRules: Array<{
    id: string;
    name: string;
    triggerType: RecommendationRuleTriggerCode;
    triggerValue: string;
    targetType: RecommendationRuleTargetCode;
    targetValue: string;
    priority: number;
    matched: boolean;
  }>;
  legacyManualOverrides: Array<{
    id: string;
    title: string;
    handle: string;
    sortOrder: number;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
    imageAlt: string | null;
    price: { amount: string; currencyCode: string } | null;
    variantId: string | null;
    availableForSale: boolean;
    reasons: Array<{ label: string; detail: string; sourceType: string }>;
    score: number;
  }>;
};

type Props = {
  initialRules: RuleRow[];
  categories: CategoryOption[];
  productGroups: string[];
  tags: string[];
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  triggerType: RecommendationRuleTriggerCode;
  triggerValue: string;
  targetType: RecommendationRuleTargetCode;
  targetValue: string;
  priority: string;
  maxProducts: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  description: "",
  triggerType: "CATEGORY",
  triggerValue: "",
  targetType: "TAG",
  targetValue: "",
  priority: "0",
  maxProducts: "",
  isActive: true,
};

export default function AdminRecommendationsClient({
  initialRules,
  categories,
  productGroups,
  tags,
}: Props) {
  const [rules, setRules] = useState(initialRules);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [explainData, setExplainData] = useState<ExplainResponse | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState("");

  const activeRuleCount = rules.filter((rule) => rule.isActive).length;

  const suggestionValues = useMemo(() => {
    const resolveValues = (type: RecommendationRuleTriggerCode | RecommendationRuleTargetCode) => {
      if (type === "CATEGORY") return categories.map((category) => category.handle);
      if (type === "PRODUCT_GROUP") return productGroups;
      return tags;
    };

    return {
      trigger: resolveValues(form.triggerType),
      target: resolveValues(form.targetType),
    };
  }, [categories, form.targetType, form.triggerType, productGroups, tags]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/products/search?q=${encodeURIComponent(search.trim())}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ProductSearchResult[];
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const loadExplanation = async (product: ProductSearchResult) => {
    setSelectedProduct(product);
    setExplainData(null);
    setExplainError("");
    setExplaining(true);

    try {
      const response = await fetch(
        `/api/admin/recommendations/explain?productId=${encodeURIComponent(product.id)}`,
      );
      const data = (await response.json()) as ExplainResponse & { error?: string };
      if (!response.ok) {
        setExplainError(data.error ?? "Failed to load recommendation explanation.");
        return;
      }
      setExplainData(data);
    } catch {
      setExplainError("Failed to load recommendation explanation.");
    } finally {
      setExplaining(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const beginEdit = (rule: RuleRow) => {
    setForm({
      id: rule.id,
      name: rule.name,
      description: rule.description ?? "",
      triggerType: rule.triggerType,
      triggerValue: rule.triggerValue,
      targetType: rule.targetType,
      targetValue: rule.targetValue,
      priority: String(rule.priority),
      maxProducts: rule.maxProducts ? String(rule.maxProducts) : "",
      isActive: rule.isActive,
    });
    setMessage("");
    setError("");
  };

  const submitRule = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        name: form.name,
        description: form.description,
        triggerType: form.triggerType,
        triggerValue: form.triggerValue,
        targetType: form.targetType,
        targetValue: form.targetValue,
        priority: form.priority,
        maxProducts: form.maxProducts,
        isActive: form.isActive,
      };

      const response = await fetch(
        form.id ? `/api/admin/recommendations/rules/${form.id}` : "/api/admin/recommendations/rules",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string; rule?: RuleRow };
      if (!response.ok || !data.rule) {
        setError(data.error ?? "Failed to save recommendation rule.");
        return;
      }

      setRules((prev) => {
        const next = form.id
          ? prev.map((rule) => (rule.id === data.rule?.id ? data.rule : rule))
          : [data.rule!, ...prev];
        return [...next].sort((left, right) => {
          if (left.priority !== right.priority) return right.priority - left.priority;
          return left.createdAt.localeCompare(right.createdAt);
        });
      });
      setMessage(form.id ? "Recommendation rule updated." : "Recommendation rule created.");
      resetForm();
    } catch {
      setError("Failed to save recommendation rule.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (rule: RuleRow) => {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/recommendations/rules/${rule.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to delete recommendation rule.");
        return;
      }
      setRules((prev) => prev.filter((entry) => entry.id !== rule.id));
      if (form.id === rule.id) {
        resetForm();
      }
      setMessage("Recommendation rule deleted.");
    } catch {
      setError("Failed to delete recommendation rule.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Recommendations"
        title="Recommendation control center"
        description="Manage centralized recommendation rules, keep product tags and product groups as the scalable matching layer, and continue using product-level cross-sells only for manual exceptions."
        metrics={
          <div className="grid gap-3 md:grid-cols-4">
            <AdminMetricCard label="Rules" value={String(rules.length)} detail="Centralized recommendation rules" />
            <AdminMetricCard label="Active" value={String(activeRuleCount)} detail="Currently participating in matching" />
            <AdminMetricCard label="Category handles" value={String(categories.length)} detail="Available rule trigger and target values" />
            <AdminMetricCard label="Known tags" value={String(tags.length)} detail="Existing product tags available for rules" />
          </div>
        }
      />

      {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          eyebrow="Central rules"
          title="Recommendation rules"
          description="These rules generate most product recommendations. Manual product cross-sells remain the override layer for exceptions."
        >
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-2xl border border-white/10 bg-[#070a0f] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          rule.isActive
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {RECOMMENDATION_RULE_TRIGGER_LABELS[rule.triggerType]} &quot;{rule.triggerValue}
                      &quot; {"->"} {RECOMMENDATION_RULE_TARGET_LABELS[rule.targetType]} &quot;
                      {rule.targetValue}&quot;
                    </p>
                    {rule.description ? (
                      <p className="mt-2 text-xs text-slate-500">{rule.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton tone="secondary" onClick={() => beginEdit(rule)}>
                      Edit
                    </AdminButton>
                    <AdminButton tone="danger" onClick={() => void deleteRule(rule)}>
                      Delete
                    </AdminButton>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>Priority: {rule.priority}</span>
                  <span>Max products: {rule.maxProducts ?? "default"}</span>
                  <span>Updated: {new Date(rule.updatedAt).toLocaleString("de-DE")}</span>
                </div>
              </div>
            ))}

            {rules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-sm text-slate-500">
                No recommendation rules yet. Create the first rule on the right.
              </div>
            ) : null}
          </div>
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel
            eyebrow="Rule editor"
            title={form.id ? "Edit rule" : "Create rule"}
            description="Use category handles, product tags, or product groups as the matching layer. This keeps recommendation logic centralized instead of maintaining every link product-by-product."
          >
            <div className="space-y-4">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Name
                <div className="mt-2">
                  <AdminInput
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Tent -> LED"
                  />
                </div>
              </label>

              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Description
                <div className="mt-2">
                  <AdminTextarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Recommend fitting LED fixtures for all grow tents."
                  />
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Trigger type
                  <div className="mt-2">
                    <AdminSelect
                      value={form.triggerType}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          triggerType: event.target.value as RecommendationRuleTriggerCode,
                        }))
                      }
                    >
                      {RECOMMENDATION_RULE_TRIGGER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Trigger value
                  <div className="mt-2">
                    <AdminInput
                      list="recommendation-trigger-values"
                      value={form.triggerValue}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, triggerValue: event.target.value }))
                      }
                      placeholder="zelte or tent-80x80"
                    />
                    <datalist id="recommendation-trigger-values">
                      {suggestionValues.trigger.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Target type
                  <div className="mt-2">
                    <AdminSelect
                      value={form.targetType}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          targetType: event.target.value as RecommendationRuleTargetCode,
                        }))
                      }
                    >
                      {RECOMMENDATION_RULE_TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Target value
                  <div className="mt-2">
                    <AdminInput
                      list="recommendation-target-values"
                      value={form.targetValue}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, targetValue: event.target.value }))
                      }
                      placeholder="licht or lighting-accessory"
                    />
                    <datalist id="recommendation-target-values">
                      {suggestionValues.target.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Priority
                  <div className="mt-2">
                    <AdminInput
                      value={form.priority}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                      placeholder="0"
                    />
                  </div>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Max products
                  <div className="mt-2">
                    <AdminInput
                      value={form.maxProducts}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, maxProducts: event.target.value }))
                      }
                      placeholder="optional"
                    />
                  </div>
                </label>

                <label className="flex items-center gap-3 pt-7 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <AdminButton onClick={() => void submitRule()} disabled={saving}>
                  {saving ? "Saving..." : form.id ? "Update rule" : "Create rule"}
                </AdminButton>
                <AdminButton tone="secondary" onClick={resetForm}>
                  Reset
                </AdminButton>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            eyebrow="Manual exceptions"
            title="Per-product overrides"
            description="Legacy product cross-sells remain the manual override layer. Use them only for exceptions or hero products, not for broad recommendation maintenance."
          >
            <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-4 text-sm text-slate-400">
              Edit manual overrides from the existing product editor in the <strong className="text-slate-200">Cross-sells</strong> section. The centralized rule engine reads those first and then fills the remaining slots from matching rules.
            </div>
          </AdminPanel>
        </div>
      </div>

      <AdminPanel
        eyebrow="Recommendation explorer"
        title="Explain recommendations for a product"
        description="Search for a product, then inspect the final recommendation list, matched rules, and manual overrides used to build it."
      >
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Product search
              <div className="mt-2">
                <AdminInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by product title"
                />
              </div>
            </label>

            {searching ? <p className="text-sm text-slate-500">Searching...</p> : null}

            <div className="space-y-2">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => void loadExplanation(result)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3 text-left hover:border-cyan-400/20 hover:bg-cyan-400/5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{result.title}</div>
                    <div className="truncate text-xs text-slate-500">/{result.handle}</div>
                  </div>
                  <span className="text-xs font-semibold text-cyan-200">Inspect</span>
                </button>
              ))}
            </div>

            {selectedProduct ? (
              <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Selected product
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedProduct.title}</div>
                <div className="mt-1 text-xs text-slate-500">/{selectedProduct.handle}</div>
                <Link
                  href={`/admin/catalog/${selectedProduct.id}`}
                  className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  Open product editor
                </Link>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {explaining ? <p className="text-sm text-slate-500">Loading recommendation explanation...</p> : null}
            {explainError ? <AdminNotice tone="error">{explainError}</AdminNotice> : null}

            {explainData ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Categories
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {explainData.product.categories.map((category) => category.handle).join(", ") || "None"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Tags
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {explainData.product.tags.join(", ") || "None"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Product group
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {explainData.product.productGroup || "None"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Matched rules
                  </div>
                  <div className="mt-3 space-y-2">
                    {explainData.matchedRules.filter((rule) => rule.matched).map((rule) => (
                      <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="text-sm font-semibold text-white">{rule.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {RECOMMENDATION_RULE_TRIGGER_LABELS[rule.triggerType]} &quot;{rule.triggerValue}
                          &quot; {"->"} {RECOMMENDATION_RULE_TARGET_LABELS[rule.targetType]} &quot;
                          {rule.targetValue}&quot;
                        </div>
                      </div>
                    ))}
                    {explainData.matchedRules.filter((rule) => rule.matched).length === 0 ? (
                      <div className="text-sm text-slate-500">No active centralized rules matched this product.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Manual overrides
                  </div>
                  <div className="mt-3 space-y-2">
                    {explainData.legacyManualOverrides.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          /{item.handle} | Position {item.sortOrder + 1}
                        </div>
                      </div>
                    ))}
                    {explainData.legacyManualOverrides.length === 0 ? (
                      <div className="text-sm text-slate-500">No manual product overrides are set.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Final recommendation order
                  </div>
                  <div className="mt-3 space-y-2">
                    {explainData.recommendations.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{item.title}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              /{item.handle} | Score {item.score}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.price
                              ? `${item.price.amount} ${item.price.currencyCode}`
                              : "No price"}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.reasons.map((reason, index) => (
                            <span
                              key={`${item.id}-${reason.label}-${index}`}
                              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-200"
                              title={reason.detail}
                            >
                              {reason.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {explainData.recommendations.length === 0 ? (
                      <div className="text-sm text-slate-500">No recommendations resolved for this product.</div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
