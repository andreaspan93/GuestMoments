"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PosterTypographyDialog } from "@/components/poster-typography-dialog";
import { buttonVariants } from "@/components/ui/button";
import { eventFontFamily, eventFontWeight, logoImageClass } from "@/lib/events/appearance";
import { POSTER_TOP_FREE_SHARE, posterFrameStyle } from "@/lib/events/poster-layout";
import { downloadPosterPng } from "@/lib/events/poster-png";
import { type PosterTextSizes, type PosterTypography } from "@/lib/events/poster-typography";
import { posterPdfPath, type PosterPaper, type QrDesign } from "@/lib/events/qr-design";
import { cn } from "@/lib/utils";

export type QrPosterEvent = {
  id: string;
  name: string;
  typography: PosterTypography;
  sizes: PosterTextSizes;
  logoSize: string;
  logoCorner: string;
  dateLabel: string;
  shareDate: string;
};

function textStyle(font: string, size: string): CSSProperties {
  return {
    fontFamily: eventFontFamily(font),
    fontSize: size,
    fontWeight: eventFontWeight(font),
  };
}

function EventLogo({ src, className }: { src: string | null; className: string }) {
  if (!src) {
    return null;
  }

  return (
    // Signed storage URL; the image optimizer is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} data-poster-asset="logo" />
  );
}

