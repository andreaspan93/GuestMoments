import { auth } from "../src/lib/auth";
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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
