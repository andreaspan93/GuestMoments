import { notFound } from "next/navigation";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { GuestGallery } from "@/components/guest-gallery";
import { GuestLanguageSwitch } from "@/components/guest-language-switch";
import { GuestTokenCleanup } from "@/components/guest-token-cleanup";
import { GuestUploader } from "@/components/guest-uploader";
import { LogoMark } from "@/components/logo-mark";
import { eventFontFamily, eventTextWeight, guestPanelClass, logoImageClass } from "@/lib/events/appearance";
import { hasLogoPlacement } from "@/lib/events/logo-placement";
import { cn } from "@/lib/utils";
import { decideGuestAccess } from "@/lib/events/access";
import { formatCalendarDate, calendarDateFromDb } from "@/lib/events/expiry";
import { readGuestLocale } from "@/lib/events/guest-actions";
import { guestLocaleFromQuery } from "@/lib/events/text";
import { loadGuestEvent } from "@/lib/events/service";
import { guestChrome, guestText } from "@/lib/events/text";
import { guestGalleryItems } from "@/lib/gallery/service";
import { signedObjectUrl } from "@/lib/storage/links";
import { readGuestCookie } from "@/lib/uploads/http";

export default async function GuestEventRoute({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ hl?: string | string[] }>;
}) {
  const { code } = await params;
  const { hl } = await searchParams;
  const loaded = await loadGuestEvent(code);
  const decision = decideGuestAccess(
    loaded
      ? {
          status: loaded.event.status,
          customerDisabled: loaded.customerDisabled,
          customerAccessExpiresAt: loaded.customerAccessExpiresAt,
        }
      : null,
    new Date(),
  );

  if (decision.state === "not_found" || !loaded) {
    notFound();
  }

  const locale = guestLocaleFromQuery(hl) ?? (await readGuestLocale());
  const copy = guestChrome[locale];
  const event = loaded.event;
  const open = decision.state === "ok";
  const [coverUrl, logoUrl] = open
    ? await Promise.all([
        signedObjectUrl(event.coverKey),
        signedObjectUrl(event.logoKey),
      ])
    : [null, null];
  const backgroundUrl = await signedObjectUrl(event.backgroundImageKey);
  const guestCookie = open ? await readGuestCookie(code) : undefined;
  const galleryItems = open
    ? await guestGalleryItems({
        event,
        customerDisabled: loaded.customerDisabled,
        customerAccessExpiresAt: loaded.customerAccessExpiresAt,
        cookieToken: guestCookie,
      })
    : [];
  const panelClass = guestPanelClass(event.panelStyle, Boolean(backgroundUrl));
  const welcome = guestText(locale, event.welcomeMessageEl, event.welcomeMessageEn);
  const instructions = guestText(
    locale,
    event.uploadInstructionsEl,
    event.uploadInstructionsEn,
  );

  return (
    <main
      className="relative flex flex-1 flex-col"
      style={backgroundUrl ? undefined : { backgroundColor: event.backgroundColor }}
    >
      {backgroundUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundColor: event.backgroundColor,
            backgroundImage: `url("${backgroundUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <div
        className="guest-page relative z-10 flex flex-1 flex-col px-6 py-8"
        style={{
          fontFamily: eventFontFamily(event.guestFont),
          fontWeight: eventTextWeight(event.guestBold),
        }}
      >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <GuestTokenCleanup />
        <div className="flex justify-end">
          <GuestLanguageSwitch locale={locale} accentColor={event.accentColor} code={event.uniqueCode} />
        </div>
        {backgroundUrl ? <div className="min-h-[42vh] sm:min-h-[50vh]" aria-hidden="true" /> : null}
        <section
          className={cn(
            "mx-auto w-full max-w-lg rounded-3xl px-6 py-10 shadow-sm",
            backgroundUrl ? "mt-0 flex flex-col" : "mt-6 flex flex-1 flex-col",
            panelClass,
          )}
        >
          {logoUrl ? (
            hasLogoPlacement(event.logoScale) ? (
              <LogoMark
                className="mb-4"
                src={logoUrl}
                size={event.logoSize}
                corner={event.logoCorner}
                placement={{
                  scale: event.logoScale ?? 1,
                  x: event.logoOffsetX ?? 0,
                  y: event.logoOffsetY ?? 0,
                }}
              />
            ) : (
              // Signed storage URL; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`mb-4 ${logoImageClass(event.logoSize, event.logoCorner, "screen")}`}
                src={logoUrl}
                alt=""
              />
            )
          ) : null}
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mb-6 max-h-64 w-full rounded-2xl object-cover" src={coverUrl} alt="" />
          ) : null}
          <p className="text-center text-sm text-foreground/70">
            {formatCalendarDate(calendarDateFromDb(event.eventDate), locale)}
          </p>
          <h1
            className="mt-2 text-center text-4xl tracking-tight break-words"
            style={{
              color: event.accentColor,
              fontFamily: eventFontFamily(event.titleFont),
              fontWeight: eventTextWeight(event.titleBold),
            }}
          >
            {event.name}
          </h1>
          {decision.state === "unavailable" ? (
            <>
              <p role="alert" className="mt-6 text-lg leading-8">
                {copy.unavailable}
              </p>
              <p className="mt-8 text-sm leading-6 text-foreground/80">
                <a
                  className="underline underline-offset-4"
                  href={locale === "en" ? "/en/guest-privacy" : "/guest-privacy"}
                >
                  {copy.privacyLink}
                </a>
                {" · "}
                <CookieSettingsButton label={copy.cookieSettings} />
              </p>
            </>
          ) : (
            <>
              {welcome ? (
                <p
                  className="mt-6 text-center text-lg leading-8 break-words whitespace-pre-wrap"
                  style={{
                    fontFamily: eventFontFamily(event.welcomeFont),
                    fontWeight: eventTextWeight(event.welcomeBold),
                  }}
                >
                  {welcome}
                </p>
              ) : null}
              {instructions ? (
                <div className="mt-8">
                  <h2 className="text-sm font-medium tracking-wide uppercase" style={{ color: event.accentColor }}>
                    {copy.instructions}
                  </h2>
                  <p className="mt-3 leading-7 whitespace-pre-wrap">{instructions}</p>
                </div>
              ) : null}
              <p className="mt-8 text-xs leading-5 text-foreground/80">
                {copy.privacyLead}{" "}
                <a
                  className="underline underline-offset-4"
                  href={locale === "en" ? "/en/guest-privacy" : "/guest-privacy"}
                >
                  {copy.privacyLink}
                </a>
                {" · "}
                <CookieSettingsButton label={copy.cookieSettings} />
              </p>
              <GuestUploader
                code={event.uniqueCode}
                locale={locale}
                accentColor={event.accentColor}
              />
            </>
          )}
        </section>
        {open ? (
          <div className={cn("mx-auto mt-6 w-full max-w-3xl rounded-3xl px-6 py-8 shadow-sm", panelClass)}>
            <GuestGallery
              code={event.uniqueCode}
              locale={locale}
              initialItems={galleryItems}
              downloadsEnabled={event.guestDownloadsEnabled}
            />
          </div>
        ) : null}
      </div>
      </div>
    </main>
  );
}
