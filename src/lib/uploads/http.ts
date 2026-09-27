import { z } from "zod";
import { cookies } from "next/headers";
import { getStorage } from "@/lib/storage";
import { UploadError, uploadStatus } from "@/lib/uploads/errors";
import { guestTokenCookieName, guestTokenFromRequest } from "@/lib/uploads/policy";
import {
  completeBrandingUpload,
  completeGuestUpload,
  createBrandingIntent,
  createGuestUploadIntent,
} from "@/lib/uploads/service";
import { getRequestSession } from "@/lib/session";

const fileRequest = z.strictObject({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  contentLength: z.number().int().positive(),
  kind: z.enum(["original", "thumbnail"]),
  guestToken: z.string().optional(),
});

const completeRequest = z.strictObject({
  guestName: z.string().max(80).optional(),
  guestMessage: z.string().max(500).optional(),
  thumbnailIntentId: z.string().uuid().optional(),
  storageKey: z.string().optional(),
  guestToken: z.string().optional(),
});

const brandingRequest = z.strictObject({
  slot: z.enum(["cover", "logo", "background"]),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  contentLength: z.number().int().positive(),
  guestToken: z.string().optional(),
});

const brandingCompleteRequest = z.strictObject({
  storageKey: z.string().optional(),
  guestToken: z.string().optional(),
});

export function uploadJson(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function uploadErrorResponse(error: unknown) {
  if (error instanceof UploadError) {
    return uploadJson({ error: error.code }, uploadStatus(error.code));
  }

  if (error instanceof z.ZodError) {
    return uploadJson({ error: "type" }, 415);
  }

  throw error;
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || "local";
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function readGuestCookie(code: string) {
  const jar = await cookies();

  return jar.get(guestTokenCookieName(code))?.value;
}

export async function postGuestUpload(code: string, request: Request) {
  const body = fileRequest.parse(await readJson(request));
  const cookieToken = guestTokenFromRequest(
    await readGuestCookie(code),
    body.guestToken,
  );

  return createGuestUploadIntent({
    code,
    cookieToken,
    fileName: body.fileName,
    contentType: body.contentType,
    contentLength: BigInt(body.contentLength),
    kind: body.kind,
    storage: getStorage(),
    ip: clientIp(request),
  });
}

export async function postGuestComplete(
  code: string,
  intentId: string,
  request: Request,
) {
  const body = completeRequest.parse(await readJson(request));
  const cookieToken = guestTokenFromRequest(
    await readGuestCookie(code),
    body.guestToken,
  );

  return completeGuestUpload({
    code,
    intentId,
    cookieToken,
    claimedKey: body.storageKey,
    guestName: body.guestName ?? "",
    guestMessage: body.guestMessage ?? "",
    thumbnailIntentId: body.thumbnailIntentId,
    storage: getStorage(),
  });
}

export async function postBranding(eventId: string, request: Request) {
  const session = await getRequestSession();
  const body = brandingRequest.parse(await readJson(request));

  return createBrandingIntent({
    actor: session?.user ?? null,
    eventId,
    slot: body.slot,
    fileName: body.fileName,
    contentType: body.contentType,
    contentLength: BigInt(body.contentLength),
    storage: getStorage(),
  });
}

export async function postBrandingComplete(
  eventId: string,
  intentId: string,
  request: Request,
) {
  const session = await getRequestSession();
  const body = brandingCompleteRequest.parse(await readJson(request));

  return completeBrandingUpload({
    actor: session?.user ?? null,
    eventId,
    intentId,
    claimedKey: body.storageKey,
    storage: getStorage(),
  });
}
