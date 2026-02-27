"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bars3Icon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  BoltIcon,
  CloudIcon,
  CubeIcon,
  DocumentTextIcon,
  FireIcon,
  FunnelIcon,
  HeartIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  ScaleIcon,
  Squares2X2Icon,
  ShoppingBagIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";
import type { AddedItem } from "./CartProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { seoPages } from "@/lib/seoPages";
import type { NavbarSearchResult } from "@/components/navbar/NavbarSearchResultsPopover";

const PaymentMethodLogos = dynamic(
  () => import("@/components/PaymentMethodLogos"),
  { ssr: false },
);
const CheckoutAuthModal = dynamic(
  () => import("@/components/CheckoutAuthModal"),
  { ssr: false },
);
const NavbarAccountPanel = dynamic(
  () => import("@/components/navbar/NavbarAccountPanel"),
  { ssr: false },
);
const NavbarCartDrawer = dynamic(
  () => import("@/components/navbar/NavbarCartDrawer"),
  { ssr: false },
);
const NavbarSearchResultsPopover = dynamic(
  () => import("@/components/navbar/NavbarSearchResultsPopover"),
  { ssr: false },
);
const NavbarMobileCategoriesOverlay = dynamic(
  () => import("@/components/navbar/NavbarMobileCategoriesOverlay"),
  { ssr: false },
);

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

const toCartItems = (cart: NonNullable<ReturnType<typeof useCart>["cart"]>) =>
  cart.lines.map((line) => ({
    item_id: line.merchandise.id,
    item_name: line.merchandise.product.title,
    item_variant: line.merchandise.title,
    item_brand: line.merchandise.product.manufacturer ?? undefined,
    item_category: line.merchandise.product.categories?.[0]?.name,
    price: Number(line.merchandise.price.amount),
    quantity: line.quantity,
  }));

const seoSlugByKey = new Map<string, string>();
const addSeoKey = (key: string, slug: string) => {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return;
  if (seoSlugByKey.has(normalized)) return;
  seoSlugByKey.set(normalized, slug);
};

seoPages.forEach((page) => {
  const slug = `/${page.slugParts.join("/")}`;
  if (page.slugParts.length === 1) {
    addSeoKey(page.slugParts[0], slug);
    addSeoKey(page.categoryHandle ?? "", slug);
    (page.categoryHandleAliases ?? []).forEach((alias) => addSeoKey(alias, slug));
  }
  if (page.slugParts.length === 2) {
    const parent = page.slugParts[0];
    const child = page.slugParts[1];
    addSeoKey(`${parent}/${child}`, slug);
    addSeoKey(`${parent}-${child}`, slug);
    if (page.parentHandle && page.subcategoryHandle) {
      addSeoKey(`${page.parentHandle}/${page.subcategoryHandle}`, slug);
      addSeoKey(`${page.parentHandle}-${page.subcategoryHandle}`, slug);
      (page.subcategoryHandleAliases ?? []).forEach((alias) => {
        addSeoKey(`${page.parentHandle}/${alias}`, slug);
        addSeoKey(`${page.parentHandle}-${alias}`, slug);
      });
    }
    if (parent.endsWith("en")) {
      const singular = parent.slice(0, -2);
      if (singular) {
        addSeoKey(`${singular}/${child}`, slug);
        addSeoKey(`${singular}-${child}`, slug);
      }
    }
  }
});

const getCategoryIcon = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes("aschenbecher") || value.includes("ashtray"))
    return TrashIcon;
  if (value.includes("aufbewahrung") || value.includes("storage"))
    return ArchiveBoxIcon;
  if (value.includes("feuerzeug") || value.includes("lighter"))
    return FireIcon;
  if (value.includes("papers") || value.includes("papier"))
    return DocumentTextIcon;
  if (value.includes("rolling tray") || value.includes("tray"))
    return RectangleStackIcon;
  if (value.includes("waage") || value.includes("waagen") || value.includes("scale"))
    return ScaleIcon;
  if (value.includes("duenger") || value.includes("dünger")) return BeakerIcon;
  if (value.includes("substrat") || value.includes("erde")) return BeakerIcon;
  if (value.includes("filter")) return FunnelIcon;
  if (value.includes("growbox") || value.includes("zelt")) return CubeIcon;
  if (value.includes("heat") || value.includes("heiz")) return FireIcon;
  if (value.includes("licht")) return SunIcon;
  if (value.includes("led") || value.includes("lampe")) return LightBulbIcon;
  if (value.includes("luft") || value.includes("luefter") || value.includes("lüfter"))
    return CloudIcon;
  if (value.includes("bewaesser") || value.includes("bewässer") || value.includes("wasser"))
    return CloudIcon;
  if (value.includes("entfeucht") || value.includes("befeucht"))
    return CloudIcon;
  if (value.includes("schlauch") || value.includes("kanal") || value.includes("duct"))
    return ArrowsRightLeftIcon;
  if (value.includes("ventilator") || value.includes("rohrventilator"))
    return ArrowPathIcon;
  if (value.includes("set") || value.includes("bundle"))
    return Squares2X2Icon;
  if (value.includes("anzucht") || value.includes("samen") || value.includes("seed"))
    return SparklesIcon;
  if (value.includes("zubehoer") || value.includes("zubehör") || value.includes("tool"))
    return WrenchScrewdriverIcon;
  return BoltIcon;
};