export function QrDesignPanel({
  event,
  locale,
  coverUrl,
  logoUrl,
  qrSrc,
}: {
  event: QrPosterEvent;
  locale: "en" | "el";
  coverUrl: string | null;
  logoUrl: string | null;
  qrSrc: string;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const [design, setDesign] = useState<QrDesign>("a");
  const [typography, setTypography] = useState(event.typography);
  const [sizes, setSizes] = useState(event.sizes);
  const posterRef = useRef<HTMLDivElement>(null);
  const propsKey = JSON.stringify({ typography: event.typography, sizes: event.sizes });
  const [seenProps, setSeenProps] = useState(propsKey);

  if (propsKey !== seenProps) {
    setSeenProps(propsKey);
    setTypography(event.typography);
    setSizes(event.sizes);
  }
  const posterClass = logoUrl ? "qr-poster qr-poster-has-logo" : "qr-poster";

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center self-center gap-3 px-4 pt-2 text-center print:hidden sm:px-6">
        <p className="max-w-xl text-sm leading-6 text-foreground/80">{t("qrLead")}</p>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs tracking-[0.16em] text-foreground/70 uppercase">{t("qrDesignLabel")}</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <div role="group" aria-label={t("qrDesignLabel")} className="flex flex-wrap justify-center gap-1.5">
              <button
                type="button"
                aria-pressed={design === "a"}
                className={buttonVariants({ variant: design === "a" ? "default" : "outline", size: "sm" })}
                onClick={() => setDesign("a")}
              >
                {t("qrDesignA")}
              </button>
              <button
                type="button"
                aria-pressed={design === "b"}
                className={buttonVariants({ variant: design === "b" ? "default" : "outline", size: "sm" })}
                onClick={() => setDesign("b")}
              >
                {t("qrDesignB")}
              </button>
              <button
                type="button"
                aria-pressed={design === "c"}
                className={buttonVariants({ variant: design === "c" ? "default" : "outline", size: "sm" })}
                onClick={() => setDesign("c")}
              >
                {t("qrDesignC")}
              </button>
            </div>
            <PosterTypographyDialog
              eventId={event.id}
              typography={typography}
              onSaved={(saved) => {
                setTypography(saved.typography);
                setSizes(saved.sizes);
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>
      <div className="qr-poster-stage">
        <div
          ref={posterRef}
          className="qr-poster-scale"
          data-qr-design={design}
          data-event-id={event.id}
        >
          {design === "a" ? (
            <article className={posterClass} style={posterFrameStyle() as CSSProperties}>
              <div className="qr-poster-sheet">
                <div className="qr-poster-balance" style={{ flexGrow: POSTER_TOP_FREE_SHARE }} aria-hidden="true" />
                <h1
                  className="qr-poster-title"
                  data-poster-text="title"
                  style={textStyle(typography.nameFont, sizes.name)}
                >
                  {event.name}
                </h1>
                <p className="qr-poster-date" data-poster-text="date" style={textStyle(typography.dateFont, sizes.date)}>
                  {event.dateLabel}
                </p>
                {coverUrl ? (
                  // Signed storage URL; the image optimizer is not used.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="qr-poster-cover" src={coverUrl} alt="" data-poster-asset="cover" />
                ) : null}
                {logoUrl ? (
                  <div className="qr-poster-logo">
                    <EventLogo
                      src={logoUrl}
                      className={logoImageClass(event.logoSize, event.logoCorner, "print")}
                    />
                  </div>
                ) : null}
                <QrMark src={qrSrc} alt={t("qrAlt")} />
                <p className="qr-poster-cta" data-poster-text="cta">
                  {t("qrPosterCta")}
                </p>
                <div
                  className="qr-poster-balance"
                  style={{ flexGrow: 1 - POSTER_TOP_FREE_SHARE }}
                  aria-hidden="true"
                />
              </div>
            </article>
          ) : design === "b" ? (
            <article className="qr-poster qr-share">
              <div className="qr-share-sheet">
                <p className="qr-share-kicker" data-poster-text="kicker" style={textStyle(typography.kickerFont, sizes.kicker)}>
                  {t("qrShareKicker")}
                </p>
                <div className="qr-share-script-row">
                  <span className="qr-share-rule" />
                  <p className="qr-share-script" data-poster-text="script" style={textStyle(typography.scriptFont, sizes.script)}>
                    {t("qrShareScript")}
                  </p>
                  <span className="qr-share-rule" />
                </div>
                <div className="qr-share-lines">
                  <p className="qr-share-line" data-poster-text="line">
                    {t("qrShareLine1")}
                  </p>
                  <p className="qr-share-line" data-poster-text="line">
                    {t("qrShareLine2")}
                  </p>
                </div>
                <QrMark src={qrSrc} alt={t("qrAlt")} />
                <p className="qr-share-name" data-poster-text="name" style={textStyle(typography.nameFont, sizes.name)}>
                  {event.name}
                </p>
                <p className="qr-share-date" data-poster-text="share-date" style={textStyle(typography.dateFont, sizes.date)}>
                  {event.shareDate}
                </p>
              </div>
            </article>
          ) : (
            <article className="qr-poster qr-card">
              <div className="qr-card-copy">
                <p className="qr-card-script" data-poster-text="script" style={textStyle(typography.scriptFont, sizes.script)}>
                  {t("qrShareScript")}
                </p>
                <p className="qr-card-kicker" data-poster-text="kicker" style={textStyle(typography.kickerFont, sizes.kicker)}>
                  {t("qrShareKicker")}
                </p>
                <p className="qr-card-name" data-poster-text="name" style={textStyle(typography.nameFont, sizes.name)}>
                  {event.name}
                </p>
                <p className="qr-card-date" data-poster-text="share-date" style={textStyle(typography.dateFont, sizes.date)}>
                  {event.shareDate}
                </p>
                <p className="qr-card-line" data-poster-text="line">
                  {t("qrShareLine2")}
                </p>
              </div>
              <div className="qr-card-mark">
                <CameraMark />
                <QrMark src={qrSrc} alt={t("qrAlt")} />
              </div>
            </article>
          )}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center self-center gap-3 px-4 pt-1 pb-8 text-center print:hidden sm:px-6">
        <div className="grid w-full max-w-xl grid-cols-2 items-stretch gap-2">
          <button
            type="button"
            data-poster-download={design}
            className={cn(buttonVariants({ variant: "outline" }), "h-full min-h-10 min-w-0 whitespace-normal px-3 text-center")}
            onClick={() => {
              const node = posterRef.current;

              if (node) {
                void downloadPosterPng(node, design);
              }
            }}
          >
            {t("downloadQr")}
          </button>
          <PosterPdfMenu eventId={event.id} locale={locale} design={design} />
        </div>
      </div>
    </>
  );
}

const portraitPdfOptions = [
  { paper: "a5", label: "downloadA5", size: "148 × 210 mm" },
  { paper: "a7", label: "downloadA7", size: "74 × 105 mm" },
] as const satisfies ReadonlyArray<{ paper: PosterPaper; label: "downloadA5" | "downloadA7" | "downloadA8"; size: string }>;

const cardPdfOptions = [
  { paper: "a8", label: "downloadA8", size: "74 × 52 mm" },
] as const satisfies ReadonlyArray<{ paper: PosterPaper; label: "downloadA5" | "downloadA7" | "downloadA8"; size: string }>;

function PosterPdfMenu({
  eventId,
  locale,
  design,
}: {
  eventId: string;
  locale: string;
  design: QrDesign;
}) {
  const t = useTranslations("events");
  const [open, setOpen] = useState(false);
  const [menuDesign, setMenuDesign] = useState(design);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = design === "c" ? cardPdfOptions : portraitPdfOptions;

  if (menuDesign !== design) {
    setMenuDesign(design);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }), "h-full min-h-10 w-full min-w-0 whitespace-normal px-3 text-center")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {t("downloadPdf")}
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-2 w-48 rounded-3xl border border-border bg-card p-1 text-left shadow-lg"
        >
          {options.map((option) => (
            <a
              key={option.paper}
              role="menuitem"
              href={posterPdfPath(eventId, locale, design, option.paper)}
              className="block rounded-2xl px-4 py-2 hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <span className="block text-sm font-medium">{t(option.label)}</span>
              <span className="block text-xs text-foreground/70">{option.size}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CameraMark() {
  return (
    <svg className="qr-card-camera" viewBox="0 0 64 48" aria-hidden="true">
      <path
        d="M24 8h7l3 6h18a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6h8l4-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="33" cy="28" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function QrMark({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="qr-poster-qr">
      {/* Generated locally; the image optimizer is not used. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={512} height={512} data-poster-image="qr" />
    </div>
  );
}
