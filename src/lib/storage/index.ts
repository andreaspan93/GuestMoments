import { createLocalDiskStorage } from "@/lib/storage/local-disk";
import { createR2Storage, r2ConfigFromEnv } from "@/lib/storage/r2";
import type { IStorageService } from "@/lib/storage/types";

let cached: IStorageService | null = null;

export function getStorage(): IStorageService {
  if (cached) {
    return cached;
  }

  const r2 = r2ConfigFromEnv();

  if (r2) {
    cached = createR2Storage(r2);
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("R2 storage is not configured");
  }

  cached = createLocalDiskStorage();
  return cached;
}
