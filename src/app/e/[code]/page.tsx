import { notFound } from "next/navigation";
import { GuestLanguageSwitch } from "@/components/guest-language-switch";
import { GuestUploader } from "@/components/guest-uploader";
import { decideGuestAccess } from "@/lib/events/access";
import { formatCalendarDate, calendarDateFromDb } from "@/lib/events/expiry";
import { readGuestLocale } from "@/lib/events/guest-actions";
import { loadGuestEvent } from "@/lib/events/service";
import { guestChrome, guestText } from "@/lib/events/text";
import { signedObjectUrl } from "@/lib/storage/links";

export default async function GuestEventRoute({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const loaded = await loadGuestEvent(code);
  const decision = decideGuestAccess(
    loaded
      ? {
          status: loaded.event.status,
          expiresAt: loaded.event.expiresAt,
          customerDisabled: loaded.customerDisabled,
        }
      : null,
    new Date(),
  );

  if (decision.state === "not_found" || !loaded) {
    notFound();
  }

  const locale = await readGuestLocale();
  const copy = guestChrome[locale];
  const event = loaded.event;
  const open = decision.state === "ok";
  const [coverUrl, logoUrl, backgroundUrl] = open
    ? await Promise.all([
        signedObjectUrl(event.coverKey),
        signedObjectUrl(event.logoKey),
        signedObjectUrl(event.backgroundImageKey),
      ])
    : [null, null, null];
  const welcome = guestText(locale, event.welcomeMessageEl, event.welcomeMessageEn);
  const instructions = guestText(
    locale,
    event.uploadInstructionsEl,
    event.uploadInstructionsEn,
  );

  return (
    <main
      className="flex flex-1 flex-col px-6 py-8"
      style={{
        backgroundColor: event.backgroundColor,
        backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex justify-end">
          <GuestLanguageSwitch locale={locale} accentColor={event.accentColor} />
        </div>
        <section className="mt-6 flex flex-1 flex-col rounded-3xl bg-card px-6 py-10 shadow-sm">
          {logoUrl ? (
            // Signed storage URL; the image optimizer is not used.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mb-4 h-16 w-auto object-contain" src={logoUrl} alt="" />
          ) : null}
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mb-6 max-h-64 w-full rounded-2xl object-cover" src={coverUrl} alt="" />
          ) : null}
          <p className="text-sm text-foreground/70">
            {formatCalendarDate(calendarDateFromDb(event.eventDate), locale)}
          </p>
          <h1
            className="mt-2 text-4xl font-semibold tracking-tight"
            style={{ color: event.accentColor }}
          >
            {event.name}
          </h1>
          {decision.state === "unavailable" ? (
            <p role="alert" className="mt-6 text-lg leading-8">
              {copy.unavailable}
            </p>
          ) : (
            <>
              {welcome ? (
                <p className="mt-6 text-lg leading-8 whitespace-pre-wrap">{welcome}</p>
              ) : null}
              {instructions ? (
                <div className="mt-8">
                  <h2 className="text-sm font-medium tracking-wide uppercase" style={{ color: event.accentColor }}>
                    {copy.instructions}
                  </h2>
                  <p className="mt-3 leading-7 whitespace-pre-wrap">{instructions}</p>
                </div>
              ) : null}
              <GuestUploader
                code={event.uniqueCode}
                locale={locale}
                accentColor={event.accentColor}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
