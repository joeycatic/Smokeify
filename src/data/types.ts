type ShopifyImage = {
  url: string;
  altText: string | null;
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
  collections: ShopifyCollection[];
  featuredImage: ShopifyImage | null;
  priceRange: {
    minVariantPrice: ShopifyPrice;
  };
}

export type ProductFilters = {
  vendors: string[];        
  collections: string[];    
  priceRange: [number, number];
  searchQuery: string;
}