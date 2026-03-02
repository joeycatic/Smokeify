import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BRAND = {
  primary: "#2f3e36",
  secondary: "#44584c",
  dark: "#13221a",
  gold: "#e4c56c",
  cream: "#f3eee3",
} as const;

export const INTRO_FRAMES = 45;
export const SLIDE_FRAMES = 120;
export const OUTRO_FRAMES = 45;

export const heroFrames = (productCount: number) =>
  INTRO_FRAMES + productCount * SLIDE_FRAMES + OUTRO_FRAMES;

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

const CheckIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill={BRAND.gold} opacity={0.2} />
    <path
      d="M7 12.5l3.5 3.5 6.5-7"
      stroke={BRAND.gold}
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Intro: React.FC<{ introTagline: string }> = ({ introTagline }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const logoScale = spring({
    fps: 30,
    frame,
    config: { damping: 13, stiffness: 84 },
  });
  const accentScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 4),
    config: { damping: 12, stiffness: 88 },
  });
  const subtitleOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [10, 22], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [INTRO_FRAMES - 9, INTRO_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 56%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          width: Math.round(width * 0.035),
          height: 3,
          borderRadius: 999,
          background: BRAND.gold,
          transform: `scaleX(${accentScale})`,
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: BRAND.cream,
          fontFamily: "Georgia, 'Times New Roman', serif",
          transform: `scale(${logoScale})`,
          transformOrigin: "center",
        }}
      >
        smokeify
      </div>
      <div
        style={{
          fontSize: 30,
          letterSpacing: "0.19em",
          textTransform: "uppercase",
          color: BRAND.gold,
          fontFamily: "system-ui, -apple-system, sans-serif",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        {introTagline}
      </div>
    </AbsoluteFill>
  );
};

const ProductSlide: React.FC<{ product: BannerProduct }> = ({ product }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const leftWidth = Math.round(width * 0.58);
  const rightWidth = width - leftWidth;
  const panelPadX = Math.round(width * 0.026);
  const panelPadY = Math.round(height * 0.1);

  const imageScale = interpolate(frame, [0, SLIDE_FRAMES], [1, 1.045], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelIn = spring({
    fps: 30,
    frame: Math.max(0, frame - 2),
    config: { damping: 16, stiffness: 84 },
  });
  const panelOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priceIn = spring({
    fps: 30,
    frame: Math.max(0, frame - 8),
    config: { damping: 10, stiffness: 98 },
  });

  const featureIn = product.features.map((_, idx) =>
    spring({
      fps: 30,
      frame: Math.max(0, frame - 12 - idx * 5),
      config: { damping: 13, stiffness: 88 },
    })
  );
  const featureOpacity = product.features.map((_, idx) =>
    interpolate(frame, [12 + idx * 5, 20 + idx * 5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const exitOpacity = interpolate(frame, [SLIDE_FRAMES - 9, SLIDE_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BRAND.dark, opacity: exitOpacity }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: leftWidth,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 90% at 38% 40%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 60%, rgba(0,0,0,0.2) 100%)",
          overflow: "hidden",
        }}
      >
        <Img
          src={product.imageUrl}
          delayRenderTimeoutInMilliseconds={90000}
          delayRenderRetries={3}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: `${Math.round(height * 0.08)}px ${Math.round(width * 0.03)}px`,
            transform: `scale(${imageScale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg,
            rgba(0,0,0,0) 27%,
            rgba(5,12,8,0.4) 52%,
            rgba(8,16,12,0.9) 67%,
            rgba(8,16,12,0.97) 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: rightWidth,
          height: "100%",
          padding: `${panelPadY}px ${panelPadX}px`,
          opacity: panelOpacity,
          transform: `translateX(${(1 - panelIn) * 26}px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            border: "1.5px solid rgba(228,197,108,0.74)",
            background: "rgba(47,62,54,0.56)",
            padding: "5px 16px",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 16,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: BRAND.gold,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {product.category}
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.52)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            marginBottom: 8,
          }}
        >
          {product.manufacturer}
        </div>

        <div
          style={{
            fontSize: 52,
            lineHeight: 1.08,
            fontWeight: 700,
            color: "#ffffff",
            fontFamily: "Georgia, 'Times New Roman', serif",
            marginBottom: 10,
          }}
        >
          {product.title}
        </div>

        <div
          style={{
            fontSize: 20,
            lineHeight: 1.38,
            color: "rgba(255,255,255,0.68)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            marginBottom: 20,
          }}
        >
          {product.tagline}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 20,
            transform: `scale(${priceIn})`,
            transformOrigin: "left center",
          }}
        >
          <div
            style={{
              width: 3,
              height: 40,
              borderRadius: 2,
              background: BRAND.gold,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontSize: 50,
                lineHeight: 1,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: BRAND.gold,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {product.price}
            </span>
            {product.compareAt ? (
              <span
                style={{
                  fontSize: 18,
                  color: "rgba(255,255,255,0.36)",
                  textDecoration: "line-through",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {product.compareAt}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {product.features.map((feature, idx) => (
            <div
              key={feature}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                opacity: featureOpacity[idx],
                transform: `translateX(${(1 - featureIn[idx]) * -14}px)`,
              }}
            >
              <CheckIcon />
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1.35,
                  color: "rgba(255,255,255,0.86)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 10], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 7),
    config: { damping: 10, stiffness: 98 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 56%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: BRAND.cream,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        smokeify
      </div>
      <div style={{ width: 92, height: 3, borderRadius: 999, background: BRAND.gold }} />
      <div
        style={{
          fontSize: 34,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: BRAND.gold,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        smokeify.de
      </div>
      <div
        style={{
          marginTop: 4,
          borderRadius: 999,
          background: BRAND.gold,
          padding: `${Math.round(width * 0.0075)}px ${Math.round(width * 0.026)}px`,
          transform: `scale(${badgeScale})`,
          transformOrigin: "center",
        }}
      >
        <span
          style={{
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: BRAND.primary,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Jetzt shoppen
        </span>
      </div>
      <div
        style={{
          fontSize: 20,
          letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.42)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Kostenloser Versand ab 69 EUR
      </div>
    </AbsoluteFill>
  );
};

export const HeroBanner: React.FC<HeroBannerProps> = ({ introTagline, products }) => {
  return (
    <AbsoluteFill style={{ background: BRAND.dark }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro introTagline={introTagline} />
      </Sequence>

      {products.map((product, index) => (
        <Sequence
          key={product.title}
          from={INTRO_FRAMES + index * SLIDE_FRAMES}
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
