import {
  patchCustomerAccess,
  postCustomerActivation,
  removeOwnerCustomer,
  respondOwner,
} from "@/lib/owner/http";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  return respondOwner(() => patchCustomerAccess(session?.user ?? null, id, body));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  return respondOwner(() => postCustomerActivation(session?.user ?? null, id, body));
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  return respondOwner(() => removeOwnerCustomer(session?.user ?? null, id, body));
}
