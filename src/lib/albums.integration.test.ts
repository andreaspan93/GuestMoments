import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { createCustomerEvent } from "@/lib/events/service";
import type { EventFormValues } from "@/lib/events/schema";
import { GalleryError } from "@/lib/gallery/errors";
import {
  assignCustomerMediaAlbum,
  createCustomerAlbum,
  deleteCustomerAlbum,
  prepareBulkDownload,
  renameCustomerAlbum,
} from "@/lib/gallery/service";
import { BULK_DOWNLOAD_MAX_BYTES } from "@/lib/gallery/present";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { createGuestToken } from "@/lib/uploads/token";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase6-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

async function signUpCustomer(name: string) {
  const email = emailAddress();
  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: "password123",
      preferredLocale: "el",
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });
}

function form(name: string): EventFormValues {
  return {
    name,
    eventDate: "2027-09-01",
    welcomeMessageEl: "Καλώς ήρθατε",
    welcomeMessageEn: "",
    uploadInstructionsEl: "",
    uploadInstructionsEn: "",
    backgroundColor: "#f7f1ea",
    accentColor: "#8c3d32",
    privacyMode: "FULL_GALLERY",
    status: "ACTIVE",
  };
}

class MemoryStorage implements IStorageService {
  readonly gets: Array<{ key: string; downloadName?: string }> = [];

  async presignPut() {
    return { url: "memory://put", headers: { "Content-Type": "image/jpeg" } };
  }

  async presignGet(input: { key: string; expiresInSeconds: number; downloadName?: string }) {
    this.gets.push({ key: input.key, downloadName: input.downloadName });
    return `memory://${input.key}`;
  }

  async headObject() {
    return null;
  }

  async deleteObject() {}

  async deletePrefix() {}
}

async function addMedia(eventId: string, name: string, size: bigint) {
  const id = randomUUID();

  await prisma.media.create({
    data: {
      id,
      eventId,
      storageKey: `events/${eventId}/originals/${id}`,
      type: "PHOTO",
      originalFileName: name,
      size,
      mimeType: "image/jpeg",
      guestToken: createGuestToken(),
    },
  });

  return id;
}

describe("albums and bulk download", () => {
  beforeAll(async () => {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: {
        id: PLATFORM_SETTINGS_ID,
        defaultRetentionDays: 90,
        maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
        maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
        defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
      },
      update: {
        maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
        maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);

    await prisma.event.deleteMany({
      where: { customerId: { in: ids } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  });

  it("keeps a photo in one album and clears it when the album is deleted", async () => {
    const customer = await signUpCustomer("Album owner");
    const event = await createCustomerEvent(customer, form("Album wedding"));
    const mediaId = await addMedia(event.id, "guest.jpg", BigInt(1000));
    const ceremony = await createCustomerAlbum(customer, event.id, "Ceremony");
    const portraits = await createCustomerAlbum(customer, event.id, "Portraits");

    await assignCustomerMediaAlbum(customer, event.id, mediaId, ceremony.id);
    await assignCustomerMediaAlbum(customer, event.id, mediaId, portraits.id);
    await expect(prisma.media.findUnique({ where: { id: mediaId } })).resolves.toMatchObject({
      albumId: portraits.id,
    });

    const renamed = await renameCustomerAlbum(customer, event.id, portraits.id, "Family");

    expect(renamed.name).toBe("Family");
    await deleteCustomerAlbum(customer, event.id, portraits.id);
    await expect(prisma.media.findUnique({ where: { id: mediaId } })).resolves.toMatchObject({
      albumId: null,
    });
    await expect(createCustomerAlbum(null, event.id, "Guest")).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("rejects another event's album and a selection over 200 MB before signing downloads", async () => {
    const owner = await signUpCustomer("Zip owner");
    const other = await signUpCustomer("Zip other");
    const event = await createCustomerEvent(owner, form("Zip wedding"));
    const otherEvent = await createCustomerEvent(other, form("Other wedding"));
    const storage = new MemoryStorage();
    const photo = await addMedia(event.id, "a.jpg", BigInt(1024));
    const otherAlbum = await createCustomerAlbum(other, otherEvent.id, "Theirs");

    await expect(
      assignCustomerMediaAlbum(owner, event.id, photo, otherAlbum.id),
    ).rejects.toBeInstanceOf(GalleryError);
    await expect(prisma.media.findUnique({ where: { id: photo } })).resolves.toMatchObject({
      albumId: null,
    });

    const largeA = await addMedia(event.id, "large-a.jpg", BULK_DOWNLOAD_MAX_BYTES);
    const largeB = await addMedia(event.id, "large-b.jpg", BigInt(1));

    await expect(
      prepareBulkDownload(owner, event.id, [largeA, largeB], storage),
    ).rejects.toMatchObject({ code: "oversize" });
    expect(storage.gets).toEqual([]);

    const small = await prepareBulkDownload(owner, event.id, [photo], storage);

    expect(small.files).toHaveLength(1);
    expect(small.files[0]?.name).toBe("a.jpg");
    expect(storage.gets).toHaveLength(1);
    await expect(prepareBulkDownload(null, event.id, [photo], storage)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });
});
