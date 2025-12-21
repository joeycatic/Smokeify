// lib/displayProducts.tsx
export default function DisplayProducts({ 
  cols = 3, 
  products 
}: { 
  cols?: number; 
  products: any[] 
}) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return (
      <div className="text-center py-12 text-stone-600">
        Keine Produkte gefunden
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
      {products.map((p) => (
        <article
          key={p.id}
          className="rounded-xl border border-stone-200 bg-white p-3 hover:shadow-lg transition-shadow"
        >
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
            <img
              src={p.featuredImage?.url}
              alt={p.featuredImage?.altText ?? p.title}
              className="h-full w-full object-cover"
            />
          </div>

          <h2 className="mt-3 text-sm font-medium text-stone-800 line-clamp-2">
            {p.title}
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            {p.priceRange?.minVariantPrice?.amount}{" "}
            {p.priceRange?.minVariantPrice?.currencyCode}
          </p>
        </article>
      ))}
    </div>
  );
}