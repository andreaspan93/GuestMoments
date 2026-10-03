import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantCustomerService } from "@/lib/access";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { createCustomerEvent } from "@/lib/events/service";
import type { EventFormValues } from "@/lib/events/schema";
import {
  downloadCustomerMedia,
  downloadGuestMedia,
  listCustomerGallery,
  listGuestGallery,
  mediaTotals,
  mutateCustomerMedia,
} from "@/lib/gallery/service";
import { GalleryError } from "@/lib/gallery/errors";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { createGuestToken } from "@/lib/uploads/token";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase5-${randomUUID()}@example.com`;
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

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });
  await grantCustomerService(user.id);
  return user;
}

function form(name = "Gallery wedding"): EventFormValues {
  return {
    name,
    eventDate: "2027-08-01",
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
  readonly objects = new Set<string>();
  readonly gets: Array<{ key: string; downloadName?: string }> = [];

  async presignPut() {
    return {
      url: "memory://put",
      headers: { "Content-Type": "image/jpeg" },
    };
  }

  async presignGet(input: { key: string; expiresInSeconds: number; downloadName?: string }) {
    this.gets.push({ key: input.key, downloadName: input.downloadName });
    return `memory://${input.key}?name=${encodeURIComponent(input.downloadName ?? "")}`;
  }

  async headObject() {
    return null;
  }

  async deleteObject(key: string) {
    this.objects.delete(key);
  }

  async deletePrefix(prefix: string) {
    for (const key of this.objects) {
      if (key.startsWith(prefix)) {
        this.objects.delete(key);
      }
    }
  }
}

async function addMedia(
  eventId: string,
  guestToken: string,
  input: {
    name: string;
    type?: "PHOTO" | "VIDEO";
    hidden?: boolean;
    thumbnail?: boolean;
    createdAt?: Date;
    mimeType?: string;
  },
) {
  const id = randomUUID();
  const storageKey = `events/${eventId}/originals/${id}`;
  const thumbnailKey = input.thumbnail
    ? `events/${eventId}/thumbnails/${randomUUID()}`
    : null;

  await prisma.media.create({
    data: {
      id,
      eventId,
      storageKey,
      thumbnailKey,
      type: input.type ?? "PHOTO",
      originalFileName: input.name,
      size: BigInt(1024) * BigInt(1024),
      mimeType: input.mimeType ?? (input.type === "VIDEO" ? "video/mp4" : "image/jpeg"),
      guestToken,
      guestName: input.name,
      isHidden: input.hidden ?? false,
      createdAt: input.createdAt,
    },
  });

  return { id, storageKey, thumbnailKey };
}

describe("galleries", () => {
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

  it("shows each guest the right set, hides private files, and omits the guest token", async () => {
    const customer = await signUpCustomer("Gallery A");
    const event = await createCustomerEvent(customer, form());
    const storage = new MemoryStorage();
    const tokenA = createGuestToken();
    const tokenB = createGuestToken();
    const photoA = await addMedia(event.id, tokenA, {
      name: "a.jpg",
      thumbnail: true,
      createdAt: new Date("2027-01-02T00:00:00.000Z"),
    });
    const photoB = await addMedia(event.id, tokenB, {
      name: "b.jpg",
      createdAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    const hidden = await addMedia(event.id, tokenA, {
      name: "hidden.jpg",
      hidden: true,
      createdAt: new Date("2027-01-03T00:00:00.000Z"),
    });

    const fullA = await listGuestGallery(event.uniqueCode, tokenA, storage);
    const fullB = await listGuestGallery(event.uniqueCode, tokenB, storage);

    expect(fullA.map((item) => item.id)).toEqual([photoA.id, photoB.id]);
    expect(fullB.map((item) => item.id)).toEqual([photoA.id, photoB.id]);
    expect(fullA.some((item) => item.id === hidden.id)).toBe(false);
    expect(JSON.stringify(fullA)).not.toContain("guestToken");
    expect(JSON.stringify(fullA)).not.toContain(tokenA);
    expect(Object.keys(fullA[0] ?? {}).sort()).toEqual(
      [
        "createdAt",
        "guestMessage",
        "guestName",
        "id",
        "mimeType",
        "originalFileName",
        "playbackUrl",
        "previewUrl",
        "size",
        "type",
      ].sort(),
    );
    expect(fullA[0]?.previewUrl).toContain(photoA.thumbnailKey);
    expect(fullB[1]?.previewUrl).toContain(photoB.storageKey);

    await prisma.event.update({
      where: { id: event.id },
      data: { privacyMode: "OWN_UPLOADS" },
    });

    const ownA = await listGuestGallery(event.uniqueCode, tokenA, storage);
    const ownB = await listGuestGallery(event.uniqueCode, tokenB, storage);

    expect(ownA.map((item) => item.id)).toEqual([photoA.id]);
    expect(ownB.map((item) => item.id)).toEqual([photoB.id]);

    const couple = await listCustomerGallery(customer, event.id, "oldest", storage);

    expect(couple.map((item) => item.id)).toEqual([photoB.id, photoA.id, hidden.id]);
    expect(couple.find((item) => item.id === hidden.id)?.isHidden).toBe(true);
    expect(JSON.stringify(couple)).not.toContain("guestToken");

    const totals = await mediaTotals([event.id]);

    expect(totals.get(event.id)).toEqual({
      photos: 3,
      videos: 0,
      storageLabel: "3 MB",
    });
  });

  it("refuses another customer's download and guest moderation", async () => {
    const customerA = await signUpCustomer("Gallery owner");
    const customerB = await signUpCustomer("Gallery other");
    const eventA = await createCustomerEvent(customerA, form("Owned"));
    const eventB = await createCustomerEvent(customerB, form("Other"));
    const storage = new MemoryStorage();
    const token = createGuestToken();
    const media = await addMedia(eventA.id, token, { name: "../secret.jpg" });
    storage.objects.add(media.storageKey);

    await expect(
      downloadCustomerMedia(customerB, eventA.id, media.id, storage),
    ).rejects.toBeInstanceOf(GalleryError);
    await expect(
      downloadCustomerMedia(customerB, eventB.id, media.id, storage),
    ).rejects.toMatchObject({ code: "notFound" });

    const download = await downloadGuestMedia(eventA.uniqueCode, media.id, token, storage);

    expect(download.url).toContain(encodeURIComponent("secret.jpg"));
    expect(storage.gets.at(-1)?.downloadName).toBe("secret.jpg");

    await expect(
      mutateCustomerMedia(null, eventA.id, media.id, "hide", storage),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      mutateCustomerMedia(null, eventA.id, media.id, "favorite", storage),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      mutateCustomerMedia(null, eventA.id, media.id, "delete", storage),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      prisma.media.findUnique({ where: { id: media.id } }),
    ).resolves.toMatchObject({ isHidden: false, isFavorite: false });

    await mutateCustomerMedia(customerA, eventA.id, media.id, "hide", storage);
    await expect(
      listGuestGallery(eventA.uniqueCode, token, storage),
    ).resolves.toEqual([]);
    await mutateCustomerMedia(customerA, eventA.id, media.id, "delete", storage);

    expect(storage.objects.has(media.storageKey)).toBe(false);
    await expect(prisma.media.findUnique({ where: { id: media.id } })).resolves.toBeNull();
  });
});
