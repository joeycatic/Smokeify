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
import type { BannerProduct, HeroBannerProps } from "./HeroBanner";
import {
  INTRO_FRAMES,
  OUTRO_FRAMES,
  SLIDE_FRAMES,
} from "./HeroBanner";

const BRAND = {
  primary: "#2f3e36",
  secondary: "#44584c",
  dark: "#15261d",
  gold: "#E4C56C",
  light: "#f5f0e8",
} as const;

const CheckIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill={BRAND.gold} opacity={0.18} />
    <path
      d="M7 12.5l3.5 3.5 6.5-7"
      stroke={BRAND.gold}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Intro: React.FC<{ introTagline: string }> = ({ introTagline }) => {
  const frame = useCurrentFrame();

  const markScale = spring({
    fps: 30,
    frame,
    config: { damping: 14, stiffness: 90 },
  });
  const logoScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 5),
    config: { damping: 12, stiffness: 80 },
  });
  const subtitleOpacity = interpolate(frame, [9, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [9, 20], [20, 0], {
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
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          width: 56,
          height: 3,
          borderRadius: 2,
          background: BRAND.gold,
          transform: `scaleX(${markScale})`,
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: BRAND.light,
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
          letterSpacing: "0.2em",
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

  const contentWidth = Math.round(width * 0.37);
  const contentPadX = Math.round(width * 0.038);
  const contentPadY = Math.round(height * 0.09);

  const imageScale = interpolate(frame, [0, SLIDE_FRAMES], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelIn = spring({
    fps: 30,
    frame: Math.max(0, frame - 2),
    config: { damping: 16, stiffness: 80 },
  });
  const panelOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priceIn = spring({
    fps: 30,
    frame: Math.max(0, frame - 8),
    config: { damping: 10, stiffness: 100 },
  });

  const featureSprings = product.features.map((_, i) =>
    spring({
      fps: 30,
      frame: Math.max(0, frame - 12 - i * 5),
      config: { damping: 13, stiffness: 86 },
    })
  );
  const featureOpacities = product.features.map((_, i) =>
    interpolate(frame, [12 + i * 5, 21 + i * 5], [0, 1], {
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
      <AbsoluteFill>
        <Img
          src={product.imageUrl}
          delayRenderTimeoutInMilliseconds={90000}
          delayRenderRetries={3}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${imageScale})`,
            transformOrigin: "center center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(120% 95% at 18% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.22) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg,
              rgba(0,0,0,0.05) 0%,
              rgba(0,0,0,0.12) 45%,
              rgba(7,15,10,0.78) 66%,
              rgba(7,15,10,0.92) 100%)`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "flex-end",
          justifyContent: "center",
          paddingRight: Math.round(width * 0.03),
          paddingLeft: Math.round(width * 0.03),
        }}
      >
        <div
          style={{
            width: contentWidth,
            minHeight: Math.round(height * 0.72),
            borderRadius: 26,
            border: "1px solid rgba(228,197,108,0.36)",
            background:
              "linear-gradient(180deg, rgba(17,30,23,0.78) 0%, rgba(12,22,17,0.9) 100%)",
            boxShadow: "0 28px 75px rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            padding: `${contentPadY}px ${contentPadX}px`,
            opacity: panelOpacity,
            transform: `translateX(${(1 - panelIn) * 30}px)`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              border: "1.5px solid rgba(228,197,108,0.75)",
              background: "rgba(47,62,54,0.64)",
              padding: "6px 18px",
              marginBottom: 18,
            }}
          >
            <span
              style={{
                fontSize: 18,
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
              fontSize: 16,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              marginBottom: 10,
            }}
          >
            {product.manufacturer}
          </div>

          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.08,
              color: "#ffffff",
              fontFamily: "Georgia, 'Times New Roman', serif",
              marginBottom: 10,
            }}
          >
            {product.title}
          </div>

          <div
            style={{
              fontSize: 22,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.66)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              marginBottom: 24,
            }}
          >
            {product.tagline}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
              transform: `scale(${priceIn})`,
              transformOrigin: "left center",
            }}
          >
            <div style={{ width: 3, height: 42, borderRadius: 2, background: BRAND.gold }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  lineHeight: 1,
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
                    fontSize: 19,
                    color: "rgba(255,255,255,0.34)",
                    textDecoration: "line-through",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  {product.compareAt}
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {product.features.map((feature, index) => (
              <div
                key={feature}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  opacity: featureOpacities[index],
                  transform: `translateX(${(1 - featureSprings[index]) * -16}px)`,
                }}
              >
                <CheckIcon />
                <span
                  style={{
                    fontSize: 19,
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
  const ctaScale = spring({
    fps: 30,
    frame: Math.max(0, frame - 6),
    config: { damping: 10, stiffness: 98 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${BRAND.primary} 0%, ${BRAND.secondary} 55%, ${BRAND.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        gap: 22,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: BRAND.light,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        smokeify
      </div>
      <div style={{ width: 94, height: 3, borderRadius: 2, background: BRAND.gold }} />
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
          padding: `${Math.round(width * 0.008)}px ${Math.round(width * 0.028)}px`,
          transform: `scale(${ctaScale})`,
          transformOrigin: "center",
        }}
      >
        <span
          style={{
            fontSize: 28,
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
          color: "rgba(255,255,255,0.4)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Kostenloser Versand ab 69 EUR
      </div>
    </AbsoluteFill>
  );
};

export const HeroBannerHQ: React.FC<HeroBannerProps> = ({ introTagline, products }) => {
  return (
    <AbsoluteFill style={{ background: BRAND.primary }}>
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
