import { getProducts } from "./shopify";

type Props = {
  products?: any[];
  cols?: number;
};

export default function DisplayProducts({products, cols = 4,}: Props) {
    return (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products?.map((p) => (
            <article
                key={p.id}
                className="
                    group rounded-xl border border-stone-200 bg-white
                    transition overflow-hidden hover:shadow-lg hover:-translate-y-0.5
                "
                >
                {/* Image */}
                <div className="aspect-square overflow-hidden rounded-t-xl bg-stone-100">
                    <img
                    src={p.featuredImage?.url}
                    alt={p.featuredImage?.altText ?? p.title}
                    className="
                        h-full w-full object-cover
                        transition duration-300 group-hover:scale-105
                    "
                    />
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Vendor */}
                    <p className="text-xs uppercase tracking-wide text-stone-900">
                    {p.vendor}
                    </p>

                    {/* Title */}
                    <h2 className="mt-1 line-clamp-2 font-bold" style={{ color: '#196e41ff' }}>
                        {p.title}
                    </h2>

                    {/* Price */}
                    <p className="mt-2 text-base font-semibold text-stone-900">
                        {formatPrice(p.priceRange?.minVariantPrice)}
                    </p>
                </div>
                </article>

            ))}
        </div>
    );
}

function formatPrice(price?: {
  amount: string
  currencyCode: string
}) {
  if (!price) return null

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount))
}
