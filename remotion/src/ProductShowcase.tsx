import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";

// ─── Brand ───────────────────────────────────────────────────────────────────

const BRAND = {
  primary: "#2f3e36",
  secondary: "#44584c",
  dark: "#1a2e22",
  gold: "#E4C56C",
  light: "#f5f0e8",
} as const;

// ─── Products ─────────────────────────────────────────────────────────────────
// Images sourced from supplier CDN. Replace with Vercel Blob URLs once in DB.

type Product = {
  title: string;
  manufacturer: string;
  price: string;
  compareAt?: string;
  imageUrl: string;
  category: string;
  tagline: string;           // short subtitle shown under manufacturer
  features: string[];        // 3 bullet points shown below price
};

const PRODUCTS: Product[] = [
  {
    title: "Fortis NXT 720W BYD",
    manufacturer: "Fox Lighting Europe BV",
    price: "169,99 €",
    compareAt: "199,99 €",
    imageUrl:
      "https://www.bloomtech.de/media/image/product/7753/lg/fortis-nxt-720w-byd-id.webp",
    category: "LED Grow Light",
    tagline: "Samsung LM301H EVO + BYD Chips",
    features: ["720 Watt Leistung", "Footprint 1,2 m × 1,2 m", "Stufenlos dimmbar"],
  },
  {
    title: "Cloudlab 722 Growzelt",
    manufacturer: "AC Infinity",
    price: "168,99 €",
    imageUrl:
      "https://www.bloomtech.de/media/image/product/7825/lg/lumii-xled-720w.webp",
    category: "Grow Tent",
    tagline: "60 × 60 × 180 cm — Reflektive Mylar-Innenwände",
    features: ["Verstärkter Reißverschluss", "Mehrfach-Lüftungsöffnungen", "Stabile Stahl-Konstruktion"],
  },
  {
    title: "Spektrum Master 720W",
    manufacturer: "Fox Lighting Europe BV",
    price: "324,99 €",
    imageUrl:
      "https://www.bloomtech.de/media/image/product/7838/lg/spektrum-master-720w-110cm.webp",
    category: "LED Grow Light",
    tagline: "Sunrise / Sunset Modus — Maximale Erträge",
    features: ["720 Watt, 110 cm Balken", "Sunrise/Sunset Dimm-Kurve", "Vollspektrum Grow & Bloom"],
  },
  {
    title: "Lux Helios Pro 300W",
    manufacturer: "Ferna Trade",
    price: "129,99 €",
    imageUrl:
      "https://www.bloomtech.de/media/image/product/7807/lg/lux-helios-pro-300-watt-28.webp",
    category: "LED Grow Light",
    tagline: "2,8 µmol/J Effizienz — Top Preis-Leistung",
    features: ["300 Watt", "2,8 µmol/J Effizienz", "Passiv gekühlt"],
  },
];

// ─── Timing ───────────────────────────────────────────────────────────────────

const INTRO_FRAMES = 75;   // 2.5s
const SLIDE_FRAMES = 150;  // 5s per product
const OUTRO_FRAMES = 75;   // 2.5s

export const TOTAL_FRAMES =
  INTRO_FRAMES + PRODUCTS.length * SLIDE_FRAMES + OUTRO_FRAMES;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CheckIcon: React.FC = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    style={{ flexShrink: 0, marginTop: 2 }}
  >
    <circle cx="12" cy="12" r="11" fill={BRAND.gold} opacity={0.18} />
    <path
      d="M7 12.5l3.5 3.5 6.5-7"
      stroke={BRAND.gold}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Intro ────────────────────────────────────────────────────────────────────

