import { describe, expect, it } from "vitest";
import { classifyUpload } from "@/lib/uploads/policy";
import {
  JPEG_QUALITY,
  MAX_IMAGE_EDGE,
  drawSize,
  effectiveOrientation,
  imageHasTransparency,
  isBrowserRaster,
  isHeicFile,
  isJpegBytes,
  isVideoFile,
  jpegFileName,
  orientationMatrix,
  outputPixelSize,
  readJpegMetadata,
} from "@/lib/uploads/image-prepare";

function marker(type: number, payload: Uint8Array) {
  const bytes = new Uint8Array(4 + payload.length);
  const length = payload.length + 2;
  bytes[0] = 0xff;
  bytes[1] = type;
  bytes[2] = length >> 8;
  bytes[3] = length & 0xff;
  bytes.set(payload, 4);

  return bytes;
}

function exifPayload(endian: "MM" | "II", orientation: number) {
  const little = endian === "II";
  const u16 = (value: number) =>
    little ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff];
  const u32 = (value: number) =>
    little
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
      : [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const tiff = [
    ...endian.split("").map((char) => char.charCodeAt(0)),
    ...u16(0x002a),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0),
  ];

  return new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
}

function jpegWithOrientation(endian: "MM" | "II", orientation: number, width: number, height: number) {
  const sof = marker(0xc0, new Uint8Array([8, height >> 8, height & 0xff, width >> 8, width & 0xff]));
  const app1 = marker(0xe1, exifPayload(endian, orientation));
  const bytes = new Uint8Array(2 + app1.length + sof.length + 2);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes.set(app1, 2);
  bytes.set(sof, 2 + app1.length);
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;

  return bytes;
}

describe("guest photo preparation", () => {
  it("uses 80% jpeg quality and keeps a 12 MP photo at its own size", () => {
    expect(JPEG_QUALITY).toBe(0.8);
    expect(MAX_IMAGE_EDGE).toBe(4096);
    expect(outputPixelSize(4032, 3024, 1)).toEqual({ width: 4032, height: 3024, scale: 1 });
    expect(outputPixelSize(4032, 3024, 6)).toEqual({ width: 3024, height: 4032, scale: 1 });
  });

  it("shrinks a larger camera file so the long side is 4096", () => {
    expect(outputPixelSize(8064, 6048, 1)).toEqual({ width: 4096, height: 3072, scale: 4096 / 8064 });
    expect(drawSize(8064, 6048, 4096 / 8064)).toEqual({ width: 4096, height: 3072 });
  });

  it("turns a stored landscape iPhone photo upright", () => {
    const bytes = jpegWithOrientation("MM", 6, 4032, 3024);
    const metadata = readJpegMetadata(bytes);

    expect(metadata).toEqual({ orientation: 6, width: 4032, height: 3024 });
    expect(effectiveOrientation(metadata, 4032, 3024, true)).toBe(6);
    expect(effectiveOrientation(metadata, 3024, 4032, true)).toBe(1);
    expect(outputPixelSize(metadata.width ?? 0, metadata.height ?? 0, 6)).toEqual({
      width: 3024,
      height: 4032,
      scale: 1,
    });

    const [a, b, c, d, e, f] = orientationMatrix(6, 3024, 4032);
    const sourceX = 0;
    const sourceY = 3024;
    expect(a * sourceX + c * sourceY + e).toBe(0);
    expect(b * sourceX + d * sourceY + f).toBe(0);
  });

  it("reads a little-endian orientation tag", () => {
    expect(readJpegMetadata(jpegWithOrientation("II", 8, 100, 200))).toMatchObject({
      orientation: 8,
      width: 100,
      height: 200,
    });
    expect(readJpegMetadata(new Uint8Array([1, 2, 3, 4])).orientation).toBe(1);
  });

  it("names the converted file as a jpeg the server can accept", () => {
    expect(jpegFileName("IMG_0001.HEIC")).toBe("IMG_0001.jpg");
    expect(jpegFileName("photo.PNG")).toBe("photo.jpg");
    expect(jpegFileName("my.photo.webp")).toBe("my.photo.jpg");
    expect(classifyUpload("image/jpeg", jpegFileName("IMG_0001.HEIC"))).toBe("photo");
    expect(classifyUpload("image/heic", "IMG_0001.heic")).toBeNull();
    expect(isJpegBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpegBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("leaves videos and transparent pixels on their original path", () => {
    expect(isVideoFile({ type: "video/mp4", name: "clip.mp4" })).toBe(true);
    expect(isVideoFile({ type: "", name: "clip.mov" })).toBe(true);
    expect(isVideoFile({ type: "image/jpeg", name: "photo.jpg" })).toBe(false);
    expect(isHeicFile({ type: "", name: "IMG.HEIF" })).toBe(true);
    expect(isBrowserRaster({ type: "image/webp", name: "a.webp" })).toBe(true);
    expect(isBrowserRaster({ type: "image/gif", name: "a.gif" })).toBe(false);
    expect(imageHasTransparency(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 128]))).toBe(true);
    expect(imageHasTransparency(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]))).toBe(false);
  });
});
