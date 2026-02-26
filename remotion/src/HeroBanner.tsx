import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";

// ─── Brand ────────────────────────────────────────────────────────────────────

const BRAND = {
  primary: "#2f3e36",
  secondary: "#44584c",
  dark: "#1a2e22",
  gold: "#E4C56C",
  light: "#f5f0e8",
} as const;

// ─── Timing ───────────────────────────────────────────────────────────────────

export const INTRO_FRAMES = 45;  // 1.5s
export const SLIDE_FRAMES = 120; // 4s per product
export const OUTRO_FRAMES = 45;  // 1.5s

export const heroFrames = (productCount: number) =>
  INTRO_FRAMES + productCount * SLIDE_FRAMES + OUTRO_FRAMES;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BannerProduct = {
  title: string;
  manufacturer: string;
  price: string;
  compareAt?: string;
  imageUrl: string;
  category: string;
  tagline: string;
  features: string[];
};

export type HeroBannerProps = {
  introTagline: string;
  products: BannerProduct[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CheckIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
    <circle cx="12" cy="12" r="11" fill={BRAND.gold} opacity={0.18} />
    <path d="M7 12.5l3.5 3.5 6.5-7" stroke={BRAND.gold} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Intro ────────────────────────────────────────────────────────────────────

const Intro: React.FC<{ introTagline: string }> = ({ introTagline }) => {
  const frame = useCurrentFrame();

  const lineScale = spring({ fps: 30, frame, config: { damping: 14, stiffness: 90 } });
  const brandScale = spring({
    fps: 30, frame: Math.max(0, frame - 4),
    config: { damping: 12, stiffness: 80 },
  });
  const subOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [10, 22], [20, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [INTRO_FRAMES - 8, INTRO_FRAMES], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 22,
        opacity: exitOpacity,
      }}
    >
      <div style={{
        width: 60, height: 3, background: BRAND.gold, borderRadius: 2,
        transform: `scaleX(${lineScale})`, transformOrigin: "center", marginBottom: 6,
      }} />
      <div style={{
        fontSize: 96,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        color: BRAND.light,
        letterSpacing: "0.06em",
        transform: `scale(${brandScale})`,
        transformOrigin: "center",
      }}>
        smokeify
      </div>
      <div style={{
        fontSize: 30,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: BRAND.gold,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        opacity: subOpacity,
        transform: `translateY(${subY}px)`,
      }}>
        {introTagline}
      </div>
    </AbsoluteFill>
  );
};

// ─── Product slide ─────────────────────────────────────────────────────────────

