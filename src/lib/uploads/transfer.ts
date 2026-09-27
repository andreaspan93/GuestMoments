export function putBytes(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (ratio: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(String(xhr.status)));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

export async function putBytesWithRetry(
  url: string,
  body: Blob,
  contentType: string,
  attempts: number,
  onProgress: (ratio: number) => void,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await putBytes(url, body, contentType, onProgress);
      return;
    } catch (error) {
      lastError = error;

      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
