"use client";

import { Button } from "@/components/ui/button";
import { deleteEventAction } from "@/lib/events/actions";

export function DeleteEventButton({
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
      action={deleteEventAction.bind(null, eventId)}
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