export function Navbar() {
  const { cart, loading, error, refresh } = useCart();
  const { ids } = useWishlist();
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAuthenticated = status === "authenticated";
  const isSeoPage = seoPages.some(
    (page) => `/${page.slugParts.join("/")}` === pathname,
  );
  const showCategoryBar =
    pathname === "/" ||
    pathname?.startsWith("/products") ||
    pathname === "/bestseller" ||
    pathname === "/neuheiten" ||
    isSeoPage;
  const showMobileSearch = showCategoryBar;
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoryNavTarget, setCategoryNavTarget] = useState<string | null>(null);
  const [categoryHoverLocked, setCategoryHoverLocked] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null);
  const cartPanelRef = useRef<HTMLElement | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [showCheckoutAuthModal, setShowCheckoutAuthModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileAddedItem, setMobileAddedItem] = useState<AddedItem | null>(
    null,
  );
  const [mobileAddedOpen, setMobileAddedOpen] = useState(false);
  const [mobileAddedAnchor, setMobileAddedAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NavbarSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const searchTrackedRef = useRef<string | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryStack, setCategoryStack] = useState<string[]>([]);
  const [categories, setCategories] = useState<
    Array<{
      id: string;
      name: string;
      handle: string;
      parentId: string | null;
      itemCount: number;
      totalItemCount: number;
    }>
  >([]);
  const [categoriesStatus, setCategoriesStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const productsRef = useRef<HTMLDivElement | null>(null);
  const mobileProductsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const productsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const productsPopupRef = useRef<HTMLDivElement | null>(null);
  const searchPopupRef = useRef<HTMLDivElement | null>(null);
  const accountPopupRef = useRef<HTMLDivElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);

  const count = loading ? 0 : (cart?.totalQuantity ?? 0);
  const wishlistCount = ids.length;
  const [cartPop, setCartPop] = useState(false);
  const [wishlistPop, setWishlistPop] = useState(false);
  const canCheckout =
    !loading && !!cart && cart.lines.length > 0 && checkoutStatus !== "loading";
  const returnTo = useMemo(() => {
    if (pathname?.startsWith("/auth")) return "/";
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileAddedOpen) return;
    let rafId: number | null = null;
    const updateAnchor = () => {
      const rect = cartRef.current?.getBoundingClientRect();
      if (!rect) return;
      const right = Math.max(0, window.innerWidth - rect.right);
      const top = rect.bottom + 8;
      setMobileAddedAnchor((prev) => {
        if (prev && prev.top === top && prev.right === right) return prev;
        return { top, right };
      });
    };
    const scheduleAnchorUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateAnchor();
      });
    };
    updateAnchor();
    window.addEventListener("resize", scheduleAnchorUpdate);
    window.addEventListener("scroll", scheduleAnchorUpdate, { passive: true });
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleAnchorUpdate);
      window.removeEventListener("scroll", scheduleAnchorUpdate);
    };
  }, [isMobile, mobileAddedOpen]);

  useEffect(() => {
    if (!cartOpen || isMobile || loading || cart) return;
    void refresh();
  }, [cartOpen, cart, isMobile, loading, refresh]);

  useEffect(() => {
    setCategoryNavTarget(null);
    setCategoryHoverLocked(false);
  }, [pathname, searchParams]);

  const buildCategoryHref = (handle: string) =>
    `/products?category=${encodeURIComponent(handle)}`;
  const buildSeoCategoryHref = (handle: string, parentHandle?: string | null) => {
    const normalizedHandle = handle.trim().toLowerCase();
    const normalizedParent = parentHandle?.trim().toLowerCase();
    if (normalizedParent) {
      const key = `${normalizedParent}/${normalizedHandle}`;
      const slug = seoSlugByKey.get(key);
      if (slug) return slug;
      if (normalizedHandle.startsWith(`${normalizedParent}-`)) {
        const stripped = normalizedHandle.slice(normalizedParent.length + 1);
        const strippedKey = `${normalizedParent}/${stripped}`;
        const strippedSlug = seoSlugByKey.get(strippedKey);
        if (strippedSlug) return strippedSlug;
      }
    }
    const mainSlug = seoSlugByKey.get(normalizedHandle);
    if (mainSlug) return mainSlug;
    return buildCategoryHref(handle);
  };

  useEffect(() => {
    if (count === 0) return;
    setCartPop(true);
    const timer = setTimeout(() => setCartPop(false), 250);
    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (wishlistCount === 0) return;
    setWishlistPop(true);
    const timer = setTimeout(() => setWishlistPop(false), 250);
    return () => clearTimeout(timer);
  }, [wishlistCount]);

  useEffect(() => {
    const handleOutsideInteraction = (event: MouseEvent | FocusEvent) => {
      if (
        accountOpen &&
        accountPopupRef.current &&
        accountPopupRef.current.contains(event.target as Node)
      ) {
        return;
      }
      if (!accountRef.current) return;
      if (!accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (!cartRef.current) return;
      const target = event.target as Node;
      const clickInsideToggle = cartRef.current.contains(target);
      const clickInsidePanel = cartPanelRef.current?.contains(target) ?? false;
      if (!clickInsideToggle && !clickInsidePanel) {
        setCartOpen(false);
      }
      if (
        productsOpen &&
        !productsRef.current?.contains(event.target as Node) &&
        !mobileProductsRef.current?.contains(event.target as Node) &&
        !productsPopupRef.current?.contains(event.target as Node)
      ) {
        setProductsOpen(false);
        setCategoryStack([]);
        setCategoryQuery("");
      }
      const clickInsideSearch =
        searchRef.current?.contains(target) ||
        mobileSearchRef.current?.contains(target) ||
        (searchPopupRef.current?.contains(target) ?? false);
      if (searchOpen && !clickInsideSearch) {
        setSearchOpen(false);
      }
      const menuTarget = event.target as Node;
      if (menuOpen && menuPopupRef.current?.contains(menuTarget)) {
        return;
      }
      const menuRoot = document.getElementById("mobile-nav-menu");
      if (menuOpen && menuRoot && !menuRoot.contains(menuTarget)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideInteraction);
    document.addEventListener("focusin", handleOutsideInteraction);
    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("focusin", handleOutsideInteraction);
    };
  }, [accountOpen, cartOpen, menuOpen, productsOpen, searchOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadCategories = async () => {
      setCategoriesStatus("loading");
      try {
        const res = await fetch("/api/categories");
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as {
          categories?: Array<{
            id: string;
            name: string;
            handle: string;
            parentId: string | null;
            itemCount: number;
            totalItemCount: number;
          }>;
        };
        if (!ignore) {
          setCategories(data.categories ?? []);
          setCategoriesStatus("idle");
        }
      } catch {
        if (!ignore) {
          setCategoriesStatus("error");
        }
      }
    };
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  const canPortal = typeof document !== "undefined";
  const [productsPopupStyle, setProductsPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [searchPopupStyle, setSearchPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [accountPopupStyle, setAccountPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [menuPopupStyle, setMenuPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!productsOpen || !productsTriggerRef.current) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = productsTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = {
        top: rect.bottom + 12,
        left: rect.left,
        width: 360,
      };
      setProductsPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [productsOpen]);

  useEffect(() => {
    const activeSearchRef = isMobile
      ? (mobileSearchRef.current ?? searchRef.current)
      : searchRef.current;
    if (!searchOpen || !activeSearchRef) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = activeSearchRef?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const viewportWidth = window.innerWidth;
      const width = Math.min(rect.width, viewportWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        viewportWidth - viewportPadding - width,
      );
      const next = {
        top: rect.bottom + 12,
        left,
        width,
      };
      setSearchPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isMobile, searchOpen]);

  useEffect(() => {
    if (!accountOpen || !accountRef.current) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = accountRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, Math.max(280, rect.width));
      const next = {
        top: rect.bottom + 12,
        left: rect.right - width,
        width,
      };
      setAccountPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!menuOpen || !menuTriggerRef.current) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = menuTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = {
        top: rect.bottom,
        left: rect.left,
        width: 240,
      };
      setMenuPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [menuOpen]);

  const mainCategories = useMemo(() => {
    const roots = categories.filter((category) => !category.parentId);
    return [...roots].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchStatus("idle");
      searchTrackedRef.current = null;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchStatus("loading");
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as {
          results?: Array<{
            id: string;
            title: string;
            handle: string;
            imageUrl: string | null;
            imageAlt: string | null;
            price: { amount: string; currencyCode: string } | null;
          }>;
        };
        setSearchResults(data.results ?? []);
        setSearchStatus("idle");
        if (searchTrackedRef.current !== trimmed) {
          searchTrackedRef.current = trimmed;
          trackAnalyticsEvent("search", { search_term: trimmed });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSearchResults([]);
        setSearchStatus("error");
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    setProductsOpen(false);
    setCategoryStack([]);
    setCategoryQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!isMobile) {
      setMobileAddedOpen(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleAdded = (event: Event) => {
      const detail = (event as CustomEvent<AddedItem>).detail;
      if (!detail) return;
      setMobileAddedItem(detail);
      setMobileAddedOpen(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMobileAddedOpen(false), 3500);
    };
    window.addEventListener("cart:item-added", handleAdded);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("cart:item-added", handleAdded);
    };
  }, [isMobile]);

  const proceedToCheckout = async () => {
    if (!cart || cart.lines.length === 0) {
      router.push("/cart");
      return;
    }
    trackAnalyticsEvent("begin_checkout", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      items: toCartItems(cart),
    });
    setCheckoutStatus("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: "DE" }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        setCheckoutStatus("error");
        router.push("/cart");
        return;
      }
      trackAnalyticsEvent("add_payment_info", {
        currency: cart.cost.subtotalAmount.currencyCode,
        value: Number(cart.cost.subtotalAmount.amount),
        payment_type: "stripe_checkout",
        items: toCartItems(cart),
      });
      window.location.assign(data.url);
    } catch {
      setCheckoutStatus("error");
      router.push("/cart");
    }
  };

  const startCheckout = async () => {
    if (!cart || cart.lines.length === 0) {
      router.push("/cart");
      return;
    }
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setShowCheckoutAuthModal(true);
      return;
    }
    await proceedToCheckout();
  };

  const categoriesByParent = useMemo(() => {
    const isSetCategory = (name: string) =>
      name.toLowerCase().includes("set");
    const map = new Map<
      string | null,
      Array<{
        id: string;
        name: string;
        handle: string;
        parentId: string | null;
        itemCount: number;
        totalItemCount: number;
      }>
    >();
    categories.forEach((category) => {
      const key = category.parentId ? String(category.parentId) : null;
      const list = map.get(key) ?? [];
      list.push({
        ...category,
        parentId: category.parentId ? String(category.parentId) : null,
      });
      map.set(key, list);
    });
    map.forEach((list, key) => {
      list.sort((a, b) => {
        if (key !== null) {
          const aIsSet = isSetCategory(a.name);
          const bIsSet = isSetCategory(b.name);
          if (aIsSet !== bIsSet) return aIsSet ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      map.set(key, list);
    });
    return map;
  }, [categories]);
  const activeParentId =
    categoryStack.length > 0
      ? String(categoryStack[categoryStack.length - 1])
      : null;
  const activeCategories = categoriesByParent.get(activeParentId) ?? [];
  const categoryById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; handle: string }>();
    categories.forEach((category) => {
      map.set(category.id, {
        id: category.id,
        name: category.name,
        handle: category.handle,
      });
    });
    return map;
  }, [categories]);
  const activeParentCategory = activeParentId
    ? (categoryById.get(activeParentId) ?? null)
    : null;
  const childCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    categoriesByParent.forEach((list, key) => {
      if (key === null) return;
      map.set(key, list.length);
    });
    return map;
  }, [categoriesByParent]);
  const filteredCategories =
    categoryQuery.trim().length > 0
      ? activeCategories.filter((category) =>
          category.name.toLowerCase().includes(categoryQuery.toLowerCase()),
        )
      : activeCategories;

  return (
    <>
      <nav className="fixed top-10 left-0 z-40 w-full border-b border-black/10 bg-stone-100 isolate">
        <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-6xl">
          <div className="py-2 sm:py-2">
            <div className="relative flex items-center justify-center sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
              {/* LEFT (spacer) */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0">
                <div id="mobile-nav-menu" className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    ref={menuTriggerRef}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-stone-700 shadow-sm hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Navigation oeffnen"
                  >
                    <Bars3Icon className="h-5 w-5" />
                  </button>
                </div>
                {menuOpen &&
                  canPortal &&
                  menuPopupStyle &&
                  createPortal(
                    <div
                      ref={menuPopupRef}
                      className="fixed z-[1300] mt-3 w-60 rounded-xl border border-black/10 bg-white p-3 text-sm shadow-xl"
                      style={{
                        top: menuPopupStyle.top,
                        left: menuPopupStyle.left,
                        width: menuPopupStyle.width,
                      }}
                      aria-hidden={!menuOpen}
                    >
                      <Link
                        href="/products"
                        onClick={(event) => {
                          event.preventDefault();
                          setMenuOpen(false);
                          setProductsOpen(true);
                        }}
                        className="block rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        Webshop
                      </Link>
                      <Link
                        href="/customizer"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        Pflanzenzelt-Konfigurator
                      </Link>
                    </div>,
                    document.body,
                  )}
                <div className="hidden items-center gap-5 text-xs font-semibold text-stone-800 sm:flex sm:gap-8 sm:text-base">
                  {mounted ? (
                    <div className="relative" ref={productsRef}>
                      <button
                        ref={productsTriggerRef}
                        type="button"
                        onClick={() =>
                          setProductsOpen((prev) => {
                            const next = !prev;
                            if (!next) {
                              setCategoryStack([]);
                            }
                            return next;
                          })
                        }
                        className="inline-flex cursor-pointer items-center text-base sm:text-lg font-semibold text-[#2f3e36] hover:text-[#1f2a24] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                      >
                        Webshop
                      </button>
                      {productsOpen &&
                        !isMobile &&
                        canPortal &&
                        productsPopupStyle &&
                        createPortal(
                          <div
                            ref={productsPopupRef}
                            className="fixed z-[999] mt-3 w-[360px] rounded-2xl border border-emerald-200 bg-white p-3 text-sm text-emerald-950 shadow-xl shadow-emerald-900/15"
                            style={{
                              top: productsPopupStyle.top,
                              left: productsPopupStyle.left,
                              width: productsPopupStyle.width,
                            }}
                          >
                            <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 shadow-sm">
                              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                                {categoryStack.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCategoryStack((prev) =>
                                        prev.slice(0, -1),
                                      )
                                    }
                                    className="cursor-pointer rounded-full border border-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-800 hover:border-emerald-300 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                  >
                                    ← Zurück
                                  </button>
                                ) : (
                                  <span className="ml-4 mt-1 text-lg font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                    Kategorien
                                  </span>
                                )}
                                <Link
                                  href="/products"
                                  onClick={() => {
                                    setProductsOpen(false);
                                    setCategoryStack([]);
                                  }}
                                  className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                >
                                  Alle Produkte
                                </Link>
                              </div>
                              <div className="mt-2 space-y-2">
                                {categoriesStatus === "loading" && (
                                  <div className="px-2 py-2 text-xs text-stone-500">
                                    Laedt Kategorien...
                                  </div>
                                )}
                                {categoriesStatus === "error" && (
                                  <div className="px-2 py-2 text-xs text-rose-300">
                                    Kategorien konnten nicht geladen werden.
                                  </div>
                                )}
                                {categoriesStatus === "idle" &&
                                  activeCategories.length === 0 && (
                                    <div className="px-2 py-2 text-xs text-stone-500">
                                      Keine Kategorien gefunden.
                                    </div>
                                  )}
                                {categoriesStatus === "idle" &&
                                  activeParentCategory && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push(
                                          `/products?category=${encodeURIComponent(
                                            activeParentCategory.handle,
                                          )}`,
                                        );
                                        setProductsOpen(false);
                                        setCategoryStack([]);
                                      }}
                                      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-base font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                    >
                                      <span>
                                        Alle {activeParentCategory.name}
                                      </span>
                                      <span className="text-sm text-emerald-600">
                                        →
                                      </span>
                                    </button>
                                  )}
                                {categoriesStatus === "idle" &&
                                  activeCategories.map((category) => {
                                    const CategoryIcon = getCategoryIcon(
                                      category.name,
                                    );
                                    const childCount =
                                      categoriesByParent.get(
                                        String(category.id),
                                      )?.length ?? 0;
                                    const isLeaf = childCount === 0;
                                    return (
                                      <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => {
                                          if (isLeaf) {
                                            router.push(
                                              `/products?category=${encodeURIComponent(
                                                category.handle,
                                              )}`,
                                            );
                                            setProductsOpen(false);
                                            setCategoryStack([]);
                                            return;
                                          }
                                          setCategoryStack((prev) => [
                                            ...prev,
                                            category.id,
                                          ]);
                                        }}
                                        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-base font-semibold text-emerald-950 shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                      >
                                        <span className="flex items-center gap-2">
                                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                                            <CategoryIcon className="h-4 w-4" />
                                          </span>
                                          <span>{category.name}</span>
                                        </span>
                                        <span className="flex items-center gap-2 text-sm text-emerald-600">
                                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                            {category.totalItemCount}
                                          </span>
                                          {!isLeaf && <span>›</span>}
                                        </span>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>,
                          document.body,
                        )}
                    </div>
                  ) : (
                    <Link
                      href="/products"
                      className="inline-flex cursor-pointer items-center text-base sm:text-lg font-semibold text-[#2f3e36] hover:text-[#1f2a24] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      Produkte
                    </Link>
                  )}
                  <Link
                    href="/customizer"
                    className="cursor-pointer text-base sm:text-lg font-semibold text-[#2f3e36] hover:text-[#1f2a24] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    Pflanzenzelt-Konfigurator
                  </Link>
                </div>
              </div>

              {/* CENTER */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:col-start-2 sm:flex-nowrap sm:gap-6">
                <div className="relative flex items-center gap-3 sm:gap-6">
                  <Link href="/" className="flex items-center">
                    <Image
                      src="/images/smokeify2.png"
                      alt="Smokeify Logo"
                      className="h-12 w-auto object-contain sm:h-16"
                      priority
                      width={180}
                      height={64}
                    />
                  </Link>
                </div>
              </div>

              {/* RIGHT */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0 text-stone-800 sm:static sm:col-start-3 sm:translate-y-0 sm:justify-end sm:gap-2">
                <div
                  ref={searchRef}
                  className="relative z-[60] hidden w-[240px] md:block lg:w-[300px] lg:-translate-x-2"
                >
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        if (!searchOpen) setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setSearchOpen(false);
                          return;
                        }
                        if (event.key === "Enter" && searchResults[0]) {
                          router.push(`/products/${searchResults[0].handle}`);
                          setSearchOpen(false);
                        }
                      }}
                      placeholder="Produkte suchen..."
                      className="h-10 w-full rounded-full border border-black/10 bg-white pl-9 pr-4 text-sm text-stone-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  {canPortal && (
                    <NavbarSearchResultsPopover
                      open={searchOpen}
                      searchStatus={searchStatus}
                      searchQuery={searchQuery}
                      searchResults={searchResults}
                      searchPopupStyle={searchPopupStyle}
                      popupRef={searchPopupRef}
                      onClose={() => setSearchOpen(false)}
                      onSelectResult={(item) => {
                        trackAnalyticsEvent("select_item", {
                          item_list_id: "search",
                          item_list_name: "search",
                          items: [
                            {
                              item_id: item.id,
                              item_name: item.title,
                              price: item.price
                                ? Number(item.price.amount)
                                : undefined,
                              quantity: 1,
                            },
                          ],
                        });
                        setSearchOpen(false);
                      }}
                    />
                  )}
                </div>
                <div className="relative" ref={cartRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) {
                        router.push("/cart");
                        return;
                      }
                      if (!cart && !loading) {
                        void refresh();
                      }
                      setCartOpen((prev) => !prev);
                    }}
                    className="relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full hover:bg-black/5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={cartOpen}
                    aria-haspopup="true"
                    aria-label="Warenkorb oeffnen"
                  >
                    <ShoppingBagIcon className="h-6 w-6" />
                    {count > 0 && (
                      <span
                        className={`absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-center text-[12px] font-semibold leading-none text-white ${
                          cartPop ? "badge-pop" : ""
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                  {isMobile &&
                    mobileAddedOpen &&
                    mobileAddedItem &&
                    mobileAddedAnchor &&
                    createPortal(
                      <div
                        className="fixed z-[90] w-64 rounded-xl border border-black/10 bg-white p-3 shadow-2xl"
                        style={{
                          top: mobileAddedAnchor.top,
                          right: mobileAddedAnchor.right,
                        }}
                      >
                      <div className="flex items-center gap-3">
                        {mobileAddedItem.imageUrl ? (
                          <Image
                            src={mobileAddedItem.imageUrl}
                            alt={
                              mobileAddedItem.imageAlt ?? mobileAddedItem.title
                            }
                            className="h-12 w-12 rounded-md object-cover"
                            width={48}
                            height={48}
                            sizes="48px"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-stone-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {mobileAddedItem.title}
                          </p>
                          {mobileAddedItem.price && (
                            <p className="text-xs text-stone-600">
                              {formatPrice(
                                mobileAddedItem.price.amount,
                                mobileAddedItem.price.currencyCode,
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-semibold">
                        <Link
                          href="/cart"
                          onClick={() => setMobileAddedOpen(false)}
                          className="block w-full rounded-lg border border-black/15 px-3 py-2 text-center text-stone-800 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          Warenkorb ansehen
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAddedOpen(false);
                            startCheckout();
                          }}
                          className="block w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-3 py-2 text-center text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          Zur Kasse
                        </button>
                        <PaymentMethodLogos
                          className="justify-center gap-[2px] sm:gap-2"
                          pillClassName="h-7 px-2 border-black/10 bg-white sm:h-8 sm:px-3"
                          logoClassName="h-4 sm:h-5"
                        />
                      </div>
                    </div>,
                      document.body,
                    )}
                </div>
                <Link
                  href="/wishlist"
                  className="relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full hover:bg-black/5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label="Wunschliste"
                >
                  <HeartIcon className="h-6 w-6" />
                  {wishlistCount > 0 && (
                    <span
                      className={`absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-center text-[12px] font-semibold leading-none text-white ${
                        wishlistPop ? "badge-pop" : ""
                      }`}
                    >
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <div className="relative -mr-1" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full hover:bg-black/5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={accountOpen}
                    aria-haspopup="true"
                    aria-label="Account"
                  >
                    <UserCircleIcon className="h-6 w-6" />
                  </button>
                  {accountOpen &&
                    canPortal &&
                    accountPopupStyle &&
                    createPortal(
                      <div
                        ref={accountPopupRef}
                        className="fixed z-[1005] mt-3 origin-top-right rounded-xl border border-black/10 bg-white p-4 text-sm shadow-xl"
                        style={{
                          top: accountPopupStyle.top,
                          left: accountPopupStyle.left,
                          width: accountPopupStyle.width,
                        }}
                        aria-hidden={!accountOpen}
                      >
                        <NavbarAccountPanel
                          mounted={mounted}
                          isAuthenticated={isAuthenticated}
                          returnTo={returnTo}
                        />
                      </div>,
                      document.body,
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {showMobileSearch && (
          <div
            className="relative z-[800] sm:hidden px-4 pb-3"
            ref={mobileSearchRef}
          >
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  if (!searchOpen) setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    return;
                  }
                  if (event.key === "Enter" && searchResults[0]) {
                    router.push(`/products/${searchResults[0].handle}`);
                    setSearchOpen(false);
                  }
                }}
                placeholder="Produkte suchen..."
                className="h-11 w-full rounded-full border border-black/10 bg-white pl-9 pr-4 text-sm text-stone-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>
        )}
        {showCategoryBar && (
          <div className="relative z-10 mt-2 hidden border-t border-black/5 bg-stone-100/95 shadow-sm backdrop-blur sm:block">
            <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2 px-4 py-3 text-base text-stone-700 sm:px-6 lg:max-w-6xl">
              <Link
                href="/bestseller"
                onClick={() => {
                  setCategoryNavTarget("/bestseller");
                  setCategoryHoverLocked(true);
                }}
                className="flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-1.5 text-base font-semibold text-stone-700 transition hover:border-emerald-300 hover:text-emerald-900"
              >
                <span>Bestseller</span>
                {categoryNavTarget === "/bestseller" && (
                  <LoadingSpinner
                    size="sm"
                    className="h-3 w-3 border-2 border-stone-200 border-t-emerald-700"
                  />
                )}
              </Link>
              {categoriesStatus === "loading" && (
                <span className="text-xs text-stone-500">
                  Laedt Kategorien...
                </span>
              )}
              {categoriesStatus === "error" && (
                <span className="text-xs text-red-600">
                  Kategorien konnten nicht geladen werden.
                </span>
              )}
              {categoriesStatus === "idle" && mainCategories.length === 0 && (
                <span className="text-xs text-stone-500">
                  Keine Kategorien gefunden.
                </span>
              )}
              {categoriesStatus === "idle" &&
                mainCategories.map((category) => (
                  <div
                    key={category.id}
                    className="relative group"
                  >
                    <Link
                      href={buildSeoCategoryHref(category.handle)}
                      onClick={() => {
                        setCategoryNavTarget(
                          buildSeoCategoryHref(category.handle),
                        );
                        setCategoryHoverLocked(true);
                      }}
                      className="flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-1.5 text-base font-semibold text-stone-700 transition hover:border-emerald-300 hover:text-emerald-900"
                    >
                      <span>{category.name}</span>
                      {categoryNavTarget ===
                        buildSeoCategoryHref(category.handle) && (
                        <LoadingSpinner
                          size="sm"
                          className="h-3 w-3 border-2 border-stone-200 border-t-emerald-700"
                        />
                      )}
                    </Link>
                    {(categoriesByParent.get(String(category.id))?.length ?? 0) >
                      0 && (
                      <>
                        <div className="pointer-events-auto absolute left-1/2 top-full z-20 h-3 w-28 -translate-x-1/2" />
                        <div
                          className={`invisible absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 translate-y-1 opacity-0 transition duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 delay-100 group-hover:delay-150 ${
                            categoryHoverLocked ? "hidden" : ""
                          }`}
                        >
                        <div
                          className="grid grid-flow-col auto-cols-max gap-1.5 rounded-xl border border-emerald-200 bg-white p-2.5 text-[15px] shadow-xl"
                          style={{
                            gridTemplateRows: `repeat(${Math.max(
                              1,
                              Math.min(
                                6,
                                (categoriesByParent.get(String(category.id)) ?? [])
                                  .length,
                              ),
                            )}, minmax(0, auto))`,
                          }}
                        >
                          {(categoriesByParent.get(String(category.id)) ?? []).map(
                            (child) => {
                              const ChildIcon = getCategoryIcon(child.name);
                              return (
                                <Link
                                  key={child.id}
                                  href={buildSeoCategoryHref(
                                    child.handle,
                                    category.handle,
                                  )}
                                  onClick={() =>
                                    {
                                      setCategoryNavTarget(
                                        buildSeoCategoryHref(
                                          child.handle,
                                          category.handle,
                                        ),
                                      );
                                      setCategoryHoverLocked(true);
                                    }
                                  }
                                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-3 font-semibold text-stone-700 hover:bg-emerald-50 hover:text-emerald-900"
                                >
                                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
                                    <ChildIcon className="h-4.5 w-4.5" />
                                  </span>
                                  <span className="flex-1 whitespace-nowrap">
                                    {child.name}
                                  </span>
                                  {categoryNavTarget ===
                                    buildSeoCategoryHref(
                                      child.handle,
                                      category.handle,
                                    ) && (
                                    <LoadingSpinner
                                      size="sm"
                                      className="h-3 w-3 border-2 border-stone-200 border-t-emerald-700"
                                    />
                                  )}
                                </Link>
                              );
                            },
                          )}
                        </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
        <NavbarCartDrawer
          open={cartOpen && !isMobile}
          cart={cart}
          loading={loading}
          error={error}
          canCheckout={canCheckout}
          checkoutStatus={checkoutStatus}
          onClose={() => setCartOpen(false)}
          onStartCheckout={() => void startCheckout()}
          panelRef={cartPanelRef}
        />
      </nav>
      <div
        className={
          showCategoryBar ? "h-[150px] sm:h-[184px]" : "h-[80px] sm:h-[113px]"
        }
        aria-hidden="true"
      />
      <NavbarMobileCategoriesOverlay
        open={isMobile && productsOpen}
        mobileProductsRef={mobileProductsRef}
        activeParentName={activeParentCategory?.name ?? "Übersicht"}
        categoryQuery={categoryQuery}
        hasCategoryStack={categoryStack.length > 0}
        categoriesStatus={categoriesStatus}
        filteredCategories={filteredCategories}
        childCountByCategoryId={childCountByCategoryId}
        onClose={() => {
          setProductsOpen(false);
          setCategoryStack([]);
          setCategoryQuery("");
        }}
        onCategoryQueryChange={setCategoryQuery}
        onBack={() => setCategoryStack((prev) => prev.slice(0, -1))}
        onViewAllProducts={() => {
          setProductsOpen(false);
          setCategoryStack([]);
          setCategoryQuery("");
        }}
        onViewParentCategory={() => {
          if (!activeParentCategory) return;
          router.push(
            `/products?category=${encodeURIComponent(activeParentCategory.handle)}`,
          );
          setProductsOpen(false);
          setCategoryStack([]);
          setCategoryQuery("");
        }}
        onSelectCategory={(category, isLeaf) => {
          if (isLeaf) {
            router.push(
              `/products?category=${encodeURIComponent(category.handle)}`,
            );
            setProductsOpen(false);
            setCategoryStack([]);
            setCategoryQuery("");
            return;
          }
          setCategoryStack((prev) => [...prev, category.id]);
          setCategoryQuery("");
        }}
      />
      <CheckoutAuthModal
        open={showCheckoutAuthModal}
        returnTo="/checkout/start"
        onClose={() => setShowCheckoutAuthModal(false)}
        onContinueAsGuest={() => {
          setShowCheckoutAuthModal(false);
          return proceedToCheckout();
        }}
      />
    </>
  );
}
