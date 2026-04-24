import { UserRole } from "@prisma/client";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { hasAdminScope } from "@/lib/adminPermissions";
import { prisma } from "@/lib/prisma";

type SearchResult = {
  group: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

const RESULT_LIMIT = 6;

const formatUserLabel = (user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) => {
  const fullName =
    user.name?.trim() ||
    [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ").trim();
  return fullName || user.email || "Unknown user";
};

export const GET = withAdminRoute(async ({ request, session }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return adminJson({ results: [] satisfies SearchResult[] });
  }

  const numericQuery = Number(query);
  const isNumericQuery = Number.isFinite(numericQuery);
  const role = session.user.role;
  const results: SearchResult[] = [];

  if (hasAdminScope(role, "orders.read")) {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { customerEmail: { contains: query, mode: "insensitive" } },
          { shippingName: { contains: query, mode: "insensitive" } },
          ...(isNumericQuery ? [{ orderNumber: Math.floor(numericQuery) }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        shippingName: true,
        status: true,
      },
    });

    results.push(
      ...orders.map((order) => ({
        group: "Orders",
        id: order.id,
        title: `Order #${order.orderNumber}`,
        subtitle: order.customerEmail || order.shippingName || "No customer label",
        href: `/admin/orders/${order.id}`,
        badge: order.status,
      })),
    );
  }

  if (hasAdminScope(role, "customers.read")) {
    const customers = await prisma.user.findMany({
      where: {
        role: UserRole.USER,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        customerGroup: true,
      },
    });

    results.push(
      ...customers.map((customer) => {
        const title = formatUserLabel(customer);
        const queryValue = customer.email || title;
        return {
          group: "Customers",
          id: customer.id,
          title,
          subtitle: customer.email || "No email",
          href: `/admin/customers?query=${encodeURIComponent(queryValue)}`,
          badge: customer.customerGroup,
        };
      }),
    );
  }

  if (hasAdminScope(role, "catalog.read")) {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { handle: { contains: query, mode: "insensitive" } },
          { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        title: true,
        handle: true,
        status: true,
      },
    });

    results.push(
      ...products.map((product) => ({
        group: "Products",
        id: product.id,
        title: product.title,
        subtitle: product.handle,
        href: `/admin/catalog/${product.id}`,
        badge: product.status,
      })),
    );
  }

  if (hasAdminScope(role, "users.manage")) {
    const users = await prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    results.push(
      ...users.map((user) => ({
        group: "Users",
        id: user.id,
        title: formatUserLabel(user),
        subtitle: user.email || "No email",
        href: `/admin/users/${user.id}`,
        badge: user.role,
      })),
    );
  }

  if (hasAdminScope(role, "suppliers.read")) {
    const suppliers = await prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        name: true,
        email: true,
        contactName: true,
      },
    });

    results.push(
      ...suppliers.map((supplier) => ({
        group: "Suppliers",
        id: supplier.id,
        title: supplier.name,
        subtitle: supplier.email || supplier.contactName || "No primary contact",
        href: `/admin/suppliers?query=${encodeURIComponent(supplier.name)}`,
      })),
    );
  }

  if (hasAdminScope(role, "procurement.read")) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { supplier: { name: { contains: query, mode: "insensitive" } } },
          ...(isNumericQuery ? [{ purchaseOrderNumber: Math.floor(numericQuery) }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        purchaseOrderNumber: true,
        status: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });

    results.push(
      ...purchaseOrders.map((purchaseOrder) => ({
        group: "Purchase Orders",
        id: purchaseOrder.id,
        title: `PO #${purchaseOrder.purchaseOrderNumber}`,
        subtitle: purchaseOrder.supplier.name,
        href: `/admin/procurement/${purchaseOrder.id}`,
        badge: purchaseOrder.status,
      })),
    );
  }

  return adminJson({ results });
});
