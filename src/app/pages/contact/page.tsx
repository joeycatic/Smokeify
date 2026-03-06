import PageLayout from "@/components/PageLayout";
import ContactPageClient from "./ContactPageClient";

export default function ContactPage() {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "contact@smokeify.de";
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";

  return (
    <PageLayout>
      <ContactPageClient
        contactEmail={contactEmail}
        contactPhone={contactPhone}
      />
    </PageLayout>
  );
}
