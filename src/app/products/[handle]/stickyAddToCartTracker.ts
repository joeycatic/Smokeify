type StickyAddToCartState = {
  navBottom: number;
  showStickyBar: boolean;
};

type StickyAddToCartTrackerOptions = {
  target: HTMLElement;
  onChange: (state: StickyAddToCartState) => void;
};

export function trackStickyAddToCartBar({
  target,
  onChange,
}: StickyAddToCartTrackerOptions) {
  let animationFrameId: number | null = null;
  let scrollSettleTimer: number | null = null;
  let delayedSettleTimers: number[] = [];

  const nav = document.querySelector("nav");
  const announcement = document.querySelector(".gv-announcement-bar");
  const visualViewport = window.visualViewport;
  const measureNav = () => nav?.getBoundingClientRect().bottom ?? 96;

  const update = () => {
    const navBottom = measureNav();
    onChange({
      navBottom,
      showStickyBar: target.getBoundingClientRect().bottom <= navBottom + 8,
    });
  };

  const scheduleUpdate = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null;
      update();
    });
  };

  const scheduleSettledUpdates = () => {
    delayedSettleTimers.forEach((timer) => window.clearTimeout(timer));
    delayedSettleTimers = [180, 360, 720].map((delay) =>
      window.setTimeout(scheduleUpdate, delay),
    );
  };

  const handleScroll = () => {
    scheduleUpdate();
    if (scrollSettleTimer !== null) {
      window.clearTimeout(scrollSettleTimer);
    }
    scrollSettleTimer = window.setTimeout(scheduleUpdate, 180);
    scheduleSettledUpdates();
  };

  const handleOffsetChange = () => {
    scheduleUpdate();
    scheduleSettledUpdates();
  };

  const intersectionObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(scheduleUpdate, { threshold: 0 });
  const mutationObserver = new MutationObserver(handleOffsetChange);
  const navMeasureInterval = window.setInterval(scheduleUpdate, 60);

  update();
  intersectionObserver?.observe(target);
  mutationObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  visualViewport?.addEventListener("scroll", handleOffsetChange, {
    passive: true,
  });
  visualViewport?.addEventListener("resize", handleOffsetChange, {
    passive: true,
  });
  nav?.addEventListener("transitionend", handleOffsetChange);
  announcement?.addEventListener("transitionend", handleOffsetChange);

  return () => {
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    if (scrollSettleTimer !== null) window.clearTimeout(scrollSettleTimer);
    delayedSettleTimers.forEach((timer) => window.clearTimeout(timer));
    window.clearInterval(navMeasureInterval);
    intersectionObserver?.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", scheduleUpdate);
    visualViewport?.removeEventListener("scroll", handleOffsetChange);
    visualViewport?.removeEventListener("resize", handleOffsetChange);
    nav?.removeEventListener("transitionend", handleOffsetChange);
    announcement?.removeEventListener("transitionend", handleOffsetChange);
  };
}
