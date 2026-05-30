"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bars3Icon,
  HeartIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";
import type { AddedItem } from "./CartProvider";
import { useNavbarCategories } from "@/components/NavbarCategoriesProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { NEWSLETTER_OFFER_DISCOUNT_CENTS } from "@/lib/newsletterOffer";
import { buildCheckoutStartUrl } from "@/lib/checkoutStart";
import { SMOKEIFY_ROUTES } from "@/config/smokeify-routes";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import type { NavbarSearchResult } from "@/components/navbar/NavbarSearchResultsPopover";
import type { NavbarCategory } from "@/lib/navbarCategories";
import { getCategoryIcon } from "@/components/navbar/categoryIcons";

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
const NavbarMobileCategoriesSheet = dynamic(
  () => import("@/components/navbar/NavbarMobileCategoriesSheet"),
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

const getPrimaryCategoryLabel = (category: NavbarCategory) => {
  if (category.handle === "zelte") return "Growzelte";
  return category.name;
};

const toCartItems = (cart: NonNullable<ReturnType<typeof useCart>["cart"]>) =>
  cart.lines.map((line) => ({
    product_id: line.merchandise.product.id,
    item_id: line.merchandise.id,
    item_name: line.merchandise.product.title,
    item_variant: line.merchandise.title,
    item_brand: line.merchandise.product.manufacturer ?? undefined,
    item_category: line.merchandise.product.categories?.[0]?.name,
    price: Number(line.merchandise.price.amount),
    quantity: line.quantity,
  }));

type NavbarProps = {
  initialCategories?: NavbarCategory[];
};

export function Navbar({ initialCategories }: NavbarProps) {
  const { cart, loading, error, refresh } = useCart();
  const { ids } = useWishlist();
  const contextCategories = useNavbarCategories();
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAuthenticated = status === "authenticated";
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
  const [drawerDiscountCode, setDrawerDiscountCode] = useState("");
  const [appliedDrawerDiscountCode, setAppliedDrawerDiscountCode] = useState("");
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
  const categories =
    initialCategories && initialCategories.length > 0
      ? initialCategories
      : contextCategories;
  const isSeoPage = categories.some((category) => category.href === pathname);
  const showCategoryBar =
    pathname === "/" ||
    pathname?.startsWith("/products") ||
    pathname === "/bestseller" ||
    pathname === "/neuheiten" ||
    isSeoPage;
  const showMobileSearch = showCategoryBar;
  const categoriesStatus: "idle" | "loading" | "error" =
    categories.length > 0 ? "idle" : "error";
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
  const normalizedDrawerDiscountCode = drawerDiscountCode.trim();
  const appliedDrawerDiscountAmount =
    appliedDrawerDiscountCode && cart
      ? Math.min(
          Number(cart.cost.totalAmount.amount),
          NEWSLETTER_OFFER_DISCOUNT_CENTS / 100,
        )
      : 0;
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

  const canPortal = mounted;
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
      const width = Math.min(660, window.innerWidth - 32);
      const next = {
        top: rect.bottom + 12,
        left: Math.min(rect.left, window.innerWidth - width - 16),
        width,
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
    const preferredOrder = [
      "headshop",
      "zelte",
      "anzucht",
      "bewaesserung",
      "licht",
      "luft",
      "messen",
      "substrate-und-zubehoer",
    ];
    const sortedRoots = [...roots].sort((a, b) => {
      const orderA = preferredOrder.indexOf(a.handle);
      const orderB = preferredOrder.indexOf(b.handle);
      if (orderA !== -1 || orderB !== -1) {
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
    return sortedRoots.filter((category) => category.handle !== "headshop");
  }, [categories]);
  const allRootCategories = useMemo(() => {
    const roots = categories.filter((category) => !category.parentId);
    const preferredOrder = [
      "headshop",
      "zelte",
      "anzucht",
      "bewaesserung",
      "licht",
      "luft",
      "messen",
      "substrate-und-zubehoer",
    ];
    return [...roots].sort((a, b) => {
      const orderA = preferredOrder.indexOf(a.handle);
      const orderB = preferredOrder.indexOf(b.handle);
      if (orderA !== -1 || orderB !== -1) {
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
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
            defaultVariantId: string | null;
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
    const checkoutStartUrl = buildCheckoutStartUrl({
      country: "DE",
      discountCode: appliedDrawerDiscountCode || undefined,
    });
    setCartOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign(checkoutStartUrl);
      return;
    }
    router.push(checkoutStartUrl);
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

  const applyDrawerDiscountCode = () => {
    setAppliedDrawerDiscountCode(normalizedDrawerDiscountCode);
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
        href: string;
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
    const map = new Map<string, NavbarCategory>();
    categories.forEach((category) => {
      map.set(category.id, category);
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
  const activeDesktopRootId = useMemo(() => {
    const selectedRootId = categoryStack[0];
    if (selectedRootId && allRootCategories.some((category) => category.id === selectedRootId)) {
      return selectedRootId;
    }
    return allRootCategories[0]?.id ?? null;
  }, [allRootCategories, categoryStack]);
  const activeDesktopRootCategory = activeDesktopRootId
    ? (categoryById.get(activeDesktopRootId) ?? null)
    : null;
  const activeDesktopChildren = activeDesktopRootId
    ? categoriesByParent.get(activeDesktopRootId) ?? []
    : [];
  const filteredDesktopRootCategories =
    categoryQuery.trim().length > 0
      ? allRootCategories.filter((category) =>
          getPrimaryCategoryLabel(category)
            .toLowerCase()
            .includes(categoryQuery.toLowerCase()),
        )
      : allRootCategories;
  const productsActive = Boolean(
    productsOpen || pathname?.startsWith(SMOKEIFY_ROUTES.products),
  );
  const configuratorActive = Boolean(
    pathname?.startsWith(SMOKEIFY_ROUTES.customizer),
  );
  const analyzerActive = Boolean(
    pathname?.startsWith(SMOKEIFY_ROUTES.analyzer) ||
      pathname?.startsWith("/pflanzen-analyzer"),
  );
  const utilityIconButtonClass =
    "relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
  const desktopNavLinkClass = (active: boolean) =>
    `relative isolate inline-flex min-h-[52px] cursor-pointer select-none items-center overflow-hidden rounded-[20px] border px-4 py-2 text-[0.98rem] font-semibold tracking-[-0.02em] shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md transition-all duration-200 ease-out before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-white/12 before:content-[''] after:absolute after:bottom-2 after:left-4 after:h-[2px] after:rounded-full after:transition-all after:duration-200 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
      active
        ? "border-[var(--smk-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03)_28%,rgba(233,188,116,0.14)_100%)] text-[var(--smk-text)] shadow-[0_20px_42px_rgba(233,188,116,0.14)] ring-1 ring-white/8 after:w-12 after:bg-[var(--smk-accent)]"
        : "border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_42%,rgba(0,0,0,0.08))] text-[var(--smk-text-muted)] after:w-8 after:bg-white/8 hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(233,188,116,0.08)_100%)] hover:text-[var(--smk-text)] hover:shadow-[0_22px_38px_rgba(233,188,116,0.1)] hover:after:w-12 hover:after:bg-[var(--smk-accent)]/55"
    }`;
  const renderNavLabel = (
    iconName: "package" | "configurator" | "analyzer",
    label: string,
  ) => (
    <span className="relative z-[1] inline-flex items-center gap-2 whitespace-nowrap">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(233,188,116,0.16)] bg-[rgba(233,188,116,0.08)] text-[var(--smk-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <GrowvaultIcon name={iconName} size={15} />
      </span>
      <span>{label}</span>
    </span>
  );

  return (
    <>
      <nav
        className="fixed left-0 top-0 z-40 isolate w-full border-b border-[var(--smk-border)] bg-[rgba(14,14,13,0.82)] shadow-[0_20px_56px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-transform duration-300"
        style={{ transform: "translateY(var(--smk-announcement-offset))" }}
      >
        <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1280px] lg:px-8">
          <div className="py-2 sm:py-2">
            <div className="relative flex items-center justify-center sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
              {/* LEFT (spacer) */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0">
                <div id="mobile-nav-menu" className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    ref={menuTriggerRef}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-[var(--smk-text)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 ${
                      menuOpen
                        ? "border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.08)] shadow-lg shadow-black/30 focus-visible:ring-offset-black"
                        : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:ring-offset-black"
                    }`}
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Navigation öffnen"
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
                      className="webshop-dropdown-in fixed z-[1300] mt-3 w-60 rounded-[26px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.98))] p-3 text-sm text-[var(--smk-text)] shadow-2xl shadow-black/40 backdrop-blur-xl"
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
                      className="block rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        {renderNavLabel("package", "Produkte")}
                      </Link>
                      <Link
                        href={SMOKEIFY_ROUTES.customizer}
                        onClick={() => setMenuOpen(false)}
                        className="mt-2 block rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        {renderNavLabel("configurator", "Setup")}
                      </Link>
                      <Link
                        href={SMOKEIFY_ROUTES.analyzer}
                        onClick={() => setMenuOpen(false)}
                        className="mt-2 block rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        {renderNavLabel("analyzer", "Analyse")}
                      </Link>
                    </div>,
                    document.body,
                  )}
                <div className="hidden items-center gap-5 text-xs font-semibold text-[var(--smk-text-muted)] sm:flex sm:gap-8 sm:text-base">
                  <div className="relative" ref={productsRef}>
                    <button
                      ref={productsTriggerRef}
                      type="button"
                      onClick={() =>
                        setProductsOpen((prev) => {
                          const next = !prev;
                          if (!next) {
                            setCategoryStack([]);
                            setCategoryQuery("");
                          }
                          return next;
                        })
                      }
                      className={desktopNavLinkClass(productsActive)}
                      aria-expanded={productsOpen}
                      aria-haspopup="true"
                    >
                      {renderNavLabel("package", "Produkte")}
                    </button>
                    {productsOpen &&
                      !isMobile &&
                      canPortal &&
                      productsPopupStyle &&
                      createPortal(
                          <div
                            ref={productsPopupRef}
                            className="webshop-dropdown-in fixed z-[999] mt-3 max-h-[calc(100vh-8rem)] w-[340px] overflow-hidden rounded-[24px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.98))] p-2 text-sm text-[var(--smk-text)] shadow-2xl shadow-black/40 backdrop-blur-xl"
                            style={{
                              top: productsPopupStyle.top,
                              left: productsPopupStyle.left,
                              width: productsPopupStyle.width,
                            }}
                          >
                            <div className="h-full rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-3">
                              <div className="flex items-start justify-between gap-3 border-b border-[var(--smk-border)] pb-2.5">
                                <div>
                                  <p className="smk-kicker text-[var(--smk-accent)]">
                                    Katalog
                                  </p>
                                  <h3 className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.05em] text-[var(--smk-text)] lg:text-[1.9rem]">
                                    Produkte schneller finden
                                  </h3>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                                  <span className="rounded-full bg-[var(--smk-accent)] px-2 py-1 text-[var(--smk-bg)]">
                                    DE
                                  </span>
                                  <span>EN</span>
                                </div>
                              </div>

                              <div className="mt-2.5 grid gap-2 border-b border-[var(--smk-border)] pb-2.5 sm:grid-cols-2">
                                <Link
                                  href="/products"
                                  onClick={() => {
                                    setProductsOpen(false);
                                    setCategoryStack([]);
                                    setCategoryQuery("");
                                  }}
                                  className="flex items-center justify-between rounded-[18px] border border-[rgba(241,198,132,0.18)] bg-[linear-gradient(135deg,rgba(241,198,132,0.95),rgba(217,119,69,0.92))] px-3.5 py-2 text-[var(--smk-bg)] transition hover:brightness-105"
                                >
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(28,21,16,0.68)]">
                                      Sortiment
                                    </p>
                                    <p className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] sm:text-[1.28rem]">
                                      Alle Produkte
                                    </p>
                                  </div>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-[16px] border border-[rgba(28,21,16,0.12)] bg-[rgba(255,255,255,0.18)]">
                                    <Squares2X2Icon className="h-4.5 w-4.5" />
                                  </span>
                                </Link>
                                <Link
                                  href="/bestseller"
                                  onClick={() => {
                                    setProductsOpen(false);
                                    setCategoryStack([]);
                                    setCategoryQuery("");
                                  }}
                                  className="flex items-center justify-between rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2 text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.07)]"
                                >
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-accent)]">
                                      Schnellwahl
                                    </p>
                                    <p className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] sm:text-[1.28rem]">
                                      Bestseller
                                    </p>
                                  </div>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-[16px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)]">
                                    <SparklesIcon className="h-4.5 w-4.5 text-[var(--smk-accent)]" />
                                  </span>
                                </Link>
                              </div>

                              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[196px_minmax(0,1fr)]">
                                <div className="space-y-2">
                                  <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--smk-text-dim)]" />
                                    <input
                                      type="search"
                                      value={categoryQuery}
                                      onChange={(event) =>
                                        setCategoryQuery(event.target.value)
                                      }
                                      placeholder="Kategorie suchen..."
                                      className="smk-input h-11 w-full rounded-full pl-11 pr-4 text-sm"
                                    />
                                  </div>
                                  {categoriesStatus === "error" ? (
                                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                                      Kategorien konnten nicht geladen werden.
                                    </div>
                                  ) : null}
                                  {categoriesStatus === "idle" &&
                                  filteredDesktopRootCategories.length === 0 ? (
                                    <div className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--smk-text-muted)]">
                                      Keine Kategorien gefunden.
                                    </div>
                                  ) : null}
                                  <div className="no-scrollbar max-h-[min(46vh,330px)] space-y-2 overflow-y-auto pr-1">
                                    {filteredDesktopRootCategories.map((category) => {
                                      const CategoryIcon = getCategoryIcon(category.name);
                                      const isActive =
                                        activeDesktopRootId === category.id;
                                      return (
                                        <button
                                          key={category.id}
                                          type="button"
                                          onMouseEnter={() => setCategoryStack([category.id])}
                                          onFocus={() => setCategoryStack([category.id])}
                                          onClick={() => setCategoryStack([category.id])}
                                          className={`flex w-full items-center justify-between rounded-[20px] border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                                            isActive
                                              ? "border-[rgba(241,198,132,0.22)] bg-[rgba(241,198,132,0.08)]"
                                              : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
                                          }`}
                                        >
                                          <span className="flex items-center gap-3">
                                            <span className="flex h-8.5 w-8.5 items-center justify-center rounded-[15px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-accent)]">
                                              <CategoryIcon className="h-4 w-4" />
                                            </span>
                                            <span className="text-[0.95rem] font-semibold text-[var(--smk-text)]">
                                              {getPrimaryCategoryLabel(category)}
                                            </span>
                                          </span>
                                          <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                                            {category.totalItemCount}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="no-scrollbar max-h-[min(46vh,330px)] overflow-y-auto rounded-[20px] border border-[var(--smk-border)] bg-[rgba(8,8,7,0.18)] p-3.5">
                                  {activeDesktopRootCategory ? (
                                    <>
                                      <div className="flex items-center justify-between gap-4">
                                        <div>
                                          <p className="smk-kicker text-[var(--smk-accent)]">
                                            Aktiv
                                          </p>
                                          <h3 className="mt-2 text-[2rem] font-semibold tracking-[-0.06em] text-[var(--smk-text)]">
                                            {getPrimaryCategoryLabel(activeDesktopRootCategory)}
                                          </h3>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            router.push(
                                              `/products?category=${encodeURIComponent(
                                                activeDesktopRootCategory.handle,
                                              )}`,
                                            );
                                            setProductsOpen(false);
                                            setCategoryStack([]);
                                            setCategoryQuery("");
                                          }}
                                          className="rounded-full border border-[rgba(241,198,132,0.18)] bg-[linear-gradient(135deg,rgba(241,198,132,0.95),rgba(217,119,69,0.92))] px-5 py-2 text-sm font-semibold text-[var(--smk-bg)] transition hover:brightness-105"
                                        >
                                          Alle ansehen {getPrimaryCategoryLabel(activeDesktopRootCategory)}
                                        </button>
                                      </div>

                                      {activeDesktopChildren.length > 0 ? (
                                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                          {activeDesktopChildren.map((category) => {
                                            const CategoryIcon = getCategoryIcon(
                                              category.name,
                                            );
                                            return (
                                              <Link
                                                key={category.id}
                                                href={category.href}
                                                onClick={() => {
                                                  setProductsOpen(false);
                                                  setCategoryStack([]);
                                                  setCategoryQuery("");
                                                }}
                                                className="flex items-center justify-between rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
                                              >
                                                <span className="flex items-center gap-3">
                                                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-accent)]">
                                                    <CategoryIcon className="h-5 w-5" />
                                                  </span>
                                                  <span className="text-base font-semibold">
                                                    {getPrimaryCategoryLabel(category)}
                                                  </span>
                                                </span>
                                                <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                                                  {category.totalItemCount}
                                                </span>
                                              </Link>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="mt-6 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-5">
                                          <p className="text-sm leading-6 text-[var(--smk-text-muted)]">
                                            Diese Kategorie führt direkt auf die
                                            Produktliste. Öffne sie, um alle
                                            zugeordneten Smokeify Produkte zu sehen.
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-5 text-sm text-[var(--smk-text-muted)]">
                                      Keine Kategorien gefunden.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>,
                          document.body,
                        )}
                  </div>
                  <Link
                    href={SMOKEIFY_ROUTES.customizer}
                    className={desktopNavLinkClass(configuratorActive)}
                  >
                    {renderNavLabel("configurator", "Setup")}
                  </Link>
                  <Link
                    href={SMOKEIFY_ROUTES.analyzer}
                    className={`${desktopNavLinkClass(analyzerActive)} whitespace-nowrap`}
                  >
                    {renderNavLabel("analyzer", "Analyse")}
                  </Link>
                </div>
              </div>

              {/* CENTER */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:col-start-2 sm:flex-nowrap sm:gap-6">
                <div className="relative flex items-center gap-3 sm:gap-6">
                  <Link href="/" className="flex h-12 items-center overflow-visible sm:h-16">
                    <Image
                      src="/images/Logo.png"
                      alt="Smokeify Logo"
                      className="h-10 w-auto translate-y-1 scale-[1.65] object-contain sm:h-14 sm:translate-y-1.5 sm:scale-[1.82]"
                      priority
                      width={320}
                      height={110}
                    />
                  </Link>
                </div>
              </div>

              {/* RIGHT */}
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-0 text-[var(--smk-text)] sm:static sm:col-start-3 sm:translate-y-0 sm:justify-end sm:gap-2">
                <div
                  ref={searchRef}
                  className="relative z-[60] hidden w-[240px] md:block lg:w-[300px] lg:-translate-x-2"
                >
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--smk-text-dim)]" />
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
                      className="smk-input h-10 w-full rounded-full pl-9 pr-4 text-sm"
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
                              item_id: item.defaultVariantId ?? item.id,
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
                    className={utilityIconButtonClass}
                    aria-expanded={cartOpen}
                    aria-haspopup="true"
                    aria-label="Warenkorb öffnen"
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
                        className="fixed z-[90] w-64 rounded-[24px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-3 text-[var(--smk-text)] shadow-2xl shadow-black/40"
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
                          <div className="h-12 w-12 rounded-md bg-[rgba(255,255,255,0.06)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--smk-text)]">
                            {mobileAddedItem.title}
                          </p>
                          {mobileAddedItem.price && (
                            <p className="text-xs text-[var(--smk-text-muted)]">
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
                          className="smk-button-secondary block w-full rounded-full px-3 py-2 text-center focus-visible:ring-offset-black"
                        >
                          Warenkorb ansehen
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAddedOpen(false);
                            startCheckout();
                          }}
                          className="smk-button-primary block w-full rounded-full px-3 py-2 text-center focus-visible:ring-offset-black"
                        >
                          Zur Kasse
                        </button>
                        <PaymentMethodLogos
                          className="justify-center gap-[2px] sm:gap-2"
                          pillClassName="h-7 border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-2 sm:h-8 sm:px-3"
                          logoClassName="h-4 sm:h-5"
                        />
                      </div>
                    </div>,
                      document.body,
                    )}
                </div>
                <Link
                  href="/wishlist"
                  className={utilityIconButtonClass}
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
                    className={utilityIconButtonClass}
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
                        className="fixed z-[1005] mt-3 origin-top-right rounded-[24px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-4 text-sm text-[var(--smk-text)] shadow-2xl shadow-black/40"
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
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--smk-text-dim)]" />
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
                className="smk-input h-11 w-full rounded-full pl-9 pr-4 text-sm"
              />
            </div>
          </div>
        )}
        {showCategoryBar && (
          <div className="relative z-10 mt-3 hidden border-t border-[var(--smk-border)] bg-[rgba(20,18,17,0.82)] backdrop-blur-xl sm:block">
            <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-base text-[var(--smk-text-muted)] sm:px-6 lg:max-w-[1280px] lg:px-8">
              <Link
                href="/bestseller"
                onClick={() => {
                  setCategoryNavTarget("/bestseller");
                  setCategoryHoverLocked(true);
                }}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-base font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)]"
              >
                <span>Bestseller</span>
                {categoryNavTarget === "/bestseller" && (
                  <LoadingSpinner
                    size="sm"
                    className="h-3 w-3 border-2 border-[rgba(255,255,255,0.18)] border-t-[var(--smk-accent)]"
                  />
                )}
              </Link>
              {categoriesStatus === "error" && (
                <span className="text-xs text-[var(--smk-error)]">
                  Kategorien konnten nicht geladen werden.
                </span>
              )}
              {categoriesStatus === "idle" && mainCategories.length === 0 && (
                <span className="text-xs text-[var(--smk-text-dim)]">
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
                      href={category.href}
                      onClick={() => {
                        setCategoryNavTarget(category.href);
                        setCategoryHoverLocked(true);
                      }}
                      className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-base font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)]"
                    >
                      <span>{getPrimaryCategoryLabel(category)}</span>
                      <span className="rounded-full border border-[rgba(241,198,132,0.18)] bg-[rgba(241,198,132,0.1)] px-2 py-0.5 text-xs font-semibold text-[var(--smk-accent)]">
                        {category.totalItemCount}
                      </span>
                      {categoryNavTarget === category.href && (
                        <LoadingSpinner
                          size="sm"
                          className="h-3 w-3 border-2 border-[rgba(255,255,255,0.18)] border-t-[var(--smk-accent)]"
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
                            className="grid grid-flow-col auto-cols-max gap-2 rounded-[24px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.98))] p-3 text-[15px] text-[var(--smk-text)] shadow-2xl shadow-black/40 backdrop-blur-xl"
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
                                    href={child.href}
                                    onClick={() => {
                                      setCategoryNavTarget(child.href);
                                      setCategoryHoverLocked(true);
                                    }}
                                    className="flex items-center gap-2 rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-3 font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)]"
                                  >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-[var(--smk-accent)]">
                                      <ChildIcon className="h-4.5 w-4.5" />
                                    </span>
                                    <span className="flex-1 whitespace-nowrap">
                                      {child.name}
                                    </span>
                                    {categoryNavTarget === child.href && (
                                      <LoadingSpinner
                                        size="sm"
                                        className="h-3 w-3 border-2 border-[rgba(255,255,255,0.18)] border-t-[var(--smk-accent)]"
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
        {cartOpen && !isMobile ? (
          <NavbarCartDrawer
            open
            cart={cart}
            loading={loading}
            error={error}
            canCheckout={canCheckout}
            checkoutStatus={checkoutStatus}
            discountCode={drawerDiscountCode}
            appliedDiscountCode={appliedDrawerDiscountCode}
            appliedDiscountAmount={appliedDrawerDiscountAmount}
            onDiscountCodeChange={(value) => {
              setAppliedDrawerDiscountCode("");
              setDrawerDiscountCode(value);
            }}
            onApplyDiscountCode={applyDrawerDiscountCode}
            onClose={() => setCartOpen(false)}
            onStartCheckout={() => void startCheckout()}
            panelRef={cartPanelRef}
          />
        ) : null}
      </nav>
      <div
        className={
          showCategoryBar
            ? "h-[calc(var(--smk-announcement-offset)+110px)] sm:h-[calc(var(--smk-announcement-offset)+144px)]"
            : "h-[calc(var(--smk-announcement-offset)+40px)] sm:h-[calc(var(--smk-announcement-offset)+73px)]"
        }
        aria-hidden="true"
      />
      {isMobile && productsOpen ? (
        <NavbarMobileCategoriesSheet
          open
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
      ) : null}
      {showCheckoutAuthModal ? (
        <CheckoutAuthModal
          open
          returnTo={buildCheckoutStartUrl({
            country: "DE",
            discountCode: appliedDrawerDiscountCode || undefined,
          })}
          onClose={() => setShowCheckoutAuthModal(false)}
          onContinueAsGuest={() => {
            setShowCheckoutAuthModal(false);
            return proceedToCheckout();
          }}
        />
      ) : null}
    </>
  );
}
