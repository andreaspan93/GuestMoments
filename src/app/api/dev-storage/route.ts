import { Readable } from "node:stream";
import { r2ConfigFromEnv } from "@/lib/storage/r2";
import {
  readSignedContentType,
  readSignedObject,
  writeSignedObject,
} from "@/lib/storage/local-disk";
import { storageSignature, storageSignatureMatches } from "@/lib/storage/signature";
import { isStorageKey } from "@/lib/uploads/policy";

export const runtime = "nodejs";

function unavailable() {
  return new Response(null, { status: 404 });
}

function signedRequest(url: URL, method: "PUT" | "GET") {
  if (process.env.NODE_ENV === "production" || r2ConfigFromEnv()) {
    return null;
  }

  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    return null;
  }

  const key = url.searchParams.get("key") ?? "";
  const contentType = url.searchParams.get("contentType") ?? "";
  const contentLength = url.searchParams.get("contentLength") ?? "";
  const expiresAt = Number(url.searchParams.get("expiresAt"));
  const provided = url.searchParams.get("signature");

  if (
    url.searchParams.get("method") !== method ||
    !isStorageKey(key) ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now()
  ) {
    return null;
  }

  const expected = storageSignature({
    method,
    key,
    contentType,
    contentLength,
    expiresAt,
    secret,
  });

  if (!storageSignatureMatches(expected, provided)) {
    return null;
  }

  return { key, contentType, contentLength: Number(contentLength) };
}

export async function PUT(request: Request) {
  const signed = signedRequest(new URL(request.url), "PUT");

  if (!signed) {
    return unavailable();
  }

  const headerType = request.headers.get("content-type")?.split(";")[0]?.trim();

  if (headerType !== signed.contentType) {
    return new Response(null, { status: 403 });
  }

  const headerLength = request.headers.get("content-length");

  if (headerLength && Number(headerLength) !== signed.contentLength) {
    return new Response(null, { status: 403 });
  }

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    await writeSignedObject(
      signed.key,
      Readable.from(Buffer.from(bytes)),
      signed.contentLength,
      signed.contentType,
    );
  } catch {
    return new Response(null, { status: 400 });
  }

  return new Response(null, { status: 200 });
}

export async function GET(request: Request) {
  const signed = signedRequest(new URL(request.url), "GET");

  if (!signed) {
    return unavailable();
  }

  try {
    const bytes = await readSignedObject(signed.key);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": await readSignedContentType(signed.key),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return unavailable();
  }
}
