import PageLayout from "@/components/PageLayout";

export default function RueckgabePage() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
          Rueckgabe
        </h1>
        <div className="rounded-md border border-black/10 bg-white p-6 text-sm text-stone-700">
          <div className="space-y-5 leading-relaxed">
            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                30-day return policy
              </h2>
              <p className="mt-2">
                You have 30 days after receiving your item to request a return.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                Eligibility
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Item must be in the same condition received.</li>
                <li>Unworn or unused, with tags and original packaging.</li>
                <li>Receipt or proof of purchase required.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                Start a return
              </h2>
              <p className="mt-2">
                Contact us at joeybennett3804@gmail.com to request a return.
              </p>
              <p className="mt-2">
                Returns must be sent to: [INSERT RETURN ADDRESS]
              </p>
              <p className="mt-2">
                If accepted, we will send a return shipping label and
                instructions. Items sent back without approval will not be
                accepted.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                Damages and issues
              </h2>
              <p className="mt-2">
                Please inspect your order upon reception and contact us
                immediately if the item is defective, damaged, or incorrect.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                Exceptions / non-returnable items
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Perishable goods (food, flowers, or plants).</li>
                <li>Custom products (special orders or personalized items).</li>
                <li>Personal care goods (beauty products).</li>
                <li>Hazardous materials, flammable liquids, or gases.</li>
                <li>Sale items and gift cards.</li>
              </ul>
              <p className="mt-2">
                If you have questions about a specific item, contact us at
                joeybennett3804@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">Exchanges</h2>
              <p className="mt-2">
                Return the item you have, and place a new order once your return
                is accepted.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">
                European Union 14-day cooling off period
              </h2>
              <p className="mt-2">
                If your order is shipped to the EU, you can cancel or return it
                within 14 days for any reason. Items must be unused, with tags,
                in original packaging, and include proof of purchase.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-stone-900">Refunds</h2>
              <p className="mt-2">
                We will notify you once we receive and inspect your return. If
                approved, refunds are issued to the original payment method
                within 10 business days.
              </p>
              <p className="mt-2">
                If more than 15 business days have passed since approval,
                contact us at joeybennett3804@gmail.com.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
