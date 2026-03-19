import { describe, expect, it } from "vitest";
import { detectImageFromBuffer } from "@/lib/uploadValidation";

describe("detectImageFromBuffer", () => {
  it("detects JPEG signatures", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageFromBuffer(buffer)).toEqual({
      format: "jpeg",
      mime: "image/jpeg",
      extension: ".jpg",
    });
  });

  it("detects PNG signatures", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageFromBuffer(buffer)).toEqual({
      format: "png",
      mime: "image/png",
      extension: ".png",
    });
  });

  it("detects WebP signatures", () => {
    const buffer = Buffer.from("52494646aabbccdd57454250", "hex");
    expect(detectImageFromBuffer(buffer)).toEqual({
      format: "webp",
      mime: "image/webp",
      extension: ".webp",
    });
  });

  it("rejects SVG and arbitrary text payloads", () => {
    const svgBuffer = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const textBuffer = Buffer.from("not an image");

    expect(detectImageFromBuffer(svgBuffer)).toBeNull();
    expect(detectImageFromBuffer(textBuffer)).toBeNull();
  });
});

