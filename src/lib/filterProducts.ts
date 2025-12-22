import type { Product, ProductFilters } from "@/data/types";

export function filterProducts(
    products: Product[],
    filters: ProductFilters
): Product[] {
    return products.filter((product) => {
        const query = (filters.searchQuery ?? "").trim().toLowerCase();
        if (query) {
            const collectionTitles = product.collections?.map((c) => c.title).join(" ") ?? "";
            const haystack = [
                product.title,
                product.vendor,
                product.productType,
                collectionTitles,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(query)) {
                return false;
            }
        }

        // Vendor Filter
        if (filters.vendors.length > 0) {
            if (!filters.vendors.includes(product.vendor)) {
                return false;
            }
        }
    
        // Collection Filter
        if (filters.collections.length > 0) {
            const productCollectionHandles = product.collections.map(c => c.handle);
            const hasMatchingCollection = filters.collections.some(
                (filterCollection: string) => productCollectionHandles.includes(filterCollection)
            );

            if (!hasMatchingCollection) {
                return false;
            }
        }
        
        // Price Filter
        const price = parseFloat(product.priceRange.minVariantPrice.amount);
        if (price < filters.priceMin || price > filters.priceMax) {
            return false;
        }

        return true;
    })
}
