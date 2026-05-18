import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { isMissingProcurementStorageError } from "@/lib/adminStorageGuards";
import {
  listAdminProcurementSuppliers,
  listAdminProcurementVariantOptions,
  listAdminPurchaseOrders,
} from "@/lib/adminProcurement";
import AdminProcurementClient from "./AdminProcurementClient";

export default async function AdminProcurementPage() {
  const session = await requireAdminScope("procurement.read");
  if (!session) notFound();

  let procurementStorageAvailable = true;
  let purchaseOrders: Awaited<ReturnType<typeof listAdminPurchaseOrders>> = [];
  let suppliers: Awaited<ReturnType<typeof listAdminProcurementSuppliers>> = [];
  let variantOptions: Awaited<ReturnType<typeof listAdminProcurementVariantOptions>> = [];

  try {
    [purchaseOrders, suppliers, variantOptions] = await Promise.all([
      listAdminPurchaseOrders(),
      listAdminProcurementSuppliers(),
      listAdminProcurementVariantOptions(),
    ]);
  } catch (error) {
    if (!isMissingProcurementStorageError(error)) {
      throw error;
    }

    procurementStorageAvailable = false;
    variantOptions = await listAdminProcurementVariantOptions();
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      {!procurementStorageAvailable ? (
        <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Procurement-Storage ist in der aktuellen Datenbank noch nicht verf&uuml;gbar.
          Purchase Orders, Receipts und der Event-Log bleiben leer, bis die fehlenden
          Procurement-Migrationen angewendet wurden.
        </div>
      ) : null}
      <AdminProcurementClient
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
        userRole={session.user.role}
        variantOptions={variantOptions}
      />
    </div>
  );
}