const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const lineScale = spring({ fps: 30, frame, config: { damping: 14, stiffness: 90 } });
  const brandScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 8),
    config: { damping: 12, stiffness: 80 },
  });
  const taglineOpacity = interpolate(frame, [32, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [32, 56], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [INTRO_FRAMES - 18, INTRO_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 28,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          width: 80,
          height: 4,
          background: BRAND.gold,
          borderRadius: 2,
          transform: `scaleX(${lineScale})`,
          transformOrigin: "center",
          marginBottom: 8,
        }}
      />
      <div
        style={{
          fontSize: 108,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          color: BRAND.light,
          letterSpacing: "0.06em",
          transform: `scale(${brandScale})`,
          transformOrigin: "center",
        }}
      >
        smokeify
      </div>
      <div
        style={{
          fontSize: 34,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontWeight: 400,
          color: BRAND.gold,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        Grow Shop Deutschland
      </div>
    </AbsoluteFill>
  );
};

// ─── Product Slide ────────────────────────────────────────────────────────────

const ProductSlide: React.FC<{ product: Product }> = ({ product }) => {
  const frame = useCurrentFrame();

  const imageScale = interpolate(frame, [0, SLIDE_FRAMES], [1.0, 1.07], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const contentSpring = spring({
    fps: 30,
    frame,
    config: { damping: 16, stiffness: 80 },
  });
  const contentOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priceSpring = spring({
    fps: 30,
    frame: Math.max(0, frame - 20),
    config: { damping: 10, stiffness: 110 },
  });

  // Features stagger in one by one
  const featureSprings = product.features.map((_, i) =>
    spring({
      fps: 30,
      frame: Math.max(0, frame - 35 - i * 14),
      config: { damping: 14, stiffness: 90 },
    })
  );
  const featureOpacities = product.features.map((_, i) =>
    interpolate(frame, [35 + i * 14, 55 + i * 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const exitOpacity = interpolate(
    frame,
    [SLIDE_FRAMES - 18, SLIDE_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#0d1a12", opacity: exitOpacity }}>
      {/* Full-bleed product image */}
      <AbsoluteFill>
        <Img
          src={product.imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${imageScale})`,
            transformOrigin: "center center",
          }}
        />
        {/* Dark gradient from ~40% down for text legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(
              to bottom,
              transparent 22%,
              rgba(8, 18, 12, 0.4) 42%,
              rgba(5, 14, 10, 0.82) 62%,
              ${BRAND.primary}f0 100%
            )`,
          }}
        />
      </AbsoluteFill>

      {/* Top badge — category */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "flex-start",
          padding: "72px 68px 0",
          opacity: contentOpacity,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(47, 62, 54, 0.75)",
            border: `1.5px solid ${BRAND.gold}`,
            borderRadius: 100,
            padding: "8px 30px",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: BRAND.gold,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {product.category}
          </span>
        </div>
      </AbsoluteFill>

      {/* Bottom content */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: "0 68px 100px",
          opacity: contentOpacity,
          transform: `translateY(${(1 - contentSpring) * 48}px)`,
        }}
      >
        {/* Manufacturer */}
        <div
          style={{
            fontSize: 28,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {product.manufacturer}
        </div>

        {/* Product title */}
        <div
          style={{
            fontSize: 72,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.08,
            marginBottom: 14,
          }}
        >
          {product.title}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "rgba(255,255,255,0.65)",
            marginBottom: 32,
            lineHeight: 1.4,
          }}
        >
          {product.tagline}
        </div>

        {/* Price row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            marginBottom: 36,
            transform: `scale(${priceSpring})`,
            transformOrigin: "left center",
          }}
        >
          <div
            style={{
              width: 4,
              height: 56,
              background: BRAND.gold,
              borderRadius: 2,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 74,
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                color: BRAND.gold,
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              {product.price}
            </div>
            {product.compareAt && (
              <div
                style={{
                  fontSize: 30,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  color: "rgba(255,255,255,0.35)",
                  textDecoration: "line-through",
                  marginTop: 4,
                }}
              >
                {product.compareAt}
              </div>
            )}
          </div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {product.features.map((feature, i) => (
            <div
              key={feature}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                opacity: featureOpacities[i],
                transform: `translateX(${(1 - featureSprings[i]) * -24}px)`,
              }}
            >
              <CheckIcon />
              <span
                style={{
                  fontSize: 30,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.35,
                }}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Outro ────────────────────────────────────────────────────────────────────

const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 25], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 20),
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 32,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          color: BRAND.light,
          letterSpacing: "0.06em",
        }}
      >
        smokeify
      </div>

      <div
        style={{
          width: 120,
          height: 3,
          background: BRAND.gold,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          fontSize: 44,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: BRAND.gold,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        smokeify.de
      </div>

      {/* CTA badge */}
      <div
        style={{
          marginTop: 12,
          background: BRAND.gold,
          borderRadius: 100,
          padding: "22px 64px",
          transform: `scale(${badgeScale})`,
          transformOrigin: "center",
        }}
      >
        <span
          style={{
            fontSize: 38,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 700,
            color: BRAND.primary,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Jetzt Shoppen
        </span>
      </div>

      <div
        style={{
          fontSize: 28,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.06em",
          marginTop: 4,
        }}
      >
        Kostenloser Versand ab 69 €
      </div>
    </AbsoluteFill>
  );
};

// ─── Root Composition ─────────────────────────────────────────────────────────

export const ProductShowcase: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BRAND.primary }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro />
      </Sequence>

      {PRODUCTS.map((product, i) => (
        <Sequence
          key={product.title}
          from={INTRO_FRAMES + i * SLIDE_FRAMES}
          durationInFrames={SLIDE_FRAMES}
        >
          <ProductSlide product={product} />
        </Sequence>
      ))}

      <Sequence
        from={INTRO_FRAMES + PRODUCTS.length * SLIDE_FRAMES}
        durationInFrames={OUTRO_FRAMES}
      >
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
