"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  collectMerchantPolicyViolations,
  type MerchantPolicyViolation,
} from "@/lib/merchantTextPolicy";

type ImageItem = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
};

type VariantOption = {
  id: string;
  name: string;
  value: string;
  imagePosition?: number | null;
};

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
  parentId?: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  leadTimeDays: number | null;
};

type ProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  technicalDetails: string | null;
  shortDescription: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  supplier: string | null;
  supplierId: string | null;
  sellerName?: string | null;
  sellerUrl: string | null;
  leadTimeDays: number | null;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  growboxPlantCountMin: number | null;
  growboxPlantCountMax: number | null;
  growboxSize: string | null;
  growboxConnectionDiameterMm: number[];
  lightSize: string | null;
  airSystemDiameterMm: number | null;
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

type CrossSellItem = {
  crossSell: {
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
  };
};

type CrossSellProduct = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
};

type Props = {
  product: ProductDetail;
  categories: CategoryRow[];
  collections: CategoryRow[];
  suppliers: SupplierRow[];
  crossSells: CrossSellItem[];
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

type PaymentFeePreset = {
  label: string;
  percentBasisPoints: number;
  fixedCents: number;
};

const CATALOG_PAYMENT_FEES: PaymentFeePreset[] = [
  { label: "Stripe", percentBasisPoints: 150, fixedCents: 25 },
  { label: "PayPal", percentBasisPoints: 299, fixedCents: 35 },
  { label: "Klarna", percentBasisPoints: 329, fixedCents: 35 },
];

const PRICE_WITH_SHIPPING_THRESHOLD_CENTS = 10_000;
const ESTIMATED_SHIPPING_CENTS = 690;

const calculateAdjustedCostForProvider = (
  priceCents: number,
  costCents: number,
  provider: PaymentFeePreset
) => {
  const includeShipping = priceCents >= PRICE_WITH_SHIPPING_THRESHOLD_CENTS;
  const feeBase = priceCents + (includeShipping ? ESTIMATED_SHIPPING_CENTS : 0);
  const percentFee = Math.round((feeBase * provider.percentBasisPoints) / 10_000);
  const paymentFee = Math.max(0, percentFee + provider.fixedCents);
  const adjustedCost = Math.max(0, costCents + paymentFee);
  const profit = priceCents - adjustedCost;
  return { adjustedCost, paymentFee, profit, includeShipping };
};

type OptionInput = { name: string; value: string; imagePosition?: number | null };

const normalizeVariantOptions = (
  options: OptionInput[]
): {
  options: Array<{ name: string; value: string; imagePosition?: number | null }>;
  duplicates: string[];
} => {
  const duplicates = new Set<string>();
  const normalized = options
    .map((opt) => ({
      name: opt.name.trim(),
      value: opt.value.trim(),
      imagePosition:
        typeof opt.imagePosition === "number" && Number.isFinite(opt.imagePosition)
          ? Math.max(0, Math.floor(opt.imagePosition))
          : null,
    }))
    .filter((opt) => opt.name && opt.value);
  const deduped: Array<{
    name: string;
    value: string;
    imagePosition?: number | null;
  }> = [];
  normalized.forEach((opt) => {
    const key = opt.name.toLowerCase();
    if (duplicates.has(key)) return;
    deduped.push(opt);
  });
  return { options: deduped, duplicates: Array.from(duplicates) };
};

const findOptionRowIssues = (options: OptionInput[]) => {
  const incomplete = options.find(
    (opt) => Boolean(opt.name.trim()) !== Boolean(opt.value.trim())
  );
  return incomplete
    ? `Option requires name and value: "${incomplete.name || incomplete.value}"`
    : null;
};

export default function AdminProductClient({
  product,
  categories,
  collections,
  suppliers,
  crossSells: initialCrossSells,
}: Props) {
  const resolvedSupplierId = (() => {
    if (product.supplierId) return product.supplierId;
    if (product.supplier) {
      const match = suppliers.find(
        (supplier) => supplier.name === product.supplier
      );
      if (match) return match.id;
    }
    return "";
  })();
  const [details, setDetails] = useState({
    title: product.title,
    handle: product.handle,
    description: product.description ?? "",
    technicalDetails: product.technicalDetails ?? "",
    shortDescription: product.shortDescription ?? "",
    manufacturer: product.manufacturer ?? "",
    productGroup: product.productGroup ?? "",
    supplierId: resolvedSupplierId,
    sellerUrl: product.sellerUrl ?? "",
    leadTimeDays: product.leadTimeDays ?? "",
    weightGrams: product.weightGrams ?? "",
    lengthMm: product.lengthMm ?? "",
    widthMm: product.widthMm ?? "",
    heightMm: product.heightMm ?? "",
    growboxPlantCountMin: product.growboxPlantCountMin ?? "",
    growboxPlantCountMax: product.growboxPlantCountMax ?? "",
    growboxSize: product.growboxSize ?? "",
    growboxConnectionDiameterMm: product.growboxConnectionDiameterMm ?? [],
    lightSize: product.lightSize ?? "",
    airSystemDiameterMm: product.airSystemDiameterMm ?? "",
    shippingClass: product.shippingClass ?? "",
    tags: (product.tags ?? []).join(", "),
    status: product.status,
  });
  const [images, setImages] = useState<ImageItem[]>(product.images);
  const [uploading, setUploading] = useState(false);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [variants, setVariants] = useState<VariantItem[]>(product.variants);
  const [draggingVariantId, setDraggingVariantId] = useState<string | null>(null);
  const [reorderingVariants, setReorderingVariants] = useState(false);
  const [draggingOption, setDraggingOption] = useState<{
    variantId: string;
    optionId: string;
  } | null>(null);
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
  const [savingAllVariants, setSavingAllVariants] = useState(false);
  const [categoryIds, setCategoryIds] = useState(
    new Set(product.categories.map((item) => item.category.id))
  );
  const [collectionIds, setCollectionIds] = useState(
    new Set(product.collections.map((item) => item.collection.id))
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "selected" | "parent" | "child"
  >("all");
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmVariantId, setConfirmVariantId] = useState<string | null>(null);
  const [confirmVariantTitle, setConfirmVariantTitle] = useState("");
  const [confirmVariantText, setConfirmVariantText] = useState("");
  const [confirmVariantError, setConfirmVariantError] = useState("");
  const [confirmVariantLoading, setConfirmVariantLoading] = useState(false);
  const [confirmVariantPassword, setConfirmVariantPassword] = useState("");
  const [confirmVariantPasswordError, setConfirmVariantPasswordError] =
    useState("");
  const [shippingOpen, setShippingOpen] = useState(false);
  const [descriptionsOpen, setDescriptionsOpen] = useState(false);
  const [handleError, setHandleError] = useState("");
  const [serverPolicyViolations, setServerPolicyViolations] = useState<
    MerchantPolicyViolation[]
  >([]);

  // FBT state
  const [fbtItems, setFbtItems] = useState<CrossSellProduct[]>(
    () => initialCrossSells.map((row) => row.crossSell)
  );
  const [fbtSearch, setFbtSearch] = useState("");
  const [fbtResults, setFbtResults] = useState<CrossSellProduct[]>([]);
  const [fbtSearching, setFbtSearching] = useState(false);
  const [fbtSaving, setFbtSaving] = useState(false);
  const [fbtMessage, setFbtMessage] = useState("");

  const parentCategories = useMemo(
    () => categories.filter((item) => !item.parentId),
    [categories]
  );
  const childCategories = useMemo(
    () => categories.filter((item) => item.parentId),
    [categories]
  );
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((item) => {
      map.set(item.id, item.name);
    });
    return map;
  }, [categories]);
  const normalizedCategorySearch = categorySearch.trim().toLowerCase();
  const filteredParentCategories = useMemo(() => {
    const base =
      categoryFilter === "child"
        ? []
        : parentCategories.filter((item) => {
            if (!normalizedCategorySearch) return true;
            return item.name.toLowerCase().includes(normalizedCategorySearch);
          });
    if (categoryFilter === "selected") {
      return base.filter((item) => categoryIds.has(item.id));
    }
    return base;
  }, [categoryFilter, categoryIds, normalizedCategorySearch, parentCategories]);
  const filteredChildCategories = useMemo(() => {
    const base =
      categoryFilter === "parent"
        ? []
        : childCategories.filter((item) => {
            const parentName = item.parentId
              ? categoryNameById.get(item.parentId)?.toLowerCase() ?? ""
              : "";
            if (!normalizedCategorySearch) return true;
            return (
              item.name.toLowerCase().includes(normalizedCategorySearch) ||
              parentName.includes(normalizedCategorySearch)
            );
          });
    if (categoryFilter === "selected") {
      return base.filter((item) => categoryIds.has(item.id));
    }
    return base;
  }, [
    categoryFilter,
    categoryIds,
    childCategories,
    categoryNameById,
    normalizedCategorySearch,
  ]);
  const visibleChildCategories = useMemo(() => {
    if (!activeParentId) return filteredChildCategories;
    return filteredChildCategories.filter(
      (item) => item.parentId === activeParentId
    );
  }, [activeParentId, filteredChildCategories]);
  const activeParentName = activeParentId
    ? categoryNameById.get(activeParentId) ?? "Auswahl"
    : "Auswahl";
  const selectedCategoryCount = categoryIds.size;
  const selectedChildCount = childCategories.filter((item) =>
    categoryIds.has(item.id)
  ).length;
  const selectedCollectionCount = collectionIds.size;

  useEffect(() => {
    if (activeParentId && parentCategories.some((item) => item.id === activeParentId)) {
      return;
    }
    const selectedParent =
      parentCategories.find((item) => categoryIds.has(item.id)) ?? null;
    setActiveParentId(selectedParent?.id ?? parentCategories[0]?.id ?? null);
  }, [activeParentId, categoryIds, parentCategories]);
  const growboxenCategoryId = useMemo(
    () => categories.find((item) => item.handle === "zelte")?.id ?? null,
    [categories]
  );
  const showZelteFields = useMemo(
    () => (growboxenCategoryId ? categoryIds.has(growboxenCategoryId) : false),
    [categoryIds, growboxenCategoryId]
  );
  const lightCategoryId = useMemo(
    () =>
      categories.find(
        (item) => item.handle.toLowerCase() === "licht".toLowerCase()
      )?.id ?? null,
    [categories]
  );
  const showLightFields = useMemo(
    () => (lightCategoryId ? categoryIds.has(lightCategoryId) : false),
    [categoryIds, lightCategoryId]
  );
  const airSystemCategoryId = useMemo(
    () =>
      categories.find(
        (item) => item.handle.toLowerCase() === "luft".toLowerCase()
      )?.id ?? null,
    [categories]
  );
  const showAirSystemFields = useMemo(
    () => (airSystemCategoryId ? categoryIds.has(airSystemCategoryId) : false),
    [categoryIds, airSystemCategoryId]
  );
  const editorPolicyViolations = useMemo(
    () =>
      collectMerchantPolicyViolations({
        title: details.title,
        description: details.description,
        technicalDetails: details.technicalDetails,
        shortDescription: details.shortDescription,
        productGroup: details.productGroup,
        tags: details.tags,
      }),
    [
      details.description,
      details.productGroup,
      details.shortDescription,
      details.tags,
      details.technicalDetails,
      details.title,
    ]
  );
  const hasEditorPolicyViolations = editorPolicyViolations.length > 0;
  const mergedPolicyViolations = useMemo(() => {
    const map = new Map<string, MerchantPolicyViolation>();
    for (const violation of [
      ...editorPolicyViolations,
      ...serverPolicyViolations,
    ]) {
      map.set(
        `${violation.field}:${violation.reason}:${violation.match}`,
        violation
      );
    }
    return Array.from(map.values());
  }, [editorPolicyViolations, serverPolicyViolations]);
  const policyViolationSummary = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    mergedPolicyViolations.forEach((violation) => {
      const reasonLabel =
        violation.reason === "medical_claim"
          ? "Medical claim terms"
          : "Illegal-use implication terms";
      const key = `${reasonLabel} (${violation.field})`;
      const set = grouped.get(key) ?? new Set<string>();
      set.add(violation.match);
      grouped.set(key, set);
    });
    return Array.from(grouped.entries()).map(([label, matches]) => ({
      label,
      matches: Array.from(matches).slice(0, 6),
    }));
  }, [mergedPolicyViolations]);

  useEffect(() => {
    setServerPolicyViolations((prev) => (prev.length > 0 ? [] : prev));
  }, [
    details.title,
    details.description,
    details.technicalDetails,
    details.shortDescription,
    details.productGroup,
    details.tags,
  ]);

  const [newImage, setNewImage] = useState({
    url: "",
    altText: "",
    position: 0,
  });

  const [newVariant, setNewVariant] = useState<{
    title: string;
    sku: string;
    price: string;
    cost: string;
    compareAt: string;
    lowStockThreshold: number;
    options: Array<{ name: string; value: string; imagePosition: number | null }>;
  }>({
    title: "",
    sku: "",
    price: "",
    cost: "",
    compareAt: "",
    lowStockThreshold: 5,
    options: [{ name: "", value: "", imagePosition: null }],
  });
  const [addVariantOpen, setAddVariantOpen] = useState(false);

  const saveDetails = async () => {
    setMessage("");
    setError("");
    setHandleError("");
    setServerPolicyViolations([]);
    if (details.sellerUrl && !/^https?:\/\//i.test(details.sellerUrl)) {
      setError("Seller URL must be a valid http(s) link");
      return;
    }
    try {
      const tags = details.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const toNumberOrNull = (value: number | string) =>
        value === "" ? null : Number(value);
      const payload: Record<string, unknown> = {
        title: details.title,
        handle: details.handle,
        description: details.description,
        technicalDetails: details.technicalDetails,
        shortDescription: details.shortDescription,
        manufacturer: details.manufacturer,
        productGroup: details.productGroup,
        sellerUrl: details.sellerUrl,
        tags,
        leadTimeDays: toNumberOrNull(details.leadTimeDays),
        weightGrams: toNumberOrNull(details.weightGrams),
        lengthMm: toNumberOrNull(details.lengthMm),
        widthMm: toNumberOrNull(details.widthMm),
        heightMm: toNumberOrNull(details.heightMm),
        growboxPlantCountMin: toNumberOrNull(details.growboxPlantCountMin),
        growboxPlantCountMax: toNumberOrNull(details.growboxPlantCountMax),
        growboxSize: details.growboxSize,
        growboxConnectionDiameterMm: details.growboxConnectionDiameterMm,
        lightSize: details.lightSize,
        airSystemDiameterMm: toNumberOrNull(details.airSystemDiameterMm),
        shippingClass: details.shippingClass,
        status: details.status,
      };
      if (details.supplierId || product.supplierId) {
        payload.supplierId = details.supplierId || null;
      }
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as {
          error?: string;
          violations?: MerchantPolicyViolation[];
        };
        const errorMessage = data.error ?? "Update failed";
        setError(errorMessage);
        if (Array.isArray(data.violations)) {
          setServerPolicyViolations(data.violations);
        }
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

  const saveCrossSells = async () => {
    setFbtMessage("");
    setFbtSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/cross-sells`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crossSellIds: fbtItems.map((item) => item.id) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setFbtMessage(data.error ?? "Save failed");
      } else {
        setFbtMessage("Saved");
      }
    } catch {
      setFbtMessage("Save failed");
    } finally {
      setFbtSaving(false);
    }
  };

  useEffect(() => {
    const q = fbtSearch.trim();
    if (!q) {
      setFbtResults([]);
      return;
    }
    setFbtSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as CrossSellProduct[];
          setFbtResults(
            data
              .filter((p) => p.id !== product.id && !fbtItems.some((item) => item.id === p.id))
              .slice(0, 8)
          );
        }
      } catch {
        // ignore
      } finally {
        setFbtSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      setFbtSearching(false);
    };
  }, [fbtSearch, product.id, fbtItems]);

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

  const handleUploadDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragActive(false);
    if (event.dataTransfer?.files?.length) {
      void uploadImages(event.dataTransfer.files);
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
    const res = await fetch(`/api/admin/images/${id}`, {
      method: "DELETE",
    });
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
    const rowIssue = findOptionRowIssues(variant.options);
    if (rowIssue) {
      setError(rowIssue);
      return;
    }
    const normalizedOptions = normalizeVariantOptions(variant.options);
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
        options: normalizedOptions.options,
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

  const saveAllVariants = async () => {
    setMessage("");
    setError("");
    setSavingAllVariants(true);
    try {
      for (const variant of variants) {
        const rowIssue = findOptionRowIssues(variant.options);
        if (rowIssue) {
          setError(`"${variant.title}": ${rowIssue}`);
          return;
        }
      }
      const responses = await Promise.all(
        variants.map((variant) =>
          {
            const normalized = normalizeVariantOptions(variant.options);
            return fetch(`/api/admin/variants/${variant.id}`, {
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
                options: normalized.options,
                inventory: {
                  quantityOnHand: variant.inventory?.quantityOnHand ?? 0,
                  reserved: variant.inventory?.reserved ?? 0,
                },
              }),
            });
          }
        )
      );
      const failed = responses.find((res) => !res.ok);
      if (failed) {
        let errorMessage = "Save failed";
        try {
          const data = (await failed.json()) as { error?: string };
          if (data?.error) errorMessage = data.error;
        } catch {
          // Keep default message when response isn't JSON.
        }
        setError(errorMessage);
        return;
      }
      setMessage("Variants updated");
    } finally {
      setSavingAllVariants(false);
    }
  };

  const saveVariantOrder = async (items: VariantItem[]) => {
    setMessage("");
    setError("");
    setReorderingVariants(true);
    try {
      await Promise.all(
        items.map((variant) =>
          fetch(`/api/admin/variants/${variant.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: variant.position }),
          })
        )
      );
      setMessage("Variant order updated");
    } catch {
      setError("Reorder failed");
    } finally {
      setReorderingVariants(false);
    }
  };

  const reorderVariants = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setVariants((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((item) => item.id === sourceId);
      const targetIndex = next.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const positioned = next.map((item, index) => ({
        ...item,
        position: index,
      }));
      void saveVariantOrder(positioned);
      return positioned;
    });
  };

  const reorderVariantOptions = (
    variantId: string,
    sourceId: string,
    targetId: string
  ) => {
    if (sourceId === targetId) return;
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.id !== variantId) return variant;
        const nextOptions = [...variant.options];
        const sourceIndex = nextOptions.findIndex((opt) => opt.id === sourceId);
        const targetIndex = nextOptions.findIndex((opt) => opt.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return variant;
        const [moved] = nextOptions.splice(sourceIndex, 1);
        nextOptions.splice(targetIndex, 0, moved);
        return { ...variant, options: nextOptions };
      })
    );
  };

  const deleteVariant = async (id: string, adminPassword: string) => {
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/variants/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setVariants((prev) => prev.filter((item) => item.id !== id));
    setMessage("Variant deleted");
  };

  const addVariant = async () => {
    const priceInput = newVariant.price.trim();
    const priceCents = priceInput ? parseEuro(priceInput) : 0;
    const costCents = newVariant.cost ? parseEuro(newVariant.cost) : 0;
    if (!newVariant.title.trim()) {
      setError("Variant title is required");
      return;
    }
    if (priceInput && priceCents === null) {
      setError("Variant price is invalid");
      return;
    }
    if (newVariant.cost && costCents === null) {
      setError("Variant cost is invalid");
      return;
    }
    const rowIssue = findOptionRowIssues(newVariant.options);
    if (rowIssue) {
      setError(rowIssue);
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
        position: variants.length,
        lowStockThreshold: Number(newVariant.lowStockThreshold) || 0,
        options: normalizeVariantOptions(newVariant.options).options,
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
      lowStockThreshold: 5,
      options: [{ name: "", value: "", imagePosition: null }],
    });
    setAddVariantOpen(false);
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

  useEffect(() => {
    setNewVariant((prev) => ({
      ...prev,
      options:
        prev.options.length === 0
          ? [{ name: "", value: "", imagePosition: null }]
          : prev.options,
    }));
  }, []);

  const legacySupplierName = useMemo(() => {
    if (product.supplierId) return null;
    if (!product.supplier) return null;
    const match = suppliers.some(
      (supplier) => supplier.name === product.supplier
    );
    return match ? null : product.supplier;
  }, [product.supplier, product.supplierId, suppliers]);

  useEffect(() => {
    if (!details.supplierId) return;
    const supplier = suppliers.find(
      (item) => item.id === details.supplierId
    );
    if (!supplier) return;
    const leadTimeDays = supplier.leadTimeDays;
    if (leadTimeDays === null) return;
    setDetails((prev) =>
      prev.leadTimeDays === "" ? { ...prev, leadTimeDays } : prev
    );
  }, [details.supplierId, suppliers]);

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
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
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
          <label className="text-xs font-semibold text-stone-600">
            Produktgruppe
            <input
              value={details.productGroup}
              onChange={(event) =>
                setDetails((prev) => ({ ...prev, productGroup: event.target.value }))
              }
              placeholder="z.B. growbox-60x60"
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
        {showZelteFields && (
          <div className="mt-4 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Zelte
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-stone-600">
                Plant count min
                <input
                  type="number"
                  min={0}
                  value={details.growboxPlantCountMin}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      growboxPlantCountMin:
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 2"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Plant count max
                <input
                  type="number"
                  min={0}
                  value={details.growboxPlantCountMax}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      growboxPlantCountMax:
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 6"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                Size
                <input
                  value={details.growboxSize}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      growboxSize: event.target.value,
                    }))
                  }
                  placeholder="e.g. 80x80x180 cm"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-stone-600 md:col-span-2">
                Connection diameters (mm)
                <input
                  value={details.growboxConnectionDiameterMm.join(", ")}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      growboxConnectionDiameterMm: event.target.value
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter((value) => Number.isFinite(value)),
                    }))
                  }
                  placeholder="e.g. 100, 125, 150"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
            </div>
          </div>
        )}
        {showLightFields && (
          <div className="mt-4 rounded-lg border border-indigo-200/70 bg-indigo-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
              Licht
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-stone-600">
                Light size
                <input
                  value={details.lightSize}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      lightSize: event.target.value,
                    }))
                  }
                  placeholder="e.g. 80x80"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
            </div>
          </div>
        )}
        {showAirSystemFields && (
          <div className="mt-4 rounded-lg border border-sky-200/70 bg-sky-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Luft
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-stone-600">
                Diameter (mm)
                <input
                  type="number"
                  min={0}
                  value={details.airSystemDiameterMm}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      airSystemDiameterMm:
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 125"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
            </div>
          </div>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Supplier
            <select
              value={details.supplierId}
              onChange={(event) =>
                setDetails((prev) => ({ ...prev, supplierId: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            >
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-stone-500">
              Manage suppliers in{" "}
              <Link href="/admin/suppliers" className="underline">
                CRM
              </Link>
              .
            </span>
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Seller link
            <input
              type="url"
              value={details.sellerUrl}
              onChange={(event) =>
                setDetails((prev) => ({ ...prev, sellerUrl: event.target.value }))
              }
              placeholder="https://seller.example/product"
              className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
            />
          </label>
          {legacySupplierName && (
            <div className="rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700 md:col-span-2">
              Legacy supplier: {legacySupplierName}. Pick a CRM supplier to link.
            </div>
          )}
        </div>
        <div className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3">
          <button
            type="button"
            onClick={() => setShippingOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={shippingOpen}
          >
            <p className="text-sm font-semibold text-amber-700">
              Shipping & dimensions
            </p>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/70 text-amber-700 transition hover:border-amber-300"
              aria-hidden="true"
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
            </span>
          </button>
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
              <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
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
        <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3">
          <button
            type="button"
            onClick={() => setDescriptionsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={descriptionsOpen}
          >
            <p className="text-sm font-semibold text-amber-700">
              Descriptions
            </p>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/70 text-amber-700 transition hover:border-amber-300"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${
                  descriptionsOpen ? "rotate-180" : "rotate-0"
                }`}
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
            </span>
          </button>
          {descriptionsOpen && (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-xs font-semibold text-stone-600">
                  Description
                </p>
                <RichTextEditor
                  value={details.description}
                  onChange={(next) =>
                    setDetails((prev) => ({ ...prev, description: next }))
                  }
                  placeholder="Write a short, clear product description."
                />
                <p className="mt-2 text-[11px] text-stone-500">
                  Use the toolbar to format text. Links and headings are
                  supported.
                </p>
              </div>
              <label className="block text-xs font-semibold text-stone-600">
                Short description
                <textarea
                  value={details.shortDescription}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      shortDescription: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Short summary for product cards and PDP."
                  className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] text-stone-500">
                  Plain text only. Use this for the product grid and a quick PDP
                  summary.
                </span>
              </label>
              <div>
                <p className="text-xs font-semibold text-stone-600">
                  Technical details
                </p>
                <RichTextEditor
                  value={details.technicalDetails}
                  onChange={(next) =>
                    setDetails((prev) => ({
                      ...prev,
                      technicalDetails: next,
                    }))
                  }
                  placeholder="Add technical specs, materials, sizes, or included items."
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {mergedPolicyViolations.length > 0 && (
            <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">
                Policy warning: revise text before saving.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {policyViolationSummary.map((entry) => (
                  <li key={entry.label}>
                    {entry.label}: {entry.matches.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            disabled={hasEditorPolicyViolations}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white transition hover:bg-[#24312b]"
          >
            Save details
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900">02</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Categories & collections</p>
            <p className="text-xs text-stone-500">Organize where this product appears.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M21 21l-4.2-4.2m1.7-5.1a6.8 6.8 0 11-13.6 0 6.8 6.8 0 0113.6 0z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="Kategorie / Subkategorie suchen ..."
              className="h-11 w-full rounded-full border border-black/10 bg-white px-10 text-sm shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {[
              { id: "all", label: "Alle" },
              { id: "selected", label: "Nur ausgewählte" },
              { id: "parent", label: "Kategorien" },
              { id: "child", label: "Subkategorien" },
            ].map((item) => {
              const active = categoryFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(
                      item.id as "all" | "selected" | "parent" | "child"
                    )
                  }
                  className={`h-9 rounded-full border px-4 transition ${
                    active
                      ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                      : "border-black/10 bg-white text-stone-600 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr_0.9fr]">
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold text-stone-600">Kategorien</p>
              <div className="mt-3 space-y-2">
                {filteredParentCategories.map((item) => {
                  const selected = categoryIds.has(item.id);
                  const isActive = activeParentId === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-emerald-300 bg-emerald-100/70 text-emerald-900"
                          : "border-emerald-100 bg-emerald-50/40 text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/80"
                      } ${isActive ? "ring-1 ring-emerald-300" : ""}`}
                      onClick={() => setActiveParentId(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setCategoryIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) {
                              next.delete(item.id);
                            } else {
                              parentCategories.forEach((parent) => {
                                if (parent.id !== item.id) {
                                  next.delete(parent.id);
                                }
                              });
                              next.add(item.id);
                            }
                            return next;
                          });
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>{item.name}</span>
                    </label>
                  );
                })}
                {filteredParentCategories.length === 0 && (
                  <p className="text-xs text-stone-500">No categories yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-700">
                <span>Subkategorien für:</span>
                <span className="text-emerald-700">{activeParentName}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-stone-500">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryIds((prev) => {
                      const next = new Set(prev);
                      visibleChildCategories.forEach((item) => next.add(item.id));
                      return next;
                    });
                  }}
                  className="hover:text-emerald-700"
                >
                  Alle auswählen
                </button>
                <span className="text-stone-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryIds((prev) => {
                      const next = new Set(prev);
                      visibleChildCategories.forEach((item) => next.delete(item.id));
                      return next;
                    });
                  }}
                  className="hover:text-emerald-700"
                >
                  Alle abwählen
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visibleChildCategories.map((item) => {
                  const selected = categoryIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-emerald-300 bg-emerald-100/70 text-emerald-900"
                          : "border-emerald-100 bg-emerald-50/40 text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
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
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>{item.name}</span>
                    </label>
                  );
                })}
                {visibleChildCategories.length === 0 && (
                  <p className="text-xs text-stone-500">No subcategories yet.</p>
                )}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={saveCategories}
                  className="h-10 rounded-md border border-[#2f3e36]/20 px-4 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
                >
                  Save categories
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <p className="text-xs font-semibold text-stone-600">Collections</p>
                <div className="mt-3 space-y-2">
                  {collections.map((item) => {
                    const selected = collectionIds.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          selected
                            ? "border-emerald-300 bg-emerald-100/70 text-emerald-900"
                            : "border-emerald-100 bg-emerald-50/40 text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
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
                          className="h-4 w-4 accent-emerald-600"
                        />
                        {item.name}
                      </label>
                    );
                  })}
                  {collections.length === 0 && (
                    <p className="text-xs text-stone-500">No collections yet.</p>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={saveCollections}
                    className="h-10 rounded-md border border-[#2f3e36]/20 px-4 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
                  >
                    Save collections
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Auswahl Übersicht
                </p>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  <p>Kategorien: {selectedCategoryCount} gewählt</p>
                  <p>Subkategorien: {selectedChildCount} gewählt</p>
                  <p>Collections: {selectedCollectionCount} gewählt</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryIds(new Set());
                    setCollectionIds(new Set());
                  }}
                  className="mt-4 h-10 w-full rounded-md border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:border-amber-300"
                >
                  Reset
                </button>
              </div>
            </div>
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
          <div
            className={`rounded-md border border-dashed px-4 py-3 mb-5 transition ${
              uploadDragActive
                ? "border-emerald-400 bg-emerald-50/80"
                : "border-[#2f3e36]/20 bg-[#f8fbf6]"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setUploadDragActive(true);
            }}
            onDragLeave={() => setUploadDragActive(false)}
            onDrop={handleUploadDrop}
          >
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
              className="rounded-xl border border-black/10 bg-white p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingImageId) {
                  reorderImages(draggingImageId, image.id);
                }
              }}
            >
              <div className="mx-auto w-full max-w-5xl">
                <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
                  {reordering && <span>Saving order…</span>}
                </div>
                <div className="grid items-start gap-3 md:grid-cols-[32px_96px_1.6fr_1fr_120px_auto_auto]">
                  <div className="flex h-20 items-center justify-center self-start">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-stone-400 shadow-sm cursor-grab select-none"
                      draggable
                      onDragStart={() => setDraggingImageId(image.id)}
                      onDragEnd={() => setDraggingImageId(null)}
                    >
                      ⋮⋮
                    </span>
                  </div>
                  <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-stone-50">
                    {image.url ? (
                      <Image
                        src={image.url}
                        alt={image.altText ?? "Image preview"}
                        className="h-full w-full object-cover"
                        width={96}
                        height={80}
                        sizes="96px"
                      />
                    ) : (
                      <span className="text-[10px] text-stone-400">
                        No preview
                      </span>
                    )}
                  </div>
                  <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                    <span>Image URL</span>
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
                      className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                    <span>Alt text</span>
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
                      className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                    <span>Position</span>
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
                      className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                    />
                  </label>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[11px] font-semibold text-transparent">
                      Actions
                    </span>
                    <button
                      type="button"
                      onClick={() => updateImage(image)}
                      className="h-10 rounded-md border border-black/15 px-3 text-xs font-semibold"
                    >
                      Save
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[11px] font-semibold text-transparent">
                      Actions
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteImage(image.id)}
                      className="flex h-10 items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                      aria-label="Delete image"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <p className="text-xs text-stone-500">No images yet.</p>
          )}
        </div>
        <div className="mt-4">
          <div className="mx-auto w-full max-w-5xl">
            <div className="grid items-start gap-3 md:grid-cols-[96px_1.6fr_1fr_120px_auto]">
              <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-stone-50">
                {newImage.url ? (
                  <Image
                    src={newImage.url}
                    alt={newImage.altText || "New image preview"}
                    className="h-full w-full object-cover"
                    width={96}
                    height={80}
                    sizes="96px"
                  />
                ) : (
                  <span className="text-[10px] text-stone-400">Preview</span>
                )}
              </div>
              <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                <span>Image URL</span>
                <input
                  value={newImage.url}
                  onChange={(event) =>
                    setNewImage((prev) => ({ ...prev, url: event.target.value }))
                  }
                  placeholder="Image URL"
                  className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                <span>Alt text</span>
                <input
                  value={newImage.altText}
                  onChange={(event) =>
                    setNewImage((prev) => ({ ...prev, altText: event.target.value }))
                  }
                  placeholder="Alt text"
                  className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="text-[11px] font-semibold text-stone-500 flex flex-col gap-1">
                <span>Position</span>
                <input
                  type="number"
                  value={newImage.position}
                  onChange={(event) =>
                    setNewImage((prev) => ({
                      ...prev,
                      position: Number(event.target.value),
                    }))
                  }
                  className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[11px] font-semibold text-transparent">
                  Actions
                </span>
                <button
                  type="button"
                  onClick={addImage}
                  className="h-10 rounded-md bg-[#2f3e36] px-3 text-xs font-semibold text-white hover:bg-[#24312b]"
                >
                  Add image
                </button>
              </div>
            </div>
          </div>
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
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingVariantId) {
                  reorderVariants(draggingVariantId, variant.id);
                }
              }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span
                    className="cursor-grab select-none"
                    draggable
                    onDragStart={() => setDraggingVariantId(variant.id)}
                    onDragEnd={() => setDraggingVariantId(null)}
                  >
                    ⠿
                  </span>
                  {reorderingVariants && <span>Saving order…</span>}
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,140px)_minmax(0,140px)_minmax(0,140px)]">
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
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,140px)_minmax(0,140px)_minmax(0,140px)]">
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
                  </div>
                </div>

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
                  <div className="w-full rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
                    <div className="mb-1 font-semibold text-stone-700">
                      Cost incl. payment fees
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {CATALOG_PAYMENT_FEES.map((provider) => {
                        const adjusted = calculateAdjustedCostForProvider(
                          variant.priceCents,
                          variant.costCents,
                          provider
                        );
                        return (
                          <div key={`${variant.id}-${provider.label}`}>
                            <span className="font-semibold">{provider.label}:</span>{" "}
                            {toEuro(adjusted.adjustedCost)}{" "}
                            <span
                              className={
                                adjusted.profit >= 0 ? "text-stone-700" : "text-red-600"
                              }
                            >
                              (Profit {toEuro(adjusted.profit)})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1 text-[10px] text-stone-500">
                      Shipping fee base estimate: +7.90 EUR only for items {"\u003e="} 100 EUR.
                    </div>
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
                    onClick={() => {
                      setConfirmVariantId(variant.id);
                      setConfirmVariantTitle(variant.title);
                      setConfirmVariantText("");
                      setConfirmVariantError("");
                      setConfirmVariantPassword("");
                      setConfirmVariantPasswordError("");
                    }}
                    className="flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                    aria-label="Delete variant"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-700">
                          Options
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Create multiple attribute options for this product.
                        </p>
                      </div>
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
                                        imagePosition: null,
                                      },
                                    ],
                                  }
                                : item
                            )
                          )
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
                      >
                        <span className="text-base leading-none">＋</span>
                        Add value
                      </button>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white">
                      <div className="grid gap-2 border-b border-black/5 bg-stone-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500 md:grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_120px_88px]">
                        <span />
                        <span>Option</span>
                        <span>Value</span>
                        <span>Image position</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <div className="divide-y divide-black/5">
                        {variant.options.map((opt, optIndex) => (
                          <div
                            key={opt.id}
                            className="grid items-center gap-2 px-3 py-2 md:grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_120px_88px]"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (
                                draggingOption &&
                                draggingOption.variantId === variant.id
                              ) {
                                reorderVariantOptions(
                                  variant.id,
                                  draggingOption.optionId,
                                  opt.id
                                );
                                setDraggingOption(null);
                              }
                            }}
                          >
                            <div className="flex h-9 items-center justify-center">
                              <span
                                className="cursor-grab select-none text-stone-400"
                                draggable
                                onDragStart={() =>
                                  setDraggingOption({
                                    variantId: variant.id,
                                    optionId: opt.id,
                                  })
                                }
                                onDragEnd={() => setDraggingOption(null)}
                                aria-label="Drag option"
                              >
                                ⋮⋮
                              </span>
                            </div>
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
                              className="h-9 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-xs"
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
                                                ? { ...row, value: event.target.value }
                                                : row
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder="Option value"
                              className="h-9 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-xs"
                            />
                            <input
                              type="number"
                              min={0}
                              value={
                                typeof opt.imagePosition === "number"
                                  ? opt.imagePosition
                                  : ""
                              }
                              onChange={(event) => {
                                const raw = event.target.value.trim();
                                const nextValue = raw === "" ? null : Number(raw);
                                const sanitized =
                                  typeof nextValue === "number" &&
                                  Number.isFinite(nextValue)
                                    ? Math.max(0, Math.floor(nextValue))
                                    : null;
                                setVariants((prev) =>
                                  prev.map((item) =>
                                    item.id === variant.id
                                      ? {
                                          ...item,
                                          options: item.options.map(
                                            (row, rowIndex) =>
                                              rowIndex === optIndex
                                                ? { ...row, imagePosition: sanitized }
                                                : row
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }}
                              placeholder="0"
                              className="h-9 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-xs"
                            />
                            <div className="flex items-center justify-end gap-2">
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
                                className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-black/10 text-stone-500 hover:border-red-200 hover:text-red-600"
                                aria-label="Remove option"
                              >
                                <TrashIcon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <p className="text-xs text-stone-500">No variants yet.</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={saveAllVariants}
            disabled={savingAllVariants}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white hover:bg-[#24312b] disabled:opacity-60"
          >
            {savingAllVariants ? "Saving..." : "Save variants"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Häufig zusammen gekauft
            </h2>
            <p className="text-xs text-stone-500">
              Bis zu 3 Produkte manuell zuordnen.
            </p>
          </div>
          <button
            type="button"
            onClick={saveCrossSells}
            disabled={fbtSaving}
            className="h-9 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b] disabled:opacity-60"
          >
            {fbtSaving ? "Saving..." : "Save FBT"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {fbtItems.length > 0 ? (
            <div className="space-y-2">
              {fbtItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {index + 1}
                    </span>
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md border border-black/10 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-dashed border-black/10 bg-stone-50" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-800">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-stone-500">/{item.handle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFbtItems((prev) => prev.filter((entry) => entry.id !== item.id));
                      setFbtMessage("");
                    }}
                    className="h-8 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500">Noch keine FBT-Produkte ausgewählt.</p>
          )}

          <div className="rounded-lg border border-black/10 bg-stone-50 p-3">
            <label className="text-xs font-semibold text-stone-600">
              Produkt suchen
              <input
                value={fbtSearch}
                onChange={(event) => {
                  setFbtSearch(event.target.value);
                  setFbtMessage("");
                }}
                placeholder="Titel eingeben..."
                className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30"
              />
            </label>

            {fbtSearching ? (
              <p className="mt-2 text-xs text-stone-500">Suche...</p>
            ) : null}

            {!fbtSearching && fbtSearch.trim() && fbtResults.length > 0 ? (
              <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-black/10 bg-white p-1">
                {fbtResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setFbtItems((prev) => {
                        if (prev.some((item) => item.id === result.id) || prev.length >= 3) {
                          return prev;
                        }
                        return [...prev, result];
                      });
                      setFbtSearch("");
                      setFbtResults([]);
                      setFbtMessage("");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-stone-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-stone-800">
                        {result.title}
                      </span>
                      <span className="block truncate text-xs text-stone-500">
                        /{result.handle}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-[#2f3e36]">Hinzufügen</span>
                  </button>
                ))}
              </div>
            ) : null}

            {fbtItems.length >= 3 ? (
              <p className="mt-2 text-xs text-amber-700">
                Maximum erreicht (3 Produkte).
              </p>
            ) : null}
          </div>

          {fbtMessage ? (
            <p
              className={`text-xs font-medium ${
                fbtMessage === "Saved" ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {fbtMessage}
            </p>
          ) : null}
        </div>
      </section>

      {addVariantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setAddVariantOpen(false)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">
                  Add variant
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Fill in pricing, inventory, and option details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddVariantOpen(false)}
                className="h-9 rounded-md border border-black/10 px-3 text-xs font-semibold text-stone-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_minmax(140px,180px)_minmax(140px,180px)]">
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
              <div className="grid gap-3 md:grid-cols-[minmax(140px,180px)_minmax(140px,180px)]">
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
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="space-y-2">
                {newVariant.options.map((opt, index) => (
                  <div
                    key={index}
                    className="grid gap-2 md:grid-cols-[1fr_1fr_110px_auto]"
                  >
                    <input
                      value={opt.name}
                      onChange={(event) =>
                        setNewVariant((prev) => ({
                          ...prev,
                          options: prev.options.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, name: event.target.value }
                              : row
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
                            rowIndex === index
                              ? { ...row, value: event.target.value }
                              : row
                          ),
                        }))
                      }
                      placeholder="Option value"
                      className="h-9 rounded-md border border-black/15 px-3 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={
                        typeof opt.imagePosition === "number"
                          ? opt.imagePosition
                          : ""
                      }
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const nextValue = raw === "" ? null : Number(raw);
                        const sanitized =
                          typeof nextValue === "number" &&
                          Number.isFinite(nextValue)
                            ? Math.max(0, Math.floor(nextValue))
                            : null;
                        setNewVariant((prev) => ({
                          ...prev,
                          options: prev.options.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, imagePosition: sanitized }
                              : row
                          ),
                        }));
                      }}
                      placeholder="Image #"
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
              </div>
              <button
                type="button"
                onClick={() =>
                  setNewVariant((prev) => ({
                    ...prev,
                    options: [...prev.options, { name: "", value: "", imagePosition: null }],
                  }))
                }
                className="h-9 rounded-md border border-black/15 px-3 text-xs font-semibold"
              >
                New option
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddVariantOpen(false)}
                className="h-10 rounded-md border border-black/10 px-4 text-xs font-semibold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addVariant}
                className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
              >
                Add variant
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmVariantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 text-sm text-stone-800 shadow-xl sm:p-5">
            <h3 className="text-base font-semibold text-stone-900">
              Variante löschen
            </h3>
            <p className="mt-2 text-xs text-stone-600">
              Tippe{" "}
              <span className="font-semibold text-red-600">Bestätigen</span>{" "}
              ein, um{" "}
              <span className="font-semibold text-stone-800">
                {confirmVariantTitle}
              </span>{" "}
              zu löschen.
            </p>
            <input
              type="text"
              value={confirmVariantText}
              onChange={(event) => setConfirmVariantText(event.target.value)}
              className="mt-3 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              placeholder="Bestätigen"
            />
            <input
              type="password"
              value={confirmVariantPassword}
              onChange={(event) => {
                setConfirmVariantPassword(event.target.value);
                if (confirmVariantPasswordError) {
                  setConfirmVariantPasswordError("");
                }
              }}
              className="mt-3 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              placeholder="Admin-Passwort"
            />
            {confirmVariantError && (
              <p className="mt-2 text-xs text-red-600">{confirmVariantError}</p>
            )}
            {confirmVariantPasswordError && (
              <p className="mt-2 text-xs text-red-600">
                {confirmVariantPasswordError}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmVariantId(null);
                  setConfirmVariantError("");
                }}
                disabled={confirmVariantLoading}
                className="rounded-md border border-black/10 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-black/30 disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmVariantText !== "Bestätigen") {
                    setConfirmVariantError("Bitte Bestätigen eingeben.");
                    return;
                  }
                  const adminPassword = confirmVariantPassword.trim();
                  if (!adminPassword) {
                    setConfirmVariantPasswordError(
                      "Bitte Admin-Passwort eingeben."
                    );
                    return;
                  }
                  if (!confirmVariantId) return;
                  setConfirmVariantLoading(true);
                  setConfirmVariantError("");
                  await deleteVariant(confirmVariantId, adminPassword);
                  setConfirmVariantLoading(false);
                  setConfirmVariantId(null);
                }}
                disabled={confirmVariantLoading}
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {confirmVariantLoading ? "Löschen..." : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
