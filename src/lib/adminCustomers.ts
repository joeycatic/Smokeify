export type CustomerSegment =
  | "new"
  | "repeat"
  | "high_value"
  | "churn_risk"
  | "discount_driven"
  | "return_risk"
  | "vip";

export type CustomerTab = "all" | "registered" | "guest";

export type BaseCustomer = {
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  refundedCents: number;
  netRevenueCents: number;
  aovCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  discountOrderCount: number;
  returnCount: number;
  openOrderCount: number;
  openReturnCount: number;
  segments: CustomerSegment[];
};

export type RegisteredCustomer = BaseCustomer & {
  type: "registered";
  id: string;
  joinedAt: string;
  newsletterOptIn: boolean;
  loyaltyPointsBalance: number;
  storeCreditBalance: number;
  customerGroup: string | null;
  notes: string | null;
  crmFlags: string[];
};

export type GuestCustomer = BaseCustomer & {
  type: "guest";
};

export type Customer = RegisteredCustomer | GuestCustomer;

export type CustomerSummary = {
  totalCustomers: number;
  totalNetRevenueCents: number;
  vipCustomers: number;
  churnRiskCustomers: number;
  discountDrivenCustomers: number;
  averageClvCents: number;
  segmentBars: Array<{ label: string; value: number }>;
  topCustomers: Customer[];
  atRiskCustomers: Customer[];
};

export type CustomerCohort = {
  id: string;
  name: string;
  description: string | null;
  customerCount: number;
  filters: {
    q?: string;
    tab?: CustomerTab;
    segment?: CustomerSegment | "all";
  };
  createdByEmail: string | null;
  assigneeUserId?: string | null;
  assigneeEmail?: string | null;
  status?: "ENTWURF" | "AKTIV" | "IN_BEARBEITUNG" | "ABGESCHLOSSEN";
  createdAt: string;
  updatedAt: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const CLOSED_ORDER_STATUSES = new Set(["fulfilled", "refunded", "canceled", "cancelled", "failed"]);
const OPEN_RETURN_STATUSES = new Set(["PENDING", "APPROVED", "RECEIVED"]);

export const CUSTOMER_SEGMENTS: CustomerSegment[] = [
  "new",
  "repeat",
  "high_value",
  "churn_risk",
  "discount_driven",
  "return_risk",
  "vip",
];

export function buildCustomerSegments({
  firstOrderAt,
  lastOrderAt,
  orderCount,
  totalSpentCents,
  discountOrderCount,
  returnCount,
  customerGroup,
}: {
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  orderCount: number;
  totalSpentCents: number;
  discountOrderCount: number;
  returnCount: number;
  customerGroup?: string | null;
}) {
  const now = Date.now();
  const segments = new Set<CustomerSegment>();
  if (orderCount >= 2) segments.add("repeat");
  if (totalSpentCents >= 50_000) segments.add("high_value");
  if (customerGroup === "VIP" || totalSpentCents >= 100_000) segments.add("vip");
  if (firstOrderAt && now - firstOrderAt.getTime() <= THIRTY_DAYS_MS) segments.add("new");
  if (lastOrderAt && orderCount >= 2 && now - lastOrderAt.getTime() >= NINETY_DAYS_MS) {
    segments.add("churn_risk");
  }
  if (orderCount > 0 && discountOrderCount / orderCount >= 0.5) segments.add("discount_driven");
  if (orderCount > 0 && returnCount / orderCount >= 0.25) segments.add("return_risk");
  return Array.from(segments);
}

export function getCustomerSegmentScore(customer: Customer) {
  let score = 0;
  if (customer.segments.includes("vip")) score += 4;
  if (customer.segments.includes("high_value")) score += 3;
  if (customer.segments.includes("churn_risk")) score += 2;
  if (customer.segments.includes("return_risk")) score += 2;
  if (customer.segments.includes("discount_driven")) score += 1;
  return score;
}

export function sortCustomers(customers: Customer[]) {
  return [...customers].sort((left, right) => {
    const dateDiff =
      new Date(right.lastOrderAt ?? 0).getTime() -
      new Date(left.lastOrderAt ?? 0).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (right.netRevenueCents !== left.netRevenueCents) {
      return right.netRevenueCents - left.netRevenueCents;
    }
    return getCustomerSegmentScore(right) - getCustomerSegmentScore(left);
  });
}

export function getCustomerKey(customer: Customer | null) {
  if (!customer) return "";
  return customer.type === "registered" ? customer.id : `guest:${customer.email.toLowerCase()}`;
}

export function isClosedOrderStatus(status: string | null | undefined) {
  return CLOSED_ORDER_STATUSES.has((status ?? "").trim().toLowerCase());
}

export function isOpenReturnStatus(status: string | null | undefined) {
  return OPEN_RETURN_STATUSES.has((status ?? "").trim().toUpperCase());
}
