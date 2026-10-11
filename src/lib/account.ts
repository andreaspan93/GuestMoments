import { IdentityError, accountUpdateSchema } from "@/lib/identity-schema";
import { prisma } from "@/lib/prisma";

type AccountUpdate = {
  userId: string;
  name: string;
  surname: string;
};

export async function applyAccountUpdate({ userId, name, surname }: AccountUpdate) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      disabled: true,
    },
  });

  if (!user || user.disabled) {
    throw new IdentityError("sessionExpired");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      surname,
    },
  });
}

export async function applyAccountUpdateFromInput(userId: string, input: unknown) {
  const parsed = accountUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new IdentityError("invalid");
  }

  await applyAccountUpdate({
    userId,
    name: parsed.data.name,
    surname: parsed.data.surname,
  });
}
