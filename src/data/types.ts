export type ProductImage = {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
}

type ShopifyCollection = {
  id: string;
  handle: string;
  title: string;
}

type ShopifyPrice = {
  amount: string;
  currencyCode: string;
}

export type Product = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  availableForSale: boolean;
  defaultVariantId?: string | null;
  collections: ShopifyCollection[];
  featuredImage: ProductImage | null;
  images?: ProductImage[];
  priceRange: {
    minVariantPrice: ShopifyPrice;
  };
}

export type ProductFilters = {
  vendors: string[];        
  collections: string[];    
  priceMin: number; 
  priceMax: number;
  searchQuery?: string;
}
