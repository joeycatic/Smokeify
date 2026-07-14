export type TentHotspotProduct = {
  title: string;
  priceLabel: string;
  manufacturer: string | null;
  href: string;
};

export type GrowTentViewerProductProps = {
  tent: TentHotspotProduct | null;
  light: TentHotspotProduct | null;
  exhaustFan: TentHotspotProduct | null;
  carbonFilter: TentHotspotProduct | null;
  circulationFan: TentHotspotProduct | null;
  substrate: TentHotspotProduct | null;
};
