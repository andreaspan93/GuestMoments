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
    <form className="w-full" action={deleteEventAction.bind(null, eventId)}>
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
