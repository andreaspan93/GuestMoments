import { getStorage } from "@/lib/storage";

export async function signedObjectUrl(key: string | null) {
  if (!key) {
    return null;
  }

  try {
    return await getStorage().presignGet({
      key,
      expiresInSeconds: 60 * 60,
    });
  } catch {
    return null;
  }
}
