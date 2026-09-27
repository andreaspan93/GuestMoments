import { setGuestLocale } from "@/lib/events/guest-actions";
import { guestChrome, type GuestLocale } from "@/lib/events/text";

export function GuestLanguageSwitch({
  locale,
  accentColor,
}: {
  locale: GuestLocale;
  accentColor: string;
}) {
  const copy = guestChrome[locale];

  return (
    <nav aria-label={copy.language} className="flex gap-2">
      {(["el", "en"] as const).map((item) => {
        const selected = item === locale;

        return (
          <form key={item} action={setGuestLocale.bind(null, item)}>
            <button
              type="submit"
              aria-current={selected ? "true" : undefined}
              className="inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium"
              style={{
                backgroundColor: selected ? accentColor : "transparent",
                borderColor: accentColor,
                color: selected ? "#fffaf6" : accentColor,
              }}
            >
              {item === "el" ? copy.greek : copy.english}
            </button>
          </form>
        );
      })}
    </nav>
  );
}
