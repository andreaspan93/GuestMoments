import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  pathAfterEventCreated,
  pathAfterEventUpdated,
  shouldRedirectAfterEdit,
} from "@/lib/events/create-flow";

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

  it("sends a saved edit to the event list only after the save and image uploads succeed", () => {
    expect(pathAfterEventUpdated()).toBe("/events");
    expect(shouldRedirectAfterEdit(true, true)).toBe(true);
    expect(shouldRedirectAfterEdit(true, false)).toBe(false);
    expect(shouldRedirectAfterEdit(false, true)).toBe(false);
    expect(shouldRedirectAfterEdit(false, false)).toBe(false);

    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    const updateAction = source.slice(
      source.indexOf("export async function updateEventAction"),
      source.indexOf("export async function deleteEventAction"),
    );

    expect(updateAction).toContain("return { savedId: eventId }");
    expect(updateAction).toContain('return { error: "invalid" }');
    expect(updateAction).not.toContain("redirect(");
  });
});
