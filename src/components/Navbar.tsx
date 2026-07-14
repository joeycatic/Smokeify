"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  Bars3Icon,
  FireIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";
import { useNavbarCategories } from "@/components/NavbarCategoriesProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { useSafeSession } from "@/hooks/useSafeSession";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useDocumentLanguage } from "@/hooks/useDocumentLanguage";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import { NAV_ICON_BY_KEY } from "@/config/growvault-icons";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { buildGrowvaultAnalyzerUrl, buildGrowvaultCustomizerUrl } from "@/lib/growvaultPublicStorefront";
import { buildCheckoutStartUrl } from "@/lib/checkoutStart";
import { buildMerchantItemId } from "@/lib/merchantFeed";
import type { NavbarSearchResult } from "@/components/navbar/NavbarSearchResultsPopover";
import type { NavbarCategory } from "@/lib/navbarCategories";
import NavbarSubcategoriesPopup from "@/components/navbar/NavbarSubcategoriesPopup";
import NavbarCategoryBar from "@/components/navbar/NavbarCategoryBar";
import { getCategoryIconName } from "@/components/navbar/categoryIcons";
import { useDropdownPopupPosition } from "@/hooks/useDropdownPopupPosition";
import {
  type Language,
} from "@/lib/language";

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

const toCartItems = (cart: NonNullable<ReturnType<typeof useCart>["cart"]>) =>
  cart.lines.map((line) => ({
    product_id: line.merchandise.product.id,
    item_id: buildMerchantItemId(line.merchandise.id),
    item_name: line.merchandise.product.title,
    item_variant: line.merchandise.title,
    item_brand: line.merchandise.product.manufacturer ?? undefined,
    item_category: line.merchandise.product.categories?.[0]?.name,
    price: Number(line.merchandise.price.amount),
    quantity: line.quantity,
  }));

type NavbarProps = {
  initialCategories?: NavbarCategory[];
  language?: Language;
};

