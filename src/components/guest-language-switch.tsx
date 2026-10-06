import { LocaleFlag } from "@/components/locale-flag";
import { setGuestLocale } from "@/lib/events/guest-actions";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { cn } from "@/lib/utils";

export function GuestLanguageSwitch({
  locale,
  accentColor,
}: {
  locale: GuestLocale;
  accentColor: string;
}) {
  const copy = guestChrome[locale];

  return (
    <nav
      aria-label={copy.language}
      className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-sm"
    >
      {(["el", "en"] as const).map((item) => {
        const selected = item === locale;
        const label = item === "el" ? copy.greek : copy.english;

        return (
          <form key={item} action={setGuestLocale.bind(null, item)}>
            <button
              type="submit"
              aria-label={label}
              title={label}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                selected ? "bg-muted" : "hover:bg-muted/80",
              )}
              style={selected ? { boxShadow: `inset 0 0 0 1px ${accentColor}` } : undefined}
            >
              <LocaleFlag locale={item} />
              <span className="sr-only">{label}</span>
            </button>
          </form>
        );
      })}
    </nav>
  );
}
