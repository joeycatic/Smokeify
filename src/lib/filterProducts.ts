import type { Product, ProductFilters } from "@/data/types";

export function filterProducts(
    products: Product[],
    filters: ProductFilters
): Product[] {
    return products.filter((product) => {
        const query = (filters.searchQuery ?? "").trim().toLowerCase();
        if (query) {
            const collectionTitles =
                product.collections?.map((c) => c.title).join(" ") ?? "";
            const categoryTitles =
                product.categories?.map((c) => c.title).join(" ") ?? "";
            const haystack = [
                product.title,
                product.description,
                collectionTitles,
                categoryTitles,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(query)) {
                return false;
            }
        }
    
        // Category Filter
        if (filters.categories.length > 0) {
            const productCategoryHandles = product.categories.map((c) => c.handle);
            const hasMatchingCategory = filters.categories.some(
                (filterCategory: string) => productCategoryHandles.includes(filterCategory)
            );

            if (!hasMatchingCategory) {
                return false;
            }
        }

        // Manufacturer Filter
        const manufacturers = (filters.manufacturers ?? []).map((item) =>
            item.trim().toLowerCase()
        );
        if (manufacturers.length > 0) {
            const manufacturer = (product.manufacturer ?? "").trim().toLowerCase();
            const hasMatchingManufacturer = manufacturers.some((filterValue) => {
                if (!filterValue) return false;
                if (manufacturer === filterValue) return true;
                return manufacturer.includes(filterValue) || filterValue.includes(manufacturer);
            });
            if (!hasMatchingManufacturer) {
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
