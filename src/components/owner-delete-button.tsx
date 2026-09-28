"use client";

import { Button } from "@/components/ui/button";
import { deleteOwnerEventAction } from "@/lib/owner/actions";

export function OwnerDeleteButton({
  eventId,
  label,
  confirm,
}: {
  eventId: string;
  label: string;
  confirm: string;
}) {
  return (
    <form
      action={deleteOwnerEventAction.bind(null, eventId)}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="outline">
        {label}
      </Button>
    </form>
  );
}
