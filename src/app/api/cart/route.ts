import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  cartCreate,
  cartGet,
  cartLinesAdd,
  cartLinesRemove,
  cartLinesUpdate,
} from "@/lib/shopifyCart";

const COOKIE_NAME = "shopify_cart_id";

async function getOrCreateCartId() {
  const cookieStore = await cookies();
  let cartId = cookieStore.get(COOKIE_NAME)?.value;

  if (!cartId) {
    const cart = await cartCreate();
    cartId = cart.id;
    cookieStore.set(COOKIE_NAME, cartId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return cartId;
  }

  return cartId;
}

// GET /api/cart  -> returns cart
export async function GET() {
  const cartId = await getOrCreateCartId();
  const cart = await cartGet(cartId);

  // If cart expired/invalid, recreate
  if (!cart) {
    const newCart = await cartCreate();
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, newCart.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json(newCart);
  }

  return NextResponse.json(cart);
}

// POST /api/cart { action: "add"|"update"|"remove", ... }
export async function POST(req: Request) {
  const cartId = await getOrCreateCartId();
  const body = await req.json();

  const action = body?.action as string;

  try {
    if (action === "add") {
      const { variantId, quantity } = body;
      const cart = await cartLinesAdd(cartId, variantId, Number(quantity ?? 1));
      return NextResponse.json(cart);
    }

    if (action === "update") {
      const { lineId, quantity } = body;
      const cart = await cartLinesUpdate(cartId, lineId, Number(quantity));
      return NextResponse.json(cart);
    }

    if (action === "remove") {
      const { lineIds } = body;
      const cart = await cartLinesRemove(cartId, Array.isArray(lineIds) ? lineIds : []);
      return NextResponse.json(cart);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Cart error" }, { status: 500 });
  }
}