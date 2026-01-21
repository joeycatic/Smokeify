"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import RichTextEditor from "@/components/admin/RichTextEditor";

type ImageItem = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
};

type VariantOption = { id: string; name: string; value: string };

type VariantItem = {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
  costCents: number;
  lowStockThreshold: number;
  compareAtCents: number | null;
  position: number;
  options: VariantOption[];
  inventory: { quantityOnHand: number; reserved: number } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
};

type ProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  manufacturer: string | null;
  supplier: string | null;
  leadTimeDays: number | null;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  shippingClass: string | null;
  tags: string[];
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  images: ImageItem[];
  variants: VariantItem[];
  categories: { category: CategoryRow }[];
  collections: { collection: CategoryRow }[];
};

type Props = {
  product: ProductDetail;
  categories: CategoryRow[];
  collections: CategoryRow[];
};

const STATUS_OPTIONS: ProductDetail["status"][] = ["DRAFT", "ACTIVE", "ARCHIVED"];

const toEuro = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2);

const parseEuro = (value: string) => {
  const normalized = value.replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
};

export default function AdminProductClient({
  product,
  categories,
  collections,
}: Props) {
  const [details, setDetails] = useState({
    title: product.title,
    handle: product.handle,
    description: product.description ?? "",
    manufacturer: product.manufacturer ?? "",
    supplier: product.supplier ?? "",
    leadTimeDays: product.leadTimeDays ?? "",
    weightGrams: product.weightGrams ?? "",
    lengthMm: product.lengthMm ?? "",
    widthMm: product.widthMm ?? "",
    heightMm: product.heightMm ?? "",
    shippingClass: product.shippingClass ?? "",
    tags: (product.tags ?? []).join(", "),
    status: product.status,
  });
  const [images, setImages] = useState<ImageItem[]>(product.images);
  const [uploading, setUploading] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [variants, setVariants] = useState<VariantItem[]>(product.variants);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.variants.forEach((variant) => {
      initial[variant.id] = toEuro(variant.priceCents);
    });
    return initial;
  });
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.variants.forEach((variant) => {
      initial[variant.id] = toEuro(variant.costCents);
    });
    return initial;
  });
  const [compareDrafts, setCompareDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.variants.forEach((variant) => {
      initial[variant.id] = toEuro(variant.compareAtCents);
    });
    return initial;
  });
  const [categoryIds, setCategoryIds] = useState(
    new Set(product.categories.map((item) => item.category.id))
  );
  const [collectionIds, setCollectionIds] = useState(
    new Set(product.collections.map((item) => item.collection.id))
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shippingOpen, setShippingOpen] = useState(false);
  const [handleError, setHandleError] = useState("");

  const [newImage, setNewImage] = useState({
    url: "",
    altText: "",
    position: 0,
  });

  const [newVariant, setNewVariant] = useState({
    title: "",
    sku: "",
    price: "",
    cost: "",
    compareAt: "",
    position: 0,
    lowStockThreshold: 5,
    options: [{ name: "", value: "" }],
  });

  const saveDetails = async () => {
    setMessage("");
    setError("");
    setHandleError("");
    try {
      const tags = details.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const toNumberOrNull = (value: number | string) =>
        value === "" ? null : Number(value);
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          tags,
          leadTimeDays: toNumberOrNull(details.leadTimeDays),
          weightGrams: toNumberOrNull(details.weightGrams),
          lengthMm: toNumberOrNull(details.lengthMm),
          widthMm: toNumberOrNull(details.widthMm),
          heightMm: toNumberOrNull(details.heightMm),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const errorMessage = data.error ?? "Update failed";
        setError(errorMessage);
        if (errorMessage.toLowerCase().includes("handle")) {
          setHandleError(errorMessage);
        }
        return;
      }
      setMessage("Product updated");
    } catch {
      setError("Update failed");
    }
  };

  const saveCategories = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/products/${product.id}/categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: Array.from(categoryIds) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        return;
      }
      setMessage("Categories updated");
    } catch {
      setError("Update failed");
    }
  };

  const saveCollections = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/products/${product.id}/collections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds: Array.from(collectionIds) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        return;
      }
      setMessage("Collections updated");
    } catch {
      setError("Update failed");
    }
  };

  const createImage = async (payload: {
    url: string;
    altText: string | null;
    position: number;
  }) => {
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { image?: ImageItem; error?: string };
    const image = data.image;
    if (!res.ok || !image) {
      setError(data.error ?? "Add image failed");
      return null;
    }
    setImages((prev) => [...prev, image]);
    return image;
  };

  const addImage = async () => {
    if (!newImage.url.trim()) {
      setError("Image URL is required");
      return;
    }
    setMessage("");
    setError("");
    const created = await createImage({
      url: newImage.url,
      altText: newImage.altText,
      position: Number(newImage.position) || 0,
    });
    if (!created) return;
    setNewImage({ url: "", altText: "", position: 0 });
    setMessage("Image added");
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMessage("");
    setError("");
    setUploading(true);
    let position = images.length;
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/uploads", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setError(data.error ?? "Upload failed");
          return;
        }
        const created = await createImage({
          url: data.url,
          altText: file.name,
          position,
        });
        if (!created) {
          return;
        }
        position += 1;
      }
      setMessage("Images uploaded");
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateImage = async (image: ImageItem) => {
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: image.url,
        altText: image.altText,
        position: Number(image.position) || 0,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Update failed");
      return;
    }
    setMessage("Image updated");
  };

  const saveImageOrder = async (items: ImageItem[]) => {
    setMessage("");
    setError("");
    setReordering(true);
    try {
      await Promise.all(
        items.map((image) =>
          fetch(`/api/admin/images/${image.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: image.position }),
          })
        )
      );
      setMessage("Image order updated");
    } catch {
      setError("Reorder failed");
    } finally {
      setReordering(false);
    }
  };

  const reorderImages = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setImages((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((img) => img.id === sourceId);
      const targetIndex = next.findIndex((img) => img.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const positioned = next.map((img, index) => ({
        ...img,
        position: index,
      }));
      void saveImageOrder(positioned);
      return positioned;
    });
  };

  const deleteImage = async (id: string) => {
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/images/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== id));
    setMessage("Image deleted");
  };

  const updateVariant = async (variant: VariantItem) => {
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/variants/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: variant.title,
        sku: variant.sku,
        priceCents: variant.priceCents,
        costCents: variant.costCents,
        compareAtCents: variant.compareAtCents,
        position: variant.position,
        lowStockThreshold: variant.lowStockThreshold,
        options: variant.options.map((opt) => ({
          name: opt.name,
          value: opt.value,
        })),
        inventory: {
          quantityOnHand: variant.inventory?.quantityOnHand ?? 0,
          reserved: variant.inventory?.reserved ?? 0,
        },
      }),
    });
    if (!res.ok) {
      let message = "Update failed";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        // Keep default message when response isn't JSON.
      }
      setError(message);
      return;
    }
    setMessage("Variant updated");
  };

  const deleteVariant = async (id: string) => {
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/variants/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setVariants((prev) => prev.filter((item) => item.id !== id));
    setMessage("Variant deleted");
  };

  const addVariant = async () => {
    const priceCents = parseEuro(newVariant.price);
    const costCents = newVariant.cost ? parseEuro(newVariant.cost) : 0;
    if (!newVariant.title.trim()) {
      setError("Variant title is required");
      return;
    }
    if (priceCents === null) {
      setError("Variant price is required");
      return;
    }
    if (newVariant.cost && costCents === null) {
      setError("Variant cost is invalid");
      return;
    }
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/products/${product.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newVariant.title,
        sku: newVariant.sku,
        priceCents,
        costCents: costCents ?? 0,
        compareAtCents: newVariant.compareAt ? parseEuro(newVariant.compareAt) : null,
        position: Number(newVariant.position) || 0,
        lowStockThreshold: Number(newVariant.lowStockThreshold) || 0,
        options: newVariant.options.filter((opt) => opt.name && opt.value),
      }),
    });
    const data = (await res.json()) as { variant?: VariantItem; error?: string };
    const variant = data.variant;
    if (!res.ok || !variant) {
      setError(data.error ?? "Add variant failed");
      return;
    }
    setVariants((prev) => [...prev, variant]);
    setNewVariant({
      title: "",
      sku: "",
      price: "",
      cost: "",
      compareAt: "",
      position: 0,
      lowStockThreshold: 5,
      options: [{ name: "", value: "" }],
    });
    setMessage("Variant added");
  };

  const variantRows = useMemo(
    () =>
      variants.map((variant) => ({
        ...variant,
        available: Math.max(
          0,
          (variant.inventory?.quantityOnHand ?? 0) -
            (variant.inventory?.reserved ?? 0)
        ),
      })),
    [variants]
  );

  useEffect(() => {
    setPriceDrafts((prev) => {
      const next = { ...prev };
      variants.forEach((variant) => {
        if (!(variant.id in next)) {
          next[variant.id] = toEuro(variant.priceCents);
        }
      });
      return next;
    });
    setCostDrafts((prev) => {
      const next = { ...prev };
      variants.forEach((variant) => {
        if (!(variant.id in next)) {
          next[variant.id] = toEuro(variant.costCents);
        }
      });
      return next;
    });
    setCompareDrafts((prev) => {
      const next = { ...prev };
      variants.forEach((variant) => {
        if (!(variant.id in next)) {
          next[variant.id] = toEuro(variant.compareAtCents);
        }
      });
      return next;
    });
  }, [variants]);

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              CATALOG / PRODUCT
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{product.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {product.status}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Updated {new Date(product.updatedAt).toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <Link
              href="/admin/catalog"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
            >
              Back to catalog
            </Link>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">01</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Details</p>
              <p className="text-xs text-stone-500">Core product information.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Title
            <input
              value={details.title}
              onChange={(event) =>
                setDetails((prev) => ({ ...prev, title: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Handle
            <input
              value={details.handle}
              onChange={(event) => {
                setHandleError("");
                setDetails((prev) => ({ ...prev, handle: event.target.value }));
              }}
              className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
            />
            {handleError && (
              <span className="mt-1 block text-[11px] font-medium text-red-600">
                {handleError}
              </span>
            )}
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold text-stone-600">
          Manufacturer
          <input
            value={details.manufacturer}
            onChange={(event) =>
              setDetails((prev) => ({ ...prev, manufacturer: event.target.value }))
            }
            placeholder="e.g. AC Infinity"
            className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
          />
        </label>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Supplier
            <input
              value={details.supplier}
              onChange={(event) =>
                setDetails((prev) => ({ ...prev, supplier: event.target.value }))
              }
              placeholder="e.g. Primary distributor"
              className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Lead time (days)
            <input
              type="number"
              min={0}
              value={details.leadTimeDays}
              onChange={(event) =>
                setDetails((prev) => ({
                  ...prev,
                  leadTimeDays: event.target.value === "" ? "" : Number(event.target.value),
                }))
              }
              placeholder="e.g. 3"
              className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-[#2f3e36]/10 bg-[#f8fbf6] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#2f3e36]">
              Shipping & dimensions
            </p>
            <button
              type="button"
              onClick={() => setShippingOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2f3e36]/20 text-[#2f3e36] transition hover:border-[#2f3e36]/40"
              aria-label={
                shippingOpen ? "Collapse shipping & dimensions" : "Expand shipping & dimensions"
              }
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${shippingOpen ? "rotate-180" : "rotate-0"}`}
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {shippingOpen && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-stone-600">
                Weight (g)
                <input
                  type="number"
                  min={0}
                  value={details.weightGrams}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      weightGrams:
                        event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 1200"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Shipping class
                <input
                  value={details.shippingClass}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      shippingClass: event.target.value,
                    }))
                  }
                  placeholder="e.g. bulky"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Length (mm)
                <input
                  type="number"
                  min={0}
                  value={details.lengthMm}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      lengthMm:
                        event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 600"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Width (mm)
                <input
                  type="number"
                  min={0}
                  value={details.widthMm}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      widthMm:
                        event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 400"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Height (mm)
                <input
                  type="number"
                  min={0}
                  value={details.heightMm}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      heightMm:
                        event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 300"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
            </div>
          )}
        </div>
        <label className="mt-3 block text-xs font-semibold text-stone-600">
          Tags
          <input
            value={details.tags}
            onChange={(event) =>
              setDetails((prev) => ({ ...prev, tags: event.target.value }))
            }
            placeholder="e.g. led, premium, grow"
            className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
          />
          <span className="mt-1 block text-[11px] text-stone-500">
            Separate tags with commas.
          </span>
        </label>
        <div className="mt-3">
          <p className="text-xs font-semibold text-stone-600">Description</p>
          <RichTextEditor
            value={details.description}
            onChange={(next) =>
              setDetails((prev) => ({ ...prev, description: next }))
            }
            placeholder="Write a short, clear product description."
          />
          <p className="mt-2 text-[11px] text-stone-500">
            Use the toolbar to format text. Links and headings are supported.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={details.status}
            onChange={(event) =>
              setDetails((prev) => ({
                ...prev,
                status: event.target.value as ProductDetail["status"],
              }))
            }
            className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveDetails}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white transition hover:bg-[#24312b]"
          >
            Save details
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">02</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Categories & collections</p>
            <p className="text-xs text-stone-500">Organize where this product appears.</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-2">Categories</p>
            <div className="grid gap-2">
              {categories.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categoryIds.has(item.id)}
                    onChange={() => {
                      setCategoryIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) {
                          next.delete(item.id);
                        } else {
                          next.add(item.id);
                        }
                        return next;
                      });
                    }}
                  />
                  {item.name}
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-stone-500">No categories yet.</p>
              )}
            </div>
            <button
              type="button"
              onClick={saveCategories}
              className="mt-3 h-10 rounded-md border border-[#2f3e36]/20 px-3 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
            >
              Save categories
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-600 mb-2">Collections</p>
            <div className="grid gap-2">
              {collections.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={collectionIds.has(item.id)}
                    onChange={() => {
                      setCollectionIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) {
                          next.delete(item.id);
                        } else {
                          next.add(item.id);
                        }
                        return next;
                      });
                    }}
                  />
                  {item.name}
                </label>
              ))}
              {collections.length === 0 && (
                <p className="text-xs text-stone-500">No collections yet.</p>
              )}
            </div>
            <button
              type="button"
              onClick={saveCollections}
              className="mt-3 h-10 rounded-md border border-[#2f3e36]/20 px-3 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
            >
              Save collections
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(56,189,248,0.14)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">03</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Images</p>
            <p className="text-xs text-stone-500">Upload, reorder, and describe media.</p>
          </div>
        </div>
        <div className="rounded-md border border-dashed border-[#2f3e36]/20 bg-[#f8fbf6] px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-stone-600">Upload images</p>
          <p className="mt-1 text-xs text-stone-500">
            JPG, PNG, or WEBP up to 5MB. Stored locally in `public/uploads`.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => uploadImages(event.target.files)}
            disabled={uploading}
            className="mt-3 block w-full text-sm"
          />
          {uploading && (
            <p className="mt-2 text-xs text-stone-500">Uploading...</p>
          )}
        </div>
        <p className="mb-3 text-xs text-stone-500">
          Drag and drop rows to reorder images.
        </p>
        <div className="space-y-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="grid gap-3 md:grid-cols-[1.4fr_1fr_120px_auto_auto] rounded-lg border border-black/10 bg-white p-3"
              draggable
              onDragStart={() => setDraggingImageId(image.id)}
              onDragEnd={() => setDraggingImageId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingImageId) {
                  reorderImages(draggingImageId, image.id);
                }
              }}
            >
              <div className="md:col-span-5 flex items-center gap-2 text-xs text-stone-500">
                <span className="cursor-grab select-none">⠿</span>
                {reordering && <span>Saving order…</span>}
              </div>
              <input
                value={image.url}
                onChange={(event) =>
                  setImages((prev) =>
                    prev.map((item) =>
                      item.id === image.id
                        ? { ...item, url: event.target.value }
                        : item
                    )
                  )
                }
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={image.altText ?? ""}
                onChange={(event) =>
                  setImages((prev) =>
                    prev.map((item) =>
                      item.id === image.id
                        ? { ...item, altText: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Alt text"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                type="number"
                value={image.position}
                onChange={(event) =>
                  setImages((prev) =>
                    prev.map((item) =>
                      item.id === image.id
                        ? { ...item, position: Number(event.target.value) }
                        : item
                    )
                  )
                }
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => updateImage(image)}
                className="h-10 rounded-md border border-black/15 px-3 text-xs font-semibold"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => deleteImage(image.id)}
                className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
          {images.length === 0 && (
            <p className="text-xs text-stone-500">No images yet.</p>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_120px_auto]"
        >
          <input
            value={newImage.url}
            onChange={(event) =>
              setNewImage((prev) => ({ ...prev, url: event.target.value }))
            }
            placeholder="Image URL"
            className="h-10 rounded-md border border-black/15 px-3 text-sm"
          />
          <input
            value={newImage.altText}
            onChange={(event) =>
              setNewImage((prev) => ({ ...prev, altText: event.target.value }))
            }
            placeholder="Alt text"
            className="h-10 rounded-md border border-black/15 px-3 text-sm"
          />
          <input
            type="number"
            value={newImage.position}
            onChange={(event) =>
              setNewImage((prev) => ({
                ...prev,
                position: Number(event.target.value),
              }))
            }
            className="h-10 rounded-md border border-black/15 px-3 text-sm"
          />
          <button
            type="button"
            onClick={addImage}
            className="h-10 rounded-md bg-[#2f3e36] px-3 text-xs font-semibold text-white hover:bg-[#24312b]"
          >
            Add image
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(167,139,250,0.18)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">04</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Variants & stock</p>
            <p className="text-xs text-stone-500">Pricing, inventory, and options.</p>
          </div>
        </div>
        <div className="space-y-6">
          {variantRows.map((variant) => (
            <div
              key={variant.id}
              className="rounded-lg border border-[#2f3e36]/10 bg-[#f6f9f4] p-4"
            >
              <div className="flex flex-col gap-4">
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,140px)_minmax(0,140px)]">
                  <label className="text-xs font-semibold text-stone-600">
                    Variant name
                    <input
                      value={variant.title}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? { ...item, title: event.target.value }
                              : item
                          )
                        )
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    SKU (optional)
                    <input
                      value={variant.sku ?? ""}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? { ...item, sku: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="e.g. GROW-LED-300"
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Price (EUR)
                    <input
                      value={priceDrafts[variant.id] ?? ""}
                      onChange={(event) =>
                        setPriceDrafts((prev) => ({
                          ...prev,
                          [variant.id]: event.target.value,
                        }))
                      }
                      onBlur={() => {
                        const value = priceDrafts[variant.id] ?? "";
                        const parsed = parseEuro(value);
                        if (parsed === null) {
                          setPriceDrafts((prev) => ({
                            ...prev,
                            [variant.id]: toEuro(variant.priceCents),
                          }));
                          return;
                        }
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? { ...item, priceCents: parsed }
                              : item
                          )
                        );
                        setPriceDrafts((prev) => ({
                          ...prev,
                          [variant.id]: toEuro(parsed),
                        }));
                      }}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                    {!((priceDrafts[variant.id] ?? "").trim()) && (
                      <span className="mt-1 block text-[11px] font-medium text-red-600">
                        Price required
                      </span>
                    )}
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Cost (EUR)
                    <input
                      value={costDrafts[variant.id] ?? ""}
                      onChange={(event) =>
                        setCostDrafts((prev) => ({
                          ...prev,
                          [variant.id]: event.target.value,
                        }))
                      }
                      onBlur={() => {
                        const value = costDrafts[variant.id] ?? "";
                        if (value.trim() === "") {
                          setVariants((prev) =>
                            prev.map((item) =>
                              item.id === variant.id
                                ? { ...item, costCents: 0 }
                                : item
                            )
                          );
                          return;
                        }
                        const parsed = parseEuro(value);
                        if (parsed === null) {
                          setCostDrafts((prev) => ({
                            ...prev,
                            [variant.id]: toEuro(variant.costCents),
                          }));
                          return;
                        }
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? { ...item, costCents: parsed }
                              : item
                          )
                        );
                        setCostDrafts((prev) => ({
                          ...prev,
                          [variant.id]: toEuro(parsed),
                        }));
                      }}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,140px)_minmax(0,140px)_minmax(0,140px)]">
                    <label className="text-xs font-semibold text-stone-600">
                      Compare at
                      <input
                        value={compareDrafts[variant.id] ?? ""}
                        onChange={(event) =>
                          setCompareDrafts((prev) => ({
                            ...prev,
                            [variant.id]: event.target.value,
                          }))
                        }
                        onBlur={() => {
                          const value = compareDrafts[variant.id] ?? "";
                          if (value.trim() === "") {
                            setVariants((prev) =>
                              prev.map((item) =>
                                item.id === variant.id
                                  ? { ...item, compareAtCents: null }
                                  : item
                              )
                            );
                            return;
                          }
                          const parsed = parseEuro(value);
                          if (parsed === null) {
                            setCompareDrafts((prev) => ({
                              ...prev,
                              [variant.id]: toEuro(variant.compareAtCents),
                            }));
                            return;
                          }
                          setVariants((prev) =>
                            prev.map((item) =>
                              item.id === variant.id
                                ? { ...item, compareAtCents: parsed }
                                : item
                            )
                          );
                          setCompareDrafts((prev) => ({
                            ...prev,
                            [variant.id]: toEuro(parsed),
                          }));
                        }}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-stone-600">
                      Low stock
                      <input
                        type="number"
                        min={0}
                        value={variant.lowStockThreshold}
                        onChange={(event) =>
                          setVariants((prev) =>
                            prev.map((item) =>
                              item.id === variant.id
                                ? {
                                    ...item,
                                    lowStockThreshold: Number(event.target.value),
                                  }
                                : item
                            )
                          )
                        }
                        className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-stone-600">
                      Position
                      <input
                        type="number"
                        value={variant.position}
                        onChange={(event) =>
                          setVariants((prev) =>
                            prev.map((item) =>
                              item.id === variant.id
                                ? { ...item, position: Number(event.target.value) }
                                : item
                            )
                          )
                        }
                        className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                  <label className="text-xs font-semibold text-stone-600">
                    On hand
                    <input
                      type="number"
                      value={variant.inventory?.quantityOnHand ?? 0}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? {
                                  ...item,
                                  inventory: {
                                    quantityOnHand: Number(event.target.value),
                                    reserved: item.inventory?.reserved ?? 0,
                                  },
                                }
                              : item
                          )
                        )
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Reserved
                    <input
                      type="number"
                      value={variant.inventory?.reserved ?? 0}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? {
                                  ...item,
                                  inventory: {
                                    quantityOnHand:
                                      item.inventory?.quantityOnHand ?? 0,
                                    reserved: Number(event.target.value),
                                  },
                                }
                              : item
                          )
                        )
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="text-xs text-stone-500">
                      Available:{" "}
                      <span className="font-semibold text-stone-800">
                        {variant.available}
                      </span>
                    </div>
                    {variant.available <= variant.lowStockThreshold && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        Low stock
                      </span>
                    )}
                    <div className="text-xs text-stone-500">
                      Profit:{" "}
                      <span
                        className={`font-semibold ${
                          variant.priceCents - variant.costCents >= 0
                            ? "text-stone-800"
                            : "text-red-600"
                        }`}
                      >
                        {toEuro(variant.priceCents - variant.costCents)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateVariant(variant)}
                      className="h-10 rounded-md border border-[#2f3e36]/20 px-4 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVariant(variant.id)}
                      className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="rounded-md border border-[#2f3e36]/10 bg-[#f8fbf6] px-3 py-3">
                  <p className="text-xs font-semibold text-stone-600">Options</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Add option pairs like Size: Small or Color: Black.
                  </p>
                  <div className="mt-3 space-y-2">
                    {variant.options.map((opt, optIndex) => (
                      <div
                        key={opt.id}
                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <input
                          value={opt.name}
                          onChange={(event) =>
                            setVariants((prev) =>
                              prev.map((item) =>
                                item.id === variant.id
                                  ? {
                                      ...item,
                                      options: item.options.map(
                                        (row, rowIndex) =>
                                          rowIndex === optIndex
                                            ? { ...row, name: event.target.value }
                                            : row
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="Option name"
                          className="h-9 w-full min-w-0 rounded-md border border-black/15 px-3 text-xs"
                        />
                        <input
                          value={opt.value}
                          onChange={(event) =>
                            setVariants((prev) =>
                              prev.map((item) =>
                                item.id === variant.id
                                  ? {
                                      ...item,
                                      options: item.options.map(
                                        (row, rowIndex) =>
                                          rowIndex === optIndex
                                            ? {
                                                ...row,
                                                value: event.target.value,
                                              }
                                            : row
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="Option value"
                          className="h-9 w-full min-w-0 rounded-md border border-black/15 px-3 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setVariants((prev) =>
                              prev.map((item) =>
                                item.id === variant.id
                                  ? {
                                      ...item,
                                      options: item.options.filter(
                                        (_, rowIndex) => rowIndex !== optIndex
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-9 rounded-md border border-black/15 px-3 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setVariants((prev) =>
                          prev.map((item) =>
                            item.id === variant.id
                              ? {
                                  ...item,
                                  options: [
                                    ...item.options,
                                    {
                                      id: `${item.id}-${Date.now()}`,
                                      name: "",
                                      value: "",
                                    },
                                  ],
                                }
                              : item
                          )
                        )
                      }
                      className="h-9 rounded-md border border-[#2f3e36]/20 px-3 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
                    >
                      Add option
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <p className="text-xs text-stone-500">No variants yet.</p>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-[#2f3e36]/20 bg-[#f8fbf6] p-4">
          <p className="text-xs font-semibold text-stone-600 mb-3">Add variant</p>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_140px_140px]">
              <input
                value={newVariant.title}
                onChange={(event) =>
                  setNewVariant((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Title"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newVariant.sku}
                onChange={(event) =>
                  setNewVariant((prev) => ({ ...prev, sku: event.target.value }))
                }
                placeholder="SKU"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newVariant.price}
                onChange={(event) =>
                  setNewVariant((prev) => ({ ...prev, price: event.target.value }))
                }
                placeholder="Price EUR"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newVariant.cost}
                onChange={(event) =>
                  setNewVariant((prev) => ({ ...prev, cost: event.target.value }))
                }
                placeholder="Cost EUR"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[140px_140px_120px]">
              <input
                value={newVariant.compareAt}
                onChange={(event) =>
                  setNewVariant((prev) => ({ ...prev, compareAt: event.target.value }))
                }
                placeholder="Compare at"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                type="number"
                min={0}
                value={newVariant.lowStockThreshold}
                onChange={(event) =>
                  setNewVariant((prev) => ({
                    ...prev,
                    lowStockThreshold: Number(event.target.value),
                  }))
                }
                placeholder="Low stock"
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                type="number"
                value={newVariant.position}
                onChange={(event) =>
                  setNewVariant((prev) => ({
                    ...prev,
                    position: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-md border border-black/15 px-3 text-sm"
              />
            </div>
          </div>
          {!newVariant.price && (
            <p className="mt-2 text-[11px] font-medium text-red-600">
              Price required
            </p>
          )}
          <div className="mt-3 space-y-2">
            {newVariant.options.map((opt, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={opt.name}
                  onChange={(event) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      options: prev.options.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, name: event.target.value } : row
                      ),
                    }))
                  }
                  placeholder="Option name"
                  className="h-9 rounded-md border border-black/15 px-3 text-xs"
                />
                <input
                  value={opt.value}
                  onChange={(event) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      options: prev.options.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, value: event.target.value } : row
                      ),
                    }))
                  }
                  placeholder="Option value"
                  className="h-9 rounded-md border border-black/15 px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    setNewVariant((prev) => ({
                      ...prev,
                      options: prev.options.filter((_, rowIndex) => rowIndex !== index),
                    }))
                  }
                  className="h-9 rounded-md border border-black/15 px-2 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setNewVariant((prev) => ({
                  ...prev,
                  options: [...prev.options, { name: "", value: "" }],
                }))
              }
              className="h-9 rounded-md border border-black/15 px-3 text-xs font-semibold"
            >
              Add option
            </button>
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="mt-4 h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white hover:bg-[#24312b]"
          >
            Add variant
          </button>
        </div>
      </section>
    </div>
  );
}
