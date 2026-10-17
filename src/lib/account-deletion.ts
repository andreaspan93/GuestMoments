import "server-only";
import { ownAccountDeletionAllowed } from "@/lib/account-deletion-policy";
import { IdentityError } from "@/lib/identity-schema";
import { eraseCustomerAccount } from "@/lib/owner/service";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";

export { ownAccountDeletionAllowed };

export async function deleteOwnAccount(
  userId: string,
  confirmEmail: string,
  storage?: IStorageService,
) {
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!customer || !ownAccountDeletionAllowed({ ...customer, confirmEmail })) {
    throw new IdentityError(customer?.role === "CUSTOMER" ? "confirmEmail" : "forbidden");
  }

  await eraseCustomerAccount(customer, storage, { actorType: "customer" });
}
