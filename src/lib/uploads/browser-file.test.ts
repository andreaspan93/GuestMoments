import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareGuestUpload } from "@/lib/uploads/browser-file";
import { isJpegBytes } from "@/lib/uploads/image-prepare";

const heic = vi.hoisted(() => ({
  convert: async (): Promise<Blob | Blob[]> => {
    throw new Error("decode");
  },
}));

vi.mock("heic2any", () => ({
  default: () => heic.convert(),
}));

describe("browser upload files", () => {
  beforeEach(() => {
    heic.convert = async () => {
      throw new Error("decode");
    };
  });

  it("returns a video without changing its name or type", async () => {
    const file = new File([new Uint8Array([0, 0, 0])], "clip.mov", { type: "video/quicktime" });
    const result = await prepareGuestUpload(file);

    expect(result).toBe(file);
    expect(result.name).toBe("clip.mov");
    expect(result.type).toBe("video/quicktime");
    expect(result.size).toBe(file.size);
  });

  it("keeps the original photo when the browser cannot decode it", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "notes.png", { type: "image/png" });
    const result = await prepareGuestUpload(file);

    expect(result).toBe(file);
    expect(result.name).toBe("notes.png");
    expect(result.type).toBe("image/png");
  });

  it("does not rename an unsupported file", async () => {
    const file = new File([new Uint8Array([1])], "anim.gif", { type: "image/gif" });

    await expect(prepareGuestUpload(file)).resolves.toBe(file);
  });

  it("rejects an undecodable HEIC instead of uploading it as a jpeg", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "IMG.HEIC", { type: "image/heic" });

    await expect(prepareGuestUpload(file)).rejects.toThrow("type");
    expect(file.name).toBe("IMG.HEIC");
    expect(file.type).toBe("image/heic");
    expect(file.size).toBe(3);
  });

  it("uploads HEIC bytes only after they are jpeg data with a jpeg name", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    heic.convert = async () => new Blob([jpeg], { type: "image/jpeg" });
    const file = new File([new Uint8Array([9, 9, 9])], "IMG_0001.HEIC", { type: "image/heic" });
    const result = await prepareGuestUpload(file);
    const header = new Uint8Array(await result.slice(0, 3).arrayBuffer());

    expect(result).not.toBe(file);
    expect(result.name).toBe("IMG_0001.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(isJpegBytes(header)).toBe(true);
    expect(file.name).toBe("IMG_0001.HEIC");
    expect(file.size).toBe(3);
  });
});
