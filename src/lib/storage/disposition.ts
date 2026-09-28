import { sanitizeFileName } from "@/lib/uploads/policy";

export function attachmentDisposition(fileName: string) {
  const safe = sanitizeFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
