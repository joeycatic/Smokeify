export const ADMIN_INVENTORY_REASON_CODES = [
  "MANUAL_RECOUNT",
  "DAMAGE_WRITE_OFF",
  "WAREHOUSE_CORRECTION",
  "SUPPLIER_CORRECTION",
  "ADMIN_SET_ON_HAND",
] as const;

export type AdminInventoryReasonCode = (typeof ADMIN_INVENTORY_REASON_CODES)[number];
export type AdminInventoryAdjustmentMode = "delta" | "set_on_hand";

export const ADMIN_INVENTORY_REASON_LABELS: Record<AdminInventoryReasonCode, string> = {
  MANUAL_RECOUNT: "Manual recount",
  DAMAGE_WRITE_OFF: "Damage write-off",
  WAREHOUSE_CORRECTION: "Warehouse correction",
  SUPPLIER_CORRECTION: "Supplier correction",
  ADMIN_SET_ON_HAND: "Admin set on hand",
};

export function isAdminInventoryReasonCode(value: unknown): value is AdminInventoryReasonCode {
  return (
    typeof value === "string" &&
    ADMIN_INVENTORY_REASON_CODES.includes(value as AdminInventoryReasonCode)
  );
}
