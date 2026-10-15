import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pathAfterEventCreated } from "@/lib/events/create-flow";

describe("create event destination", () => {
  it("returns the event list and does not send the customer to the new event", () => {
    expect(pathAfterEventCreated()).toBe("/events");
    expect(pathAfterEventCreated()).not.toContain("/events/");
  });

  it("keeps creation errors on the form and leaves the list navigation to the client", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    const createAction = source.slice(
      source.indexOf("export async function createEventAction"),
      source.indexOf("export async function updateEventAction"),
    );

    expect(createAction).toContain("return { createdId: event.id }");
    expect(createAction).toContain('return { error: "invalid" }');
    expect(createAction).not.toContain("/events/${event.id}");
  });
});
