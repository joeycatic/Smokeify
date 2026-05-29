export const MERCHANT_ATTRIBUTE_ID_MAX_LENGTH = 50;

const leftRotate = (value: number, shift: number) =>
  ((value << shift) | (value >>> (32 - shift))) >>> 0;

const sha1Hex = (value: string) => {
  const source = new TextEncoder().encode(value);
  const bitLength = source.length * 8;
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLength);
  const view = new DataView(buffer.buffer);

  buffer.set(source);
  buffer[source.length] = 0x80;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const words = new Uint32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] = view.getUint32(offset + i * 4);
    }

    for (let i = 16; i < 80; i += 1) {
      words[i] = leftRotate(
        words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16],
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f = 0;
      let k = 0;

      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (leftRotate(a, 5) + f + e + k + words[i]) >>> 0;
      e = d;
      d = c;
      c = leftRotate(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4]
    .map((part) => part.toString(16).padStart(8, "0"))
    .join("");
};

const hashIdentifier = (value: string, prefix: string) => {
  const normalizedPrefix = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefixValue = normalizedPrefix ? `${normalizedPrefix}-` : "";
  const digest = sha1Hex(value);
  const maxDigestLength = Math.max(
    8,
    MERCHANT_ATTRIBUTE_ID_MAX_LENGTH - prefixValue.length,
  );

  return `${prefixValue}${digest.slice(0, maxDigestLength)}`;
};

const normalizeMerchantIdentifier = (
  value: string,
  fallbackPrefix: string,
) => {
  const normalized = value.trim();
  if (!normalized) {
    return hashIdentifier(fallbackPrefix, fallbackPrefix);
  }

  if (normalized.length <= MERCHANT_ATTRIBUTE_ID_MAX_LENGTH) {
    return normalized;
  }

  return hashIdentifier(normalized, fallbackPrefix);
};

export const buildMerchantItemId = (variantId: string) =>
  normalizeMerchantIdentifier(variantId, "variant");

export const buildMerchantItemGroupId = (productId: string) =>
  normalizeMerchantIdentifier(productId, "product");

