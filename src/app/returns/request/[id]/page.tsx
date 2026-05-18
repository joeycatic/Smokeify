import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRefundRequestToken } from "@/lib/refundRequestLink";
import {
  getStorefrontEmailBrand,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";
import RefundRequestPortal from "./RefundRequestPortal";

const normalizeOptions = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const name = typeof entry?.name === "string" ? entry.name : "";
      const optionValue = typeof entry?.value === "string" ? entry.value : "";
      return name && optionValue ? { name, value: optionValue } : null;
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));
};

export default async function RefundRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; expires?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const expiresAt = query.expires ? Number(query.expires) : NaN;
  const hasValidToken =
    typeof query.token === "string" &&
    Number.isFinite(expiresAt) &&
    verifyRefundRequestToken(id, expiresAt, query.token);

  const session = hasValidToken ? null : await getServerSession(authOptions);
  if (!hasValidToken && !session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/returns/request/${id}`)}`);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      returnRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!order) {
    notFound();
  }

  if (!hasValidToken) {
    const isAdmin = session?.user?.role === "ADMIN";
    if (!isAdmin && order.userId !== session?.user?.id) {
      notFound();
    }
  }

  const storefront = resolveStorefrontEmailBrand(parseStorefront(order.sourceStorefront ?? null), [
    order.sourceOrigin,
    order.sourceHost,
  ]);
  const brand = getStorefrontEmailBrand(storefront);
  const latestRequest = order.returnRequests[0] ?? null;

  return (
    <PageLayout commerce>
      <div className="relative mx-auto max-w-6xl px-6 py-10 text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(245,158,11,0.12),transparent_26%),radial-gradient(circle_at_12%_88%,rgba(15,23,42,0.46),transparent_52%)]" />
        <div className="rounded-[36px] border border-white/10 bg-[#07111b]/92 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="max-w-3xl">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: brand.heroLabelColor }}
            >
              {brand.brandName}
            </p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-tight text-white">
              Refund request
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Submit your request directly on {brand.brandName}. This secure page is linked to the
              order referenced in the email you received.
            </p>
          </div>

          <div className="mt-8">
            <RefundRequestPortal
              orderId={order.id}
              orderNumber={order.orderNumber}
              storefrontName={brand.brandName}
              customerName={order.shippingName?.trim() || ""}
              customerEmail={order.customerEmail?.trim() || ""}
              token={hasValidToken ? query.token : undefined}
              expires={hasValidToken ? expiresAt : undefined}
              existingRequest={
                latestRequest
                  ? {
                      status: latestRequest.status,
                      adminNote: latestRequest.adminNote,
                    }
                  : null
              }
              items={order.items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                imageUrl: item.imageUrl,
                options: normalizeOptions(item.options),
              }))}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
