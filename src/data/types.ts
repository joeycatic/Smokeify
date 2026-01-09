export type ProductImage = {
  url: string;
  altText: string | null;
};

export type ProductCollection = {
  id: string;
  handle: string;
  title: string;
};

export type ProductCategory = {
  id: string;
  handle: string;
  title: string;
};

export type ProductPrice = {
  amount: string;
  currencyCode: string;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  manufacturer: string | null;
  tags: string[];
  availableForSale: boolean;
  defaultVariantId: string | null;
  collections: ProductCollection[];
  categories: ProductCategory[];
  featuredImage: ProductImage | null;
  images: ProductImage[];
  priceRange: {
    minVariantPrice: ProductPrice;
  };
};

export type ProductFilters = {
  categories: string[];
  priceMin: number;
  priceMax: number;
  searchQuery?: string;
};
