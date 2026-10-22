export type MediaDelivery = "library" | "download" | "cancelled";

type DeliverMediaDownloadInput = {
  url: string;
  fileName: string;
  mimeType: string;
  isPhone: boolean;
  fetchFile: () => Promise<Blob>;
  canShare: (file: File) => boolean;
  share: (file: File) => Promise<void>;
  saveDownload: (href: string) => void;
};

export function isPhoneDevice() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  const agent = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const mobile =
    agent.userAgentData?.mobile === true || /iPhone|iPad|Android/i.test(navigator.userAgent);
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  return mobile && coarse;
}

function libraryFileName(fileName: string, mimeType: string) {
  const base = fileName.split(/[/\\]/).pop()?.replace(/[^\w.\- ()]/g, "_").trim() ?? "";

  if (base && base !== "." && base !== "..") {
    return base.slice(0, 120);
  }

  if (mimeType === "image/png") {
    return "photo.png";
  }

  if (mimeType === "image/webp") {
    return "photo.webp";
  }

  if (mimeType === "video/mp4") {
    return "video.mp4";
  }

  if (mimeType === "video/quicktime") {
    return "video.mov";
  }

  return "photo.jpg";
}

export async function deliverMediaDownload(
  input: DeliverMediaDownloadInput,
): Promise<MediaDelivery> {
  if (!input.isPhone) {
    input.saveDownload(input.url);
    return "download";
  }

  try {
    const blob = await input.fetchFile();
    const file = new File([blob], libraryFileName(input.fileName, input.mimeType), {
      type: input.mimeType || blob.type || "application/octet-stream",
    });

    if (!input.canShare(file)) {
      input.saveDownload(input.url);
      return "download";
    }

    await input.share(file);
    return "library";
  } catch {
    return "cancelled";
  }
}