export function Navbar({ initialCategories, language: initialLanguage }: NavbarProps) {
  const language = useDocumentLanguage(initialLanguage);
  const { cart, loading, error, refresh } = useCart();
  const { ids } = useWishlist();
  const contextCategories = useNavbarCategories();
  const { status } = useSafeSession();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAuthenticated = status === "authenticated";
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoryNavTarget, setCategoryNavTarget] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null);
  const cartPanelRef = useRef<HTMLElement | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NavbarSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchTrackedRef = useRef<string | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState<string | null>(null);
  const [desktopCategoryPopupCategoryId, setDesktopCategoryPopupCategoryId] =
    useState<string | null>(null);
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
  const desktopCategoryPopupRef = useRef<HTMLDivElement | null>(null);
  const desktopCategoryTriggerRefs = useRef(
    new Map<string, HTMLButtonElement | null>(),
  );
  const searchPopupRef = useRef<HTMLDivElement | null>(null);
  const accountPopupRef = useRef<HTMLDivElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [navHeight, setNavHeight] = useState<number | null>(null);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);

  const count = cart?.totalQuantity ?? 0;
  const wishlistCount = mounted ? ids.length : 0;
  const [cartPop, setCartPop] = useState(false);
  const [wishlistPop, setWishlistPop] = useState(false);
  const canCheckout =
    !loading && !!cart && cart.lines.length > 0 && checkoutStatus !== "loading";
  const returnTo = useMemo(() => {
    if (pathname?.startsWith("/auth")) return "/";
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);
  const copy =
    language === "en"
      ? {
          openNavigation: "Open navigation",
          products: "Products",
          configurator: "Setup",
          analyzer: "Analyzer",
          catalog: "Catalog",
          findProductsFaster: "Find products faster",
          assortment: "Catalog",
          allProducts: "All products",
          quickSelect: "Quick pick",
          searchCategory: "Search category...",
          categoryLoadError: "Could not load categories.",
          noCategories: "No categories found.",
          noSubcategories:
            "There are currently no subcategories in this category.",
          searchProducts: "Search products...",
          searchResults: "Search results",
          results: "results",
          mainCategory: "Main category",
          active: "Active",
          openCart: "Open cart",
          viewCart: "View cart",
          checkout: "Checkout",
          wishlist: "Wishlist",
          account: "Account",
          subcategories: "Subcategories",
          viewAll: "View all",
        }
      : {
          openNavigation: "Navigation öffnen",
          products: "Produkte",
          configurator: "Setup",
          analyzer: "Analyse",
          catalog: "Katalog",
          findProductsFaster: "Produkte schneller finden",
          assortment: "Sortiment",
          allProducts: "Alle Produkte",
          quickSelect: "Schnellwahl",
          searchCategory: "Kategorie suchen...",
          categoryLoadError: "Kategorien konnten nicht geladen werden.",
          noCategories: "Keine Kategorien gefunden.",
          noSubcategories:
            "Für diese Kategorie gibt es aktuell keine Unterkategorien.",
          searchProducts: "Produkte suchen...",
          searchResults: "Suchtreffer",
          results: "Treffer",
          mainCategory: "Hauptkategorie",
          active: "Aktiv",
          openCart: "Warenkorb öffnen",
          viewCart: "Warenkorb ansehen",
          checkout: "Zur Kasse",
          wishlist: "Wunschliste",
          account: "Konto",
          subcategories: "Unterkategorien",
          viewAll: "Alle ansehen",
        };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!cartOpen || isMobile || loading || cart) return;
    void refresh();
  }, [cartOpen, cart, isMobile, loading, refresh]);

  useEffect(() => {
    setCategoryNavTarget(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    setCartOpen(false);
    setDesktopCategoryPopupCategoryId(null);
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
      const target = event.target as Node | null;
      if (!target) return;

      if (
        accountOpen &&
        accountPopupRef.current &&
        accountPopupRef.current.contains(target)
      ) {
        return;
      }
      if (
        accountOpen &&
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false);
      }
      if (
        cartOpen &&
        cartRef.current &&
        !cartRef.current.contains(target) &&
        !(cartPanelRef.current?.contains(target) ?? false)
      ) {
        setCartOpen(false);
      }
      if (
        productsOpen &&
        !productsRef.current?.contains(target) &&
        !mobileProductsRef.current?.contains(target) &&
        !productsPopupRef.current?.contains(target)
      ) {
        setProductsOpen(false);
        setCategoryQuery("");
      }
      const activeDesktopCategoryTrigger = desktopCategoryPopupCategoryId
        ? desktopCategoryTriggerRefs.current.get(desktopCategoryPopupCategoryId)
        : null;
      const clickInsideDesktopCategory =
        (activeDesktopCategoryTrigger?.contains(target) ?? false) ||
        (desktopCategoryPopupRef.current?.contains(target) ?? false);
      if (desktopCategoryPopupCategoryId && !clickInsideDesktopCategory) {
        setDesktopCategoryPopupCategoryId(null);
      }
      const clickInsideSearch =
        searchRef.current?.contains(target) ||
        mobileSearchRef.current?.contains(target) ||
        (searchPopupRef.current?.contains(target) ?? false);
      if (searchOpen && !clickInsideSearch) {
        setSearchOpen(false);
      }
      if (menuOpen && menuPopupRef.current?.contains(target)) {
        return;
      }
      const menuRoot = document.getElementById("mobile-nav-menu");
      if (menuOpen && menuRoot && !menuRoot.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideInteraction);
    document.addEventListener("focusin", handleOutsideInteraction);
    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("focusin", handleOutsideInteraction);
    };
  }, [
    accountOpen,
    cartOpen,
    desktopCategoryPopupCategoryId,
    menuOpen,
    productsOpen,
    searchOpen,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Keep the fixed-navbar spacer in sync with the real navbar height so the
  // category bar (now shown on every breakpoint) never overlaps page content.
  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setNavHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCategoryBar, showMobileSearch]);

  const canPortal = mounted;
  const productsActive = Boolean(productsOpen || pathname?.startsWith("/products"));
  const configuratorActive = Boolean(pathname?.startsWith("/customizer"));
  const analyzerActive = Boolean(pathname?.startsWith("/pflanzen-analyse"));
  const [productsPopupStyle, setProductsPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: string;
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
    maxHeight: string;
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
      const viewportPadding = 16;
      const viewportWidth = window.innerWidth;
      const width = Math.min(780, viewportWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        viewportWidth - viewportPadding - width,
      );
      const top = rect.bottom + 12;
      const next = {
        top,
        left,
        width,
        maxHeight: `calc(100dvh - ${Math.round(top + viewportPadding)}px)`,
      };
      setProductsPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.maxHeight === next.maxHeight
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
    const closeOnScroll = () => setProductsOpen(false);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [productsOpen]);

  useEffect(() => {
    if (!productsOpen) return;

    document.documentElement.setAttribute("data-products-open", "true");
    document.body.setAttribute("data-products-open", "true");

    return () => {
      document.documentElement.removeAttribute("data-products-open");
      document.body.removeAttribute("data-products-open");
    };
  }, [productsOpen]);

  const desktopCategoryPopupTrigger = desktopCategoryPopupCategoryId
    ? (desktopCategoryTriggerRefs.current.get(desktopCategoryPopupCategoryId) ??
      null)
    : null;
  const desktopCategoryPopupStyle = useDropdownPopupPosition(
    desktopCategoryPopupTrigger,
    Boolean(desktopCategoryPopupCategoryId),
    340,
  );
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
      const width = Math.min(
        isMobile ? rect.width : 560,
        viewportWidth - viewportPadding * 2,
      );
      const preferredLeft = isMobile ? rect.left : rect.right - width;
      const left = Math.min(
        Math.max(preferredLeft, viewportPadding),
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
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isMobile, searchOpen]);

  useEffect(() => {
    if (!accountOpen || !accountRef.current) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = accountRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 16;
      const viewportWidth = window.innerWidth;
      const width = Math.min(
        400,
        Math.max(280, viewportWidth - viewportPadding * 2),
      );
      const next = {
        top: rect.bottom + 12,
        left: Math.min(
          Math.max(rect.right - width, viewportPadding),
          viewportWidth - viewportPadding - width,
        ),
        width,
        maxHeight: `calc(100dvh - ${rect.bottom + 28}px)`,
      };
      setAccountPopupStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.maxHeight === next.maxHeight
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
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
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
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [menuOpen]);

  const mainCategories = useMemo(() => {
    const roots = categories.filter((category) => !category.parentId);
    return [...roots].sort((a, b) => {
      if (a.handle === "zelte" && b.handle !== "zelte") return -1;
      if (b.handle === "zelte" && a.handle !== "zelte") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);
  useEffect(() => {
    if (mainCategories.length === 0) return;
    setSelectedRootCategoryId((current) => {
      if (current && mainCategories.some((category) => category.id === current)) {
        return current;
      }
      return mainCategories[0]?.id ?? null;
    });
  }, [mainCategories]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchStatus("idle");
      setActiveSearchIndex(-1);
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
            manufacturer: string | null;
            category: { title: string; handle: string } | null;
            availableForSale: boolean;
          }>;
        };
        setSearchResults(data.results ?? []);
        setActiveSearchIndex(-1);
        setSearchStatus("idle");
        if (searchTrackedRef.current !== trimmed) {
          searchTrackedRef.current = trimmed;
          trackAnalyticsEvent("search", { search_term: trimmed });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSearchResults([]);
        setActiveSearchIndex(-1);
        setSearchStatus("error");
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const trackSearchResultSelection = useCallback((item: NavbarSearchResult) => {
    trackAnalyticsEvent("select_item", {
      item_list_id: "search",
      item_list_name: "search",
      items: [
        {
          item_id: buildMerchantItemId(item.defaultVariantId ?? item.id),
          item_name: item.title,
          item_brand: item.manufacturer ?? undefined,
          item_category: item.category?.title,
          price: item.price ? Number(item.price.amount) : undefined,
          quantity: 1,
        },
      ],
    });
  }, []);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = searchQuery.trim();
      const target = trimmed
        ? `/products?searchQuery=${encodeURIComponent(trimmed)}`
        : "/products";
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      window.location.assign(target);
    },
    [searchQuery],
  );

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      if (searchResults.length > 0) {
        setActiveSearchIndex((current) =>
          Math.min(current + 1, Math.min(searchResults.length, 6) - 1),
        );
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      if (searchResults.length > 0) {
        setActiveSearchIndex((current) => (current <= 0 ? -1 : current - 1));
      }
      return;
    }

    if (event.key !== "Enter") return;

    const activeResult =
      activeSearchIndex >= 0 ? searchResults[activeSearchIndex] : null;
    if (activeResult) {
      event.preventDefault();
      trackSearchResultSelection(activeResult);
      router.push(`/products/${activeResult.handle}`);
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  useEffect(() => {
    setProductsOpen(false);
    setCategoryQuery("");
  }, [pathname]);

  const desktopNavLinkClass = (active: boolean) =>
    `relative isolate inline-flex min-h-[52px] cursor-pointer select-none items-center overflow-hidden rounded-[20px] border px-4 py-2 text-[0.95rem] font-semibold tracking-[-0.02em] transition-all duration-200 ease-out after:absolute after:bottom-2 after:left-4 after:h-[2px] after:rounded-full after:transition-all after:duration-200 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] ${
      active
        ? "border-transparent bg-[color:var(--gv-brand-soft)] text-[color:var(--gv-text)] after:w-12 after:bg-[color:var(--gv-lime)]"
        : "border-transparent bg-transparent text-[color:var(--gv-text-muted)] after:w-8 after:bg-transparent hover:-translate-y-0.5 hover:bg-[color:var(--gv-brand-soft)]/60 hover:text-[color:var(--gv-text)] hover:after:w-12 hover:after:bg-[color:var(--gv-lime)]/55"
    }`;
  const mobileMenuLinkClass =
    "block rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3 text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--gv-text)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/32 hover:bg-[color:var(--gv-brand-soft)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]";
  const utilityIconButtonClass =
    "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-[color:var(--gv-text-muted)] transition-colors duration-200 hover:border-[color:var(--gv-lime)]/24 hover:bg-[color:var(--gv-brand-soft)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] sm:h-11 sm:w-11";
  const renderNavLabel = (iconKey: keyof typeof NAV_ICON_BY_KEY, label: string) => (
    <span className="relative z-[1] inline-flex items-center gap-1.5 whitespace-nowrap">
      <GrowvaultIcon
        name={NAV_ICON_BY_KEY[iconKey]}
        size={15}
        className="text-[color:var(--gv-lime)]"
      />
      <span>{label}</span>
    </span>
  );

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
  const categoryById = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        handle: string;
        href: string;
        parentId: string | null;
        itemCount: number;
        totalItemCount: number;
      }
    >();
    categories.forEach((category) => {
      map.set(category.id, {
        ...category,
        parentId: category.parentId ? String(category.parentId) : null,
      });
    });
    return map;
  }, [categories]);
  const childCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    categoriesByParent.forEach((list, key) => {
      if (key === null) return;
      map.set(key, list.length);
    });
    return map;
  }, [categoriesByParent]);
  const activeRootCategory = useMemo(() => {
    if (mainCategories.length === 0) return null;
    if (selectedRootCategoryId) {
      const match = mainCategories.find((category) => category.id === selectedRootCategoryId);
      if (match) return match;
    }
    return mainCategories[0] ?? null;
  }, [mainCategories, selectedRootCategoryId]);
  const activeRootChildren = activeRootCategory
    ? (categoriesByParent.get(String(activeRootCategory.id)) ?? [])
    : [];
  const categorySearchResults = useMemo(() => {
    const trimmedQuery = categoryQuery.trim().toLowerCase();
    if (!trimmedQuery) return [];

    return categories
      .filter((category) => {
        const parentName = category.parentId
          ? categoryById.get(String(category.parentId))?.name.toLowerCase() ?? ""
          : "";
        return (
          category.name.toLowerCase().includes(trimmedQuery) ||
          parentName.includes(trimmedQuery)
        );
      })
      .map((category) => ({
        ...category,
        parentId: category.parentId ? String(category.parentId) : null,
        parentName: category.parentId
          ? categoryById.get(String(category.parentId))?.name ?? null
          : null,
      }))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(trimmedQuery) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(trimmedQuery) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        const aChildren = childCountByCategoryId.get(a.id) ?? 0;
        const bChildren = childCountByCategoryId.get(b.id) ?? 0;
        if (aChildren !== bChildren) return bChildren - aChildren;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [categories, categoryById, categoryQuery, childCountByCategoryId]);

  const closeProductsExplorer = () => {
    setProductsOpen(false);
    setCategoryQuery("");
  };

  const openProductsExplorer = (categoryId?: string) => {
    if (categoryId) {
      setSelectedRootCategoryId(categoryId);
    } else if (!selectedRootCategoryId && mainCategories[0]) {
      setSelectedRootCategoryId(mainCategories[0].id);
    }
    setCategoryQuery("");
    setProductsOpen(true);
  };

  const navigateToCategory = (category: { href: string }) => {
    setCategoryNavTarget(category.href);
    closeProductsExplorer();
    setDesktopCategoryPopupCategoryId(null);
    router.push(category.href);
  };

  const handleBarCategoryClick = (category: NavbarCategory) => {
    if (isMobile) {
      navigateToCategory(category);
      return;
    }
    const hasChildren =
      (categoriesByParent.get(String(category.id))?.length ?? 0) > 0;
    if (!hasChildren) {
      navigateToCategory(category);
      return;
    }
    setDesktopCategoryPopupCategoryId((prev) =>
      prev === category.id ? null : category.id,
    );
  };

  const activeDesktopCategoryChildren = desktopCategoryPopupCategoryId
    ? (categoriesByParent.get(desktopCategoryPopupCategoryId) ?? [])
    : [];
  const activeDesktopCategory = desktopCategoryPopupCategoryId
    ? categoryById.get(desktopCategoryPopupCategoryId)
    : null;

  return (
    <>
    <nav
      ref={navRef}
      className="fixed left-0 z-40 isolate w-full border-b border-[color:var(--gv-border)] bg-[color:var(--gv-dark)]/90 backdrop-blur-md transition-[top] duration-150 ease-out"
      style={{ top: "var(--gv-announcement-offset, 40px)" }}
    >
        <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1280px] lg:px-8">
          <div className="py-1.5 sm:py-2">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-8 lg:gap-12">
              {/* LEFT (spacer) */}
              <div className="min-w-0 justify-self-start">
                <div id="mobile-nav-menu" className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    ref={menuTriggerRef}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-[color:var(--gv-text)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 sm:h-10 sm:w-10 ${
                      menuOpen
                        ? "border-[color:var(--gv-lime)]/45 bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] shadow-lg shadow-black/20 focus-visible:ring-offset-[color:var(--gv-forest)]"
                        : "border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/50 hover:text-[color:var(--gv-lime)] focus-visible:ring-offset-[color:var(--gv-forest)]"
                    }`}
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label={copy.openNavigation}
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
                        className="webshop-dropdown-in fixed z-[1300] mt-3 w-60 rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-3 text-sm text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
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
                          openProductsExplorer();
                        }}
                        className={mobileMenuLinkClass}
                      >
                        {renderNavLabel("products", copy.products)}
                      </Link>
                      <Link
                        href={buildGrowvaultCustomizerUrl()}
                        onClick={() => setMenuOpen(false)}
                        className={`mt-2 ${mobileMenuLinkClass}`}
                      >
                        {renderNavLabel("configurator", copy.configurator)}
                      </Link>
                      <Link
                        href={buildGrowvaultAnalyzerUrl()}
                        onClick={() => setMenuOpen(false)}
                        className={`mt-2 ${mobileMenuLinkClass}`}
                      >
                        {renderNavLabel("analyzer", copy.analyzer)}
                      </Link>
                    </div>,
                    document.body,
                  )}
                <div className="hidden items-center gap-3 text-xs font-semibold text-[color:var(--gv-text)] sm:flex sm:gap-4 sm:text-sm lg:gap-5">
                  {mounted ? (
                    <div className="relative" ref={productsRef}>
                      <button
                        ref={productsTriggerRef}
                        type="button"
                        onClick={() =>
                          productsOpen ? closeProductsExplorer() : openProductsExplorer()
                        }
                        className={desktopNavLinkClass(productsActive)}
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                      >
                        {renderNavLabel("products", copy.products)}
                      </button>
                      {productsOpen &&
                        !isMobile &&
                        canPortal &&
                        productsPopupStyle &&
                        createPortal(
                          <div
                            ref={productsPopupRef}
                            className="no-scrollbar webshop-dropdown-in fixed z-[999] touch-pan-y overflow-y-auto overscroll-contain rounded-[32px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-4 text-sm text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
                            style={{
                              top: productsPopupStyle.top,
                              left: productsPopupStyle.left,
                              width: productsPopupStyle.width,
                              maxHeight: productsPopupStyle.maxHeight,
                            }}
                          >
                            <div className="gv-panel rounded-[28px] px-4 py-4">
                              <div className="relative border-b border-[color:var(--gv-border)] pb-4 pr-20">
                                <div className="absolute right-0 top-0">
                                  <LanguageSwitch language={language} compact />
                                </div>
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <span className="gv-chip">{copy.catalog}</span>
                                    <h3 className="mt-4 font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.06em] text-[color:var(--gv-text)]">
                                      {copy.findProductsFaster}
                                    </h3>
                                  </div>
                                  <div className="flex flex-col items-stretch gap-3 sm:items-end">
                                    <div className="flex flex-wrap gap-3 sm:justify-end">
                                      <Link
                                        href="/products"
                                        onClick={closeProductsExplorer}
                                        className="group inline-flex min-w-[12rem] items-center justify-between gap-3 rounded-[20px] border border-transparent bg-[linear-gradient(135deg,var(--gv-lime),var(--gv-lime-dim))] px-4 py-3 text-[color:var(--gv-forest)] shadow-[0_18px_36px_var(--gv-lime-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_var(--gv-lime-glow)]"
                                      >
                                        <span className="flex flex-col text-left">
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)]/70">
                                            {copy.assortment}
                                          </span>
                                          <span className="mt-1 text-sm font-semibold">
                                            {copy.allProducts}
                                          </span>
                                        </span>
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--gv-forest)]/12 bg-[color:var(--gv-forest)]/8 transition-transform group-hover:translate-x-0.5">
                                          <Squares2X2Icon className="h-4 w-4" />
                                        </span>
                                      </Link>
                                      <Link
                                        href="/bestseller"
                                        onClick={closeProductsExplorer}
                                        className="group inline-flex min-w-[12rem] items-center justify-between gap-3 rounded-[20px] border border-[color:var(--gv-lime)]/24 bg-[linear-gradient(135deg,var(--gv-lime-glow),transparent_55%),color-mix(in_srgb,var(--gv-surface)_90%,transparent)] px-4 py-3 text-[color:var(--gv-text)] shadow-[var(--gv-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/42 hover:bg-[color:var(--gv-lime)]/10 hover:shadow-[var(--gv-shadow-lg)]"
                                      >
                                        <span className="flex flex-col text-left">
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]/75">
                                            {copy.quickSelect}
                                          </span>
                                          <span className="mt-1 text-sm font-semibold">
                                            Bestseller
                                          </span>
                                        </span>
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-dark)] text-[color:var(--gv-lime)] transition-all group-hover:translate-x-0.5 group-hover:border-[color:var(--gv-lime)]/34">
                                          <FireIcon className="h-4 w-4" />
                                        </span>
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                                <div className="space-y-3">
                                  <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gv-text-muted)]" />
                                    <input
                                      type="search"
                                      value={categoryQuery}
                                      onChange={(event) => setCategoryQuery(event.target.value)}
                                      placeholder={copy.searchCategory}
                                      className="gv-input h-11 w-full rounded-[18px] pl-11 pr-4 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
                                    />
                                  </div>

                                  <div className="space-y-2 pr-1">
                                    {mainCategories.map((category) => {
                                      const categoryIconName = getCategoryIconName(category.name);
                                      const isActive = activeRootCategory?.id === category.id;
                                      return (
                                        <button
                                          key={category.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedRootCategoryId(category.id);
                                            setCategoryQuery("");
                                          }}
                                          className={`group flex w-full items-center justify-between rounded-[22px] border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                                            isActive
                                              ? "border-[color:var(--gv-lime)]/50 bg-[color:var(--gv-lime)]/12 shadow-[0_16px_30px_rgba(31,95,63,0.12)] hover:border-[color:var(--gv-lime)]/65 hover:bg-[color:var(--gv-lime)]/16 hover:shadow-[0_22px_38px_rgba(31,95,63,0.16)]"
                                              : "gv-glass hover:border-[color:var(--gv-lime)]/25 hover:bg-[color:var(--gv-lime)]/8 hover:shadow-[0_20px_34px_rgba(0,0,0,0.2)]"
                                          }`}
                                        >
                                          <span className="flex items-center gap-3">
                                            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)] transition-all duration-200 group-hover:scale-105 group-hover:border-[color:var(--gv-lime)]/34 group-hover:bg-[color:var(--gv-lime)]/10">
                                              <GrowvaultIcon name={categoryIconName} size={18} />
                                            </span>
                                            <span className="text-sm font-semibold text-[color:var(--gv-text)]">
                                              {category.name}
                                            </span>
                                          </span>
                                          <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 text-xs font-semibold text-[color:var(--gv-text-muted)] transition-colors duration-200 group-hover:border-[color:var(--gv-lime)]/20 group-hover:text-[color:var(--gv-lime)]">
                                            {category.totalItemCount}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="touch-pan-y rounded-[26px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,rgba(31,95,63,0.08),transparent_38%),var(--gv-surface)] p-4">
                                  {categoriesStatus === "error" ? (
                                    <div className="rounded-[22px] border border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 px-4 py-4 text-sm text-[color:var(--gv-error)]">
                                      {copy.categoryLoadError}
                                    </div>
                                  ) : categoryQuery.trim().length > 0 ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.2em] text-[color:var(--gv-text-muted)]">
                                          {copy.searchResults}
                                        </p>
                                        <span className="text-xs text-[color:var(--gv-text-muted)]">
                                          {categorySearchResults.length} {copy.results}
                                        </span>
                                      </div>
                                      {categorySearchResults.length === 0 ? (
                                        <div className="gv-glass rounded-[22px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                                          {copy.noCategories}
                                        </div>
                                      ) : (
                                        <div className="grid gap-3 md:grid-cols-2">
                                          {categorySearchResults.map((category) => {
                                            const categoryIconName = getCategoryIconName(category.name);
                                            const hasChildren =
                                              (childCountByCategoryId.get(category.id) ?? 0) > 0;
                                            return (
                                              <button
                                                key={category.id}
                                                type="button"
                                                onClick={() => {
                                                  if (hasChildren) {
                                                    setSelectedRootCategoryId(category.id);
                                                    setCategoryQuery("");
                                                    return;
                                                  }
                                                  navigateToCategory(category);
                                                }}
                                                className="group gv-glass flex touch-pan-y items-center justify-between rounded-[22px] px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/10 hover:shadow-[0_22px_38px_rgba(0,0,0,0.22)]"
                                              >
                                                <span className="flex items-center gap-3">
                                                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)] transition-all duration-200 group-hover:scale-105 group-hover:border-[color:var(--gv-lime)]/34 group-hover:bg-[color:var(--gv-lime)]/10">
                                                    <GrowvaultIcon name={categoryIconName} size={20} />
                                                  </span>
                                                  <span className="min-w-0">
                                                    <span className="block text-sm font-semibold text-[color:var(--gv-text)]">
                                                      {category.name}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-[color:var(--gv-text-muted)]">
                                                      {category.parentName ?? copy.mainCategory}
                                                    </span>
                                                  </span>
                                                </span>
                                                <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 text-xs font-semibold text-[color:var(--gv-lime)] transition-colors duration-200 group-hover:border-[color:var(--gv-lime)]/26 group-hover:bg-[color:var(--gv-lime)]/10">
                                                  {category.totalItemCount}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : activeRootCategory && !isMobile ? (
                                    <div>
                                      <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                          <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
                                            {copy.active}
                                          </p>
                                          <h4 className="mt-2 font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)]">
                                            {activeRootCategory.name}
                                          </h4>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => navigateToCategory(activeRootCategory)}
                                          className="inline-flex items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-forest)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_20px_34px_rgba(31,95,63,0.24)]"
                                        >
                                          {copy.viewAll} {activeRootCategory.name}
                                        </button>
                                      </div>

                                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        {activeRootChildren.length === 0 ? (
                                          <div className="gv-glass rounded-[22px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                                            {copy.noSubcategories}
                                          </div>
                                        ) : (
                                          activeRootChildren.map((category) => {
                                            const categoryIconName = getCategoryIconName(category.name);
                                            return (
                                              <button
                                                key={category.id}
                                                type="button"
                                                onClick={() => navigateToCategory(category)}
                                                className="group gv-glass flex touch-pan-y items-center justify-between rounded-[22px] px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/10 hover:shadow-[0_22px_38px_rgba(0,0,0,0.22)]"
                                              >
                                                <span className="flex items-center gap-3">
                                                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)] transition-all duration-200 group-hover:scale-105 group-hover:border-[color:var(--gv-lime)]/34 group-hover:bg-[color:var(--gv-lime)]/10">
                                                    <GrowvaultIcon name={categoryIconName} size={20} />
                                                  </span>
                                                  <span className="min-w-0">
                                                    <span className="block text-sm font-semibold text-[color:var(--gv-text)]">
                                                      {category.name}
                                                    </span>
                                                  </span>
                                                </span>
                                                <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 text-xs font-semibold text-[color:var(--gv-lime)] transition-colors duration-200 group-hover:border-[color:var(--gv-lime)]/26 group-hover:bg-[color:var(--gv-lime)]/10">
                                                  {category.totalItemCount}
                                                </span>
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="gv-glass rounded-[22px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                                      {copy.noCategories}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>,
                          document.body,
                        )}
                    </div>
                  ) : (
                    <Link
                      href="/products"
                      className={desktopNavLinkClass(productsActive)}
                    >
                      {renderNavLabel("products", copy.products)}
                    </Link>
                  )}
                  <Link
                    href={buildGrowvaultCustomizerUrl()}
                    className={desktopNavLinkClass(configuratorActive)}
                  >
                    {renderNavLabel("configurator", copy.configurator)}
                  </Link>
                  <Link
                    href={buildGrowvaultAnalyzerUrl()}
                    className={desktopNavLinkClass(analyzerActive)}
                  >
                    {renderNavLabel("analyzer", copy.analyzer)}
                  </Link>
                </div>
              </div>

              {/* CENTER */}
              <div className="min-w-0 justify-self-center sm:col-start-2">
                <div className="relative flex min-w-0 items-center justify-center">
                  <Link
                    href="/"
                    className="flex min-w-0 flex-col items-center justify-center leading-none text-center"
                  >
                    <span className="text-[1.4rem] font-[family:var(--font-syne)] font-extrabold tracking-[-0.08em] sm:mt-1 sm:text-[2rem] lg:text-[2.1rem]">
                      <span className="text-[color:var(--gv-text)]">Smoke</span>
                      <span className="text-[color:var(--gv-lime)]">ify</span>
                    </span>
                  </Link>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center justify-end gap-1 text-[color:var(--gv-text)] sm:col-start-3 sm:gap-2 lg:gap-3">
                <div
                  ref={searchRef}
                  className="relative z-[60] hidden w-[235px] md:block lg:mr-2 lg:w-[275px]"
                >
                  <form
                    action="/products"
                    method="get"
                    className="relative"
                    onSubmit={handleSearchSubmit}
                  >
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gv-text-muted)]" />
                    <input
                      type="search"
                      name="searchQuery"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setActiveSearchIndex(-1);
                        if (!searchOpen) setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={copy.searchProducts}
                      role="combobox"
                      aria-label={copy.searchProducts}
                      aria-expanded={searchOpen}
                      aria-controls="navbar-search-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        activeSearchIndex >= 0
                          ? `navbar-search-option-${activeSearchIndex}`
                          : undefined
                      }
                      className="gv-input h-11 w-full rounded-full pl-10 pr-11 text-sm shadow-none outline-none focus:border-[color:var(--gv-lime)]/45 focus:ring-2 focus:ring-[color:var(--gv-lime)]/10"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setActiveSearchIndex(-1);
                          setSearchOpen(true);
                        }}
                        aria-label={language === "en" ? "Clear search" : "Suche löschen"}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[color:var(--gv-text-muted)] transition hover:bg-[color:var(--gv-surface)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35"
                      >
                        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button type="submit" className="sr-only">
                      {language === "en" ? "Show search results" : "Suchergebnisse anzeigen"}
                    </button>
                  </form>
                  {canPortal && (
                    <NavbarSearchResultsPopover
                      open={searchOpen}
                      searchStatus={searchStatus}
                      searchQuery={searchQuery}
                      searchResults={searchResults}
                      searchPopupStyle={searchPopupStyle}
                      popupRef={searchPopupRef}
                      onClose={() => {
                        setSearchOpen(false);
                        setActiveSearchIndex(-1);
                      }}
                      activeIndex={activeSearchIndex}
                      onActiveIndexChange={setActiveSearchIndex}
                      language={language}
                      onSelectResult={(item) => {
                        trackSearchResultSelection(item);
                        setSearchOpen(false);
                        setActiveSearchIndex(-1);
                      }}
                    />
                  )}
                </div>
                <div className="relative" ref={cartRef}>
                  <button
                    ref={cartButtonRef}
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
                    aria-label={copy.openCart}
                  >
                    <ShoppingBagIcon className="h-[1.35rem] w-[1.35rem]" />
                    {count > 0 && (
                      <span
                        className={`absolute -right-1 -top-1 inline-flex h-[1.4rem] min-w-[1.4rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-center text-[12px] font-semibold leading-none text-white ${
                          cartPop ? "badge-pop" : ""
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </div>
                <Link
                  href="/wishlist"
                  className={`hidden sm:inline-flex ${utilityIconButtonClass}`}
                  aria-label={copy.wishlist}
                >
                  <HeartIcon className="h-[1.35rem] w-[1.35rem]" />
                  {wishlistCount > 0 && (
                    <span
                      className={`absolute -right-1 -top-1 inline-flex h-[1.4rem] min-w-[1.4rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-center text-[12px] font-semibold leading-none text-white ${
                        wishlistPop ? "badge-pop" : ""
                      }`}
                    >
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <div className="relative" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    className={utilityIconButtonClass}
                    aria-expanded={accountOpen}
                    aria-haspopup="true"
                    aria-label={copy.account}
                  >
                    <UserCircleIcon className="h-[1.35rem] w-[1.35rem]" />
                  </button>
                  {accountOpen &&
                    canPortal &&
                    accountPopupStyle &&
                    createPortal(
                      <div
                        ref={accountPopupRef}
                        className="pretty-scrollbar webshop-dropdown-in fixed z-[1005] mt-3 overflow-y-auto overscroll-contain rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-2 text-sm text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
                        style={{
                          top: accountPopupStyle.top,
                          left: accountPopupStyle.left,
                          width: accountPopupStyle.width,
                          maxHeight: accountPopupStyle.maxHeight,
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
            className="relative z-[800] px-4 pb-1.5 sm:hidden"
            ref={mobileSearchRef}
          >
            <form
              action="/products"
              method="get"
              className="relative"
              onSubmit={handleSearchSubmit}
            >
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gv-text-muted)]" />
              <input
                type="search"
                name="searchQuery"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveSearchIndex(-1);
                  if (!searchOpen) setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder={copy.searchProducts}
                role="combobox"
                aria-label={copy.searchProducts}
                aria-expanded={searchOpen}
                aria-controls="navbar-search-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeSearchIndex >= 0
                    ? `navbar-search-option-${activeSearchIndex}`
                    : undefined
                }
                className="gv-input h-10 w-full rounded-full pl-9 pr-10 text-[13px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveSearchIndex(-1);
                    setSearchOpen(true);
                  }}
                  aria-label={language === "en" ? "Clear search" : "Suche löschen"}
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[color:var(--gv-text-muted)] transition hover:bg-[color:var(--gv-surface)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              <button type="submit" className="sr-only">
                {language === "en" ? "Show search results" : "Suchergebnisse anzeigen"}
              </button>
            </form>
          </div>
        )}
        {showCategoryBar && (
          <div className="relative z-10 mt-1 block border-y border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] shadow-[var(--gv-shadow)]">
            <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1280px] lg:px-8">
              <NavbarCategoryBar
                categories={mainCategories}
                categoriesStatus={categoriesStatus}
                childCountById={childCountByCategoryId}
                isMobile={isMobile}
                pathname={pathname}
                categoryNavTarget={categoryNavTarget}
                activeCategoryId={desktopCategoryPopupCategoryId}
                bestsellerLabel="Bestseller"
                errorLabel={copy.categoryLoadError}
                emptyLabel={copy.noCategories}
                onBestsellerClick={() => setCategoryNavTarget("/bestseller")}
                onCategoryClick={handleBarCategoryClick}
                registerTriggerRef={(id, node) => {
                  desktopCategoryTriggerRefs.current.set(id, node);
                }}
              />
            </div>
          </div>
        )}
        {desktopCategoryPopupCategoryId &&
          desktopCategoryPopupStyle &&
          activeDesktopCategoryChildren.length > 0 &&
          activeDesktopCategory &&
          canPortal && (
          <NavbarSubcategoriesPopup
            category={activeDesktopCategory}
            categories={activeDesktopCategoryChildren}
            copy={{ subcategories: copy.subcategories, viewAll: copy.viewAll }}
            onNavigate={navigateToCategory}
            popupRef={desktopCategoryPopupRef}
            popupStyle={desktopCategoryPopupStyle}
          />
        )}
        {cartOpen && !isMobile ? (
          <NavbarCartDrawer
            open
            cart={cart}
            loading={loading}
            error={error}
            canCheckout={canCheckout}
            checkoutStatus={checkoutStatus}
            onClose={() => setCartOpen(false)}
            onStartCheckout={() => void startCheckout()}
            onViewCart={() => setCartOpen(false)}
            panelRef={cartPanelRef}
            language={language}
          />
        ) : null}
      </nav>
      <div
        style={{
          height:
            navHeight != null
              ? `calc(${navHeight}px + var(--gv-announcement-offset, 28px))`
              : `calc(${showCategoryBar ? 146 : 49}px + var(--gv-announcement-offset, 28px))`,
        }}
        className="transition-[height] duration-150 ease-out sm:hidden"
        aria-hidden="true"
      />
      <div
        style={{
          height:
            navHeight != null
              ? `calc(${navHeight}px + var(--gv-announcement-offset, 40px))`
              : `calc(${showCategoryBar ? 118 : 61}px + var(--gv-announcement-offset, 40px))`,
        }}
        className="hidden transition-[height] duration-150 ease-out sm:block"
        aria-hidden="true"
      />
      {isMobile && productsOpen ? (
        <NavbarMobileCategoriesSheet
          open
          mobileProductsRef={mobileProductsRef}
          categoriesStatus={categoriesStatus}
          rootCategories={mainCategories}
          onClose={closeProductsExplorer}
          onOpenAllProducts={closeProductsExplorer}
          onOpenRootCategory={navigateToCategory}
          language={language}
        />
      ) : null}
    </>
  );
}