const ProductSlide: React.FC<{ product: BannerProduct }> = ({ product }) => {
  const frame = useCurrentFrame();

  const imageScale = interpolate(frame, [0, SLIDE_FRAMES], [1.0, 1.07], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const contentSpring = spring({ fps: 30, frame, config: { damping: 16, stiffness: 80 } });
  const contentOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const priceSpring = spring({
    fps: 30, frame: Math.max(0, frame - 8),
    config: { damping: 10, stiffness: 110 },
  });

  const featureSprings = product.features.map((_, i) =>
    spring({ fps: 30, frame: Math.max(0, frame - 14 - i * 6), config: { damping: 14, stiffness: 90 } })
  );
  const featureOpacities = product.features.map((_, i) =>
    interpolate(frame, [14 + i * 6, 24 + i * 6], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    })
  );

  const exitOpacity = interpolate(frame, [SLIDE_FRAMES - 8, SLIDE_FRAMES], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BRAND.dark, opacity: exitOpacity }}>
      {/* Product image — left side, fully contained, no cropping */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "58%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}>
        <Img
          src={product.imageUrl}
          delayRenderTimeoutInMilliseconds={90000}
          delayRenderRetries={3}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: "60px 40px",
            transform: `scale(${imageScale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* Gradient: transparent on left, dark on right for text panel */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(
          to right,
          transparent 30%,
          rgba(8,18,12,0.7) 50%,
          ${BRAND.dark} 62%
        )`,
      }} />

      {/* Category pill — top left */}
      <AbsoluteFill style={{
        justifyContent: "flex-start", alignItems: "flex-start",
        padding: "52px 60px 0",
        opacity: contentOpacity,
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          background: "rgba(47,62,54,0.75)",
          border: `1.5px solid ${BRAND.gold}`,
          borderRadius: 100,
          padding: "6px 22px",
          backdropFilter: "blur(8px)",
        }}>
          <span style={{
            fontSize: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: BRAND.gold,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}>
            {product.category}
          </span>
        </div>
      </AbsoluteFill>

      {/* Text content — right side, vertically centered */}
      <AbsoluteFill style={{
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 72px",
        opacity: contentOpacity,
        transform: `translateX(${(1 - contentSpring) * 40}px)`,
      }}>
        <div style={{ width: 680 }}>
          {/* Manufacturer */}
          <div style={{
            fontSize: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}>
            {product.manufacturer}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 64,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            marginBottom: 12,
          }}>
            {product.title}
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 22,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "rgba(255,255,255,0.6)",
            marginBottom: 28,
            lineHeight: 1.4,
          }}>
            {product.tagline}
          </div>

          {/* Price */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
            transform: `scale(${priceSpring})`,
            transformOrigin: "left center",
          }}>
            <div style={{ width: 3, height: 48, background: BRAND.gold, borderRadius: 2 }} />
            <div>
              <div style={{
                fontSize: 58,
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                color: BRAND.gold,
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}>
                {product.price}
              </div>
              {product.compareAt && (
                <div style={{
                  fontSize: 22,
                  color: "rgba(255,255,255,0.35)",
                  textDecoration: "line-through",
                  marginTop: 3,
                }}>
                  {product.compareAt}
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {product.features.map((feat, i) => (
              <div key={feat} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                opacity: featureOpacities[i],
                transform: `translateX(${(1 - featureSprings[i]) * -20}px)`,
              }}>
                <CheckIcon />
                <span style={{
                  fontSize: 22,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.35,
                }}>
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Outro ────────────────────────────────────────────────────────────────────

const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 10], [30, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const badgeScale = spring({
    fps: 30, frame: Math.max(0, frame - 8),
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      gap: 26,
      opacity,
      transform: `translateY(${y}px)`,
    }}>
      <div style={{
        fontSize: 82,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        color: BRAND.light,
        letterSpacing: "0.06em",
      }}>
        smokeify
      </div>
      <div style={{ width: 100, height: 3, background: BRAND.gold, borderRadius: 2 }} />
      <div style={{
        fontSize: 36,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: BRAND.gold,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}>
        smokeify.de
      </div>
      <div style={{
        marginTop: 8,
        background: BRAND.gold,
        borderRadius: 100,
        padding: "18px 52px",
        transform: `scale(${badgeScale})`,
        transformOrigin: "center",
      }}>
        <span style={{
          fontSize: 30,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          color: BRAND.primary,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          Jetzt Shoppen
        </span>
      </div>
      <div style={{
        fontSize: 22,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.06em",
        marginTop: 2,
      }}>
        Kostenloser Versand ab 69 €
      </div>
    </AbsoluteFill>
  );
};

// ─── Root composition ─────────────────────────────────────────────────────────

export const HeroBanner: React.FC<HeroBannerProps> = ({ introTagline, products }) => {
  return (
    <AbsoluteFill style={{ background: BRAND.primary }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro introTagline={introTagline} />
      </Sequence>

      {products.map((product, i) => (
        <Sequence
          key={product.title}
          from={INTRO_FRAMES + i * SLIDE_FRAMES}
          durationInFrames={SLIDE_FRAMES}
        >
          <ProductSlide product={product} />
        </Sequence>
      ))}

      <Sequence
        from={INTRO_FRAMES + products.length * SLIDE_FRAMES}
        durationInFrames={OUTRO_FRAMES}
      >
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
