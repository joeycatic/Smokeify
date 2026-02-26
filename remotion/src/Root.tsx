import React from "react";
import { Composition } from "remotion";
import { ProductShowcase, TOTAL_FRAMES } from "./ProductShowcase";
import { HeroBanner, HeroBannerProps, heroFrames } from "./HeroBanner";

// ─── Landing page banner ───────────────────────────────────────────────────────

const BANNER: { id: string } & HeroBannerProps = {
  id: "HeroBanner",
  introTagline: "Grow & Headshop",
  products: [
    {
      title: "Lux Helios Pro 300W",
      manufacturer: "Bloomtech",
      price: "147,99 €",
      imageUrl: "https://pdgpa612bwysfijp.public.blob.vercel-storage.com/uploads/bf5c9850-5b16-49c9-9b48-dfd32c15cadb.jpg",
      category: "LED Grow Light",
      tagline: "2,8 µmol/J Effizienz — Top Preis-Leistung",
      features: ["300 Watt", "Passiv gekühlt", "Vollspektrum"],
    },
    {
      title: "DiamondBox SL60",
      manufacturer: "DiamondBox",
      price: "81,99 €",
      imageUrl: "https://pdgpa612bwysfijp.public.blob.vercel-storage.com/uploads/0247b566-6eb6-4843-a86e-03df29f75fe5.png",
      category: "Growbox",
      tagline: "Kompakter Einstieg — volle Kontrolle",
      features: ["60×60×160 cm", "Reißfestes Material", "Einfacher Aufbau"],
    },
    {
      title: "AC Infinity CLOUDRAY S6",
      manufacturer: "AC Infinity",
      price: "88,99 €",
      imageUrl: "https://pdgpa612bwysfijp.public.blob.vercel-storage.com/uploads/74140d4e-1352-4f78-a5ee-d83aaa0d06e2.jpg",
      category: "Belüftung",
      tagline: "Stille Oszillation — optimale Luftzirkulation",
      features: ["6\" Durchmesser", "Automatische Oszillation", "Leiser Betrieb"],
    },
    {
      title: "Norddampf Dab Pen",
      manufacturer: "Norddampf",
      price: "17,99 €",
      imageUrl: "https://pdgpa612bwysfijp.public.blob.vercel-storage.com/uploads/9a68051e-a91e-4fed-a44c-4f6640f2f3cc.webp",
      category: "Dab Pen",
      tagline: "Kompakt, diskret — überall dabei",
      features: ["Für Konzentrate", "Schnell aufgeheizt", "Kompaktes Design"],
    },
    {
      title: "Hydro Shoot 60 Grow Set",
      manufacturer: "Secret Jardin",
      price: "327,99 €",
      imageUrl: "https://pdgpa612bwysfijp.public.blob.vercel-storage.com/uploads/5cbc3d84-a387-4dd3-8f1d-5d259ae3cb52.webp",
      category: "Komplettset",
      tagline: "Alles drin — sofort loslegen",
      features: ["60×60×158 cm", "Komplettset", "Hydro-optimiert"],
    },
  ],
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      <Composition
        id={BANNER.id}
        component={HeroBanner}
        durationInFrames={heroFrames(BANNER.products.length)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ introTagline: BANNER.introTagline, products: BANNER.products }}
      />
    </>
  );
};
