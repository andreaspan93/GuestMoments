import { describe, expect, it } from "vitest";
import { deliverMediaDownload } from "@/lib/gallery/photo-library";

function fileInput(overrides: Partial<Parameters<typeof deliverMediaDownload>[0]> = {}) {
  return {
    url: "https://files.example/photo.jpg",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    isPhone: true,
    fetchFile: async () => new Blob(["image"], { type: "image/jpeg" }),
    canShare: () => true,
    share: async () => undefined,
    saveDownload: () => undefined,
    ...overrides,
  };
}

describe("phone photo library download", () => {
  it("saves through the phone prompt and does not use the downloads folder", async () => {
    const saved: string[] = [];
    let shared: File | null = null;
    const outcome = await deliverMediaDownload(
      fileInput({
        fileName: "folder/moment.jpg",
        saveDownload: (href) => saved.push(href),
        share: async (file) => {
          shared = file;
        },
      }),
    );

    expect(outcome).toBe("library");
    expect(saved).toEqual([]);
    expect(shared?.name).toBe("moment.jpg");
    expect(shared?.type).toBe("image/jpeg");
  });

  it("cancels when the person declines the phone prompt", async () => {
    const saved: string[] = [];
    const outcome = await deliverMediaDownload(
      fileInput({
        saveDownload: (href) => saved.push(href),
        share: async () => {
          throw Object.assign(new Error("cancel"), { name: "AbortError" });
        },
      }),
    );

    expect(outcome).toBe("cancelled");
    expect(saved).toEqual([]);
  });

  it("keeps the computer download when the device is not a phone", async () => {
    let fetched = false;
    const saved: string[] = [];
    const outcome = await deliverMediaDownload(
      fileInput({
        isPhone: false,
        fetchFile: async () => {
          fetched = true;
          return new Blob(["image"]);
        },
        saveDownload: (href) => saved.push(href),
      }),
    );

    expect(outcome).toBe("download");
    expect(fetched).toBe(false);
    expect(saved).toEqual(["https://files.example/photo.jpg"]);
  });
});
