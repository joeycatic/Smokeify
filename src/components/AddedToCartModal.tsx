"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { AddedItem } from "@/components/CartProvider";

type Props = {
  open: boolean;
  item: AddedItem | null;
  onClose: () => void;
};

const formatVariantLabel = (
  variant: NonNullable<AddedItem["variantChoices"]>[number]
) => {
  if (!variant.options.length) return variant.title;
  const parts = variant.options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : variant.title;
};

const isMeaningfulVariantTitle = (title: string) =>
  !/^(default|default title)$/i.test(title.trim());

export default function AddedToCartModal({ open, item, onClose }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );

  const optionGroups = useMemo(() => {
    if (!item?.variantChoices || item.variantChoices.length !== 1) return [];
    const options = item.variantChoices[0]?.options ?? [];
    const groups = new Map<string, Set<string>>();
    options.forEach((option) => {
      if (!option?.name || !option?.value) return;
      const set = groups.get(option.name) ?? new Set<string>();
      set.add(option.value);
      groups.set(option.name, set);
    });
    return Array.from(groups.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }, [item?.variantChoices]);

  const hasOptionGroups = optionGroups.length > 0;

  const needsVariantSelection = Boolean(
    item?.variantChoices &&
      item.confirmAdd &&
      (hasOptionGroups ||
        item.variantChoices.some(
          (choice) =>
            choice.options.length > 0 || isMeaningfulVariantTitle(choice.title)
        ))
  );

  useEffect(() => {
    if (!open) return;
    setVariantError(null);
    setConfirming(false);
    setConfirmed(false);
    setSelectedLabel(null);
    setSelectedOptions({});
    if (item?.variantChoices?.length) {
      const firstAvailable =
        item.variantChoices.find((choice) => choice.available)?.id ??
        item.variantChoices[0]?.id ??
        null;
      setSelectedVariantId(firstAvailable);
    } else {
      setSelectedVariantId(null);
    }
    if (optionGroups.length > 0) {
      const defaults: Record<string, string> = {};
      optionGroups.forEach((group) => {
        if (group.values.length > 0) {
          defaults[group.name] = group.values[0];
        }
      });
      setSelectedOptions(defaults);
    }
  }, [open, item, optionGroups]);

  const variantLabelMap = useMemo(() => {
    if (!item?.variantChoices) return new Map<string, string>();
    return new Map(
      item.variantChoices.map((variant) => [variant.id, formatVariantLabel(variant)])
    );
  }, [item?.variantChoices]);

  if (!open || !item) return null;

  const displayTitle = selectedLabel ? `${item.title} · ${selectedLabel}` : item.title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">
              {needsVariantSelection && !confirmed
                ? "Option auswählen"
                : "Artikel in den Warenkorb gelegt"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-stone-500 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.imageAlt ?? item.title}
              className="h-20 w-20 rounded-md object-cover"
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
            />
          ) : (
            <div className="h-20 w-20 rounded-md bg-stone-100" />
          )}
          <div className="text-sm text-stone-700">
            <div className="font-semibold text-stone-900">{displayTitle}</div>
            <div>Menge: {item.quantity}</div>
          </div>
        </div>

        {needsVariantSelection && !confirmed && item.variantChoices && (
          <div className="mt-5 rounded-xl border border-black/5 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-800">
              Bitte eine Option auswählen
            </p>
            {hasOptionGroups ? (
              <div className="mt-3 space-y-3">
                {optionGroups.map((group) => (
                  <div key={group.name}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {group.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.values.map((value) => {
                        const selected = selectedOptions[group.name] === value;
                        return (
                          <button
                            key={`${group.name}-${value}`}
                            type="button"
                            onClick={() =>
                              setSelectedOptions((prev) => ({
                                ...prev,
                                [group.name]: value,
                              }))
                            }
                            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                              selected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300"
                            }`}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {item.variantChoices.map((choice) => (
                  <label
                    key={choice.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                      choice.available
                        ? "border-stone-200 hover:border-emerald-300"
                        : "border-stone-200 bg-stone-100 text-stone-400"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variant-choice"
                        value={choice.id}
                        disabled={!choice.available}
                        checked={selectedVariantId === choice.id}
                        onChange={() => setSelectedVariantId(choice.id)}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <span>{formatVariantLabel(choice)}</span>
                    </span>
                    {!choice.available && (
                      <span className="text-xs">Ausverkauft</span>
                    )}
                  </label>
                ))}
              </div>
            )}
            {variantError && (
              <p className="mt-3 text-xs text-red-600">{variantError}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={
                  confirming ||
                  (hasOptionGroups
                    ? optionGroups.some(
                        (group) => !selectedOptions[group.name]
                      )
                    : !selectedVariantId)
                }
                onClick={async () => {
                  if (!item.confirmAdd) return;
                  setConfirming(true);
                  setVariantError(null);
                  const variantId =
                    selectedVariantId ?? item.variantChoices?.[0]?.id ?? null;
                  if (!variantId) {
                    setConfirming(false);
                    setVariantError("Variante konnte nicht bestimmt werden.");
                    return;
                  }
                  const options = hasOptionGroups
                    ? optionGroups
                        .map((group) => ({
                          name: group.name,
                          value: selectedOptions[group.name],
                        }))
                        .filter((opt) => opt.value)
                    : undefined;
                  const label = hasOptionGroups
                    ? options?.map((opt) => `${opt.name}: ${opt.value}`).join(" · ")
                    : variantLabelMap.get(variantId) ?? null;
                  const ok = await item.confirmAdd({
                    variantId,
                    label: label ?? undefined,
                    options,
                  });
                  setConfirming(false);
                  if (!ok) {
                    setVariantError("Artikel konnte nicht hinzugefügt werden.");
                    return;
                  }
                  setSelectedLabel(label ?? null);
                  setConfirmed(true);
                  onClose();
                }}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                In den Warenkorb
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
