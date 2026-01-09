import PageLayout from "@/components/PageLayout";

export default function ShippingPage() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
          Versand
        </h1>
        <div className="rounded-md border border-black/10 bg-white p-6 text-sm text-stone-700">
          <div className="space-y-5 leading-relaxed">
            <p></p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
