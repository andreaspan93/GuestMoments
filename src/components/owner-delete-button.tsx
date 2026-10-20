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
    <form className="w-full" action={deleteOwnerEventAction.bind(null, eventId)}>
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        onClick={(event) => {
          if (!window.confirm(confirm)) {
            event.preventDefault();
          }
        }}
      >
        {label}
      </Button>
    </form>
  );
}
