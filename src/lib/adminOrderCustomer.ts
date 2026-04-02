type OrderCustomerShape = {
  customerEmail: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  user?: { email: string | null; name: string | null } | null;
};

const normalizeCustomerValue = (value?: string | null) => value?.trim() ?? "";

export const getOrderCustomerEmail = (order: OrderCustomerShape) =>
  normalizeCustomerValue(order.user?.email) || normalizeCustomerValue(order.customerEmail);

export const buildOrderCustomerCopyText = (order: OrderCustomerShape) => {
  const lines: string[] = [];
  const pushUnique = (value?: string | null) => {
    const normalizedValue = normalizeCustomerValue(value);
    if (!normalizedValue || lines.includes(normalizedValue)) return;
    lines.push(normalizedValue);
  };

  pushUnique(order.user?.name);
  pushUnique(order.shippingName);
  pushUnique(getOrderCustomerEmail(order));
  pushUnique(order.shippingLine1);
  pushUnique(order.shippingLine2);
  pushUnique(
    [normalizeCustomerValue(order.shippingPostalCode), normalizeCustomerValue(order.shippingCity)]
      .filter(Boolean)
      .join(" "),
  );
  pushUnique(order.shippingCountry);

  return lines.join("\n");
};
