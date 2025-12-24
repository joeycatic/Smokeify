import { Product, ProductImage } from "@/data/types"

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_STOREFRONT_TOKEN!;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-04";

const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

type ShopifyCollectionNode = {
  id: string;
  handle: string;
  title: string;
};

type ShopifyProductNode = Omit<Product, "collections" | "images"> & {
  collections: {
    edges: Array<{
      node: ShopifyCollectionNode;
    }>;
  };
  images?: {
    edges: Array<{
      node: ProductImage;
    }>;
  };
  variants?: {
    edges: Array<{
      node: { id: string };
    }>;
  };
};

type ShopifyProductsResponse = {
  products: {
    edges: Array<{
      node: ShopifyProductNode;
    }>;
  };
};

export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store", // immer frische Daten
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("Shopify FULL ERROR:", JSON.stringify(json, null, 2));
    throw new Error("Shopify API Error");
  }

  return json.data;
}

export async function getProducts(limit = 10): Promise<Product[]> {
  const query = /* GraphQL */ `
    query Products($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            handle
            title
            vendor
            productType
            availableForSale
            collections(first: 10) {
              edges {
                node {
                  id
                  handle
                  title
                }
              }
            }
            featuredImage {
              url
              altText
              width
              height
            }
            images(first: 6) {
              edges {
                node {
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<ShopifyProductsResponse>(query, { first: limit });
  
  // Transformiere die Shopify-Struktur in eine sauberere Form
  return data.products.edges.map((edge) => ({
    ...edge.node,
    defaultVariantId: edge.node.variants?.edges?.[0]?.node?.id ?? null,
    collections: edge.node.collections.edges.map((e) => e.node),
    images: edge.node.images?.edges?.map((e) => e.node) ?? [],
  }));
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];

  const query = /* GraphQL */ `
    query ProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          handle
          title
          vendor
          productType
          availableForSale
          featuredImage {
            url
            altText
            width
            height
          }
          images(first: 6) {
            edges {
              node {
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          collections(first: 10) {
            edges {
              node {
                id
                handle
                title
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<{ nodes: Array<ShopifyProductNode | null> }>(query, {
    ids,
  });

  return data.nodes
    .filter((node): node is ShopifyProductNode => Boolean(node))
    .map((node) => ({
      ...node,
      defaultVariantId: node.variants?.edges?.[0]?.node?.id ?? null,
      collections: node.collections.edges.map((e) => e.node),
      images: node.images?.edges?.map((e) => e.node) ?? [],
    }));
}

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: { amount: string; currencyCode: string };
};

export type ProductDetail = Product & {
  descriptionHtml: string;
  images: ProductImage[];
  variants: ProductVariant[];
  options: { name: string; values: string[] }[];
};

type ProductByHandleResponse = {
  productByHandle: (Product & {
    descriptionHtml: string;
    images: { edges: Array<{ node: ProductImage }> };
    variants: { edges: Array<{ node: ProductVariant }> };
    options: { name: string; values: string[] }[];
    collections: {
      edges: Array<{ node: { id: string; handle: string; title: string } }>;
    };
  }) | null;
};

type ProductsByQueryResponse = {
  products: {
    edges: Array<{
      node: ProductByHandleResponse["productByHandle"];
    }>;
  };
};

export async function getProductByHandle(handle: string): Promise<ProductDetail | null> {
  const safeHandle = decodeURIComponent(String(handle ?? "")).trim();
  if (!safeHandle) return null;

  const query = /* GraphQL */ `
    query ProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        handle
        title
        vendor
        productType
        availableForSale

        descriptionHtml

        featuredImage {
          url
          altText
          width
          height
        }

        images(first: 12) {
          edges {
            node {
              url
              altText
              width
              height
            }
          }
        }

        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }

        collections(first: 10) {
          edges {
            node {
              id
              handle
              title
            }
          }
        }

        options {
          name
          values
        }

        variants(first: 50) {
          edges {
            node {
              id
              title
              availableForSale
              selectedOptions {
                name
                value
              }
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<ProductByHandleResponse>(query, { handle: safeHandle });
  let p = data.productByHandle;

  if (!p) {
    const fallbackQuery = /* GraphQL */ `
      query ProductByHandleQuery($query: String!) {
        products(first: 1, query: $query) {
          edges {
            node {
              id
              handle
              title
              vendor
              productType
              availableForSale
              descriptionHtml
              featuredImage {
                url
                altText
                width
                height
              }
              images(first: 12) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              collections(first: 10) {
                edges {
                  node {
                    id
                    handle
                    title
                  }
                }
              }
              options {
                name
                values
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    selectedOptions {
                      name
                      value
                    }
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const fallbackData = await shopifyFetch<ProductsByQueryResponse>(fallbackQuery, {
      query: `handle:${safeHandle}`,
    });
    p = fallbackData.products.edges[0]?.node ?? null;
  }

  if (!p) return null;

  return {
    ...p,
    collections: p.collections.edges.map((e) => e.node),
    images: p.images.edges.map((e) => e.node),
    variants: p.variants.edges.map((e) => e.node),
    options: p.options ?? [],
  };
}
