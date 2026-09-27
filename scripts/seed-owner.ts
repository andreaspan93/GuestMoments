import { auth } from "../src/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  DEFAULT_RETENTION_DAYS,
  PLATFORM_SETTINGS_ID,
} from "../src/lib/events/defaults";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || "Owner";

  if (!email || !password) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD are required");
  }

  if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        preferredLocale: "el",
      },
    });
  }

  await prisma.user.update({
    where: { email },
    data: {
      role: "OWNER",
      disabled: false,
      name,
    },
  });

  console.log(`Owner ready: ${email}`);

  await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      defaultRetentionDays: DEFAULT_RETENTION_DAYS,
      maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
    },
    update: {},
  });

  console.log("Platform settings ready");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
