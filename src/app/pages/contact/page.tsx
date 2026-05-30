import { businessDetails } from "@/lib/businessDetails";
import ContactPageClient from "./ContactPageClient";

export default function ContactPage() {
  const { contactEmail, contactPhone, legalName } = businessDetails;

  return (
    <ContactPageClient
      contactEmail={contactEmail}
      contactPhone={contactPhone ?? ""}
      legalBusinessName={legalName}
    />
  );
}
