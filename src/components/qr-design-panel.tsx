"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PosterTypographyDialog } from "@/components/poster-typography-dialog";
import { PrintButton } from "@/components/print-button";
import { buttonVariants } from "@/components/ui/button";
import { eventFontFamily, eventFontWeight, logoImageClass } from "@/lib/events/appearance";
import { POSTER_TOP_FREE_SHARE, posterFrameStyle } from "@/lib/events/poster-layout";
import { downloadPosterPng } from "@/lib/events/poster-png";
import { type PosterTextSizes, type PosterTypography } from "@/lib/events/poster-typography";
import { posterPdfPath, type QrDesign } from "@/lib/events/qr-design";

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
          ) : (
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
          )}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center self-center gap-3 px-4 pt-1 pb-8 text-center print:hidden sm:px-6">
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <button
            type="button"
            data-poster-download={design}
            className={buttonVariants({ variant: "outline" })}
            onClick={() => {
              const node = posterRef.current;

              if (node) {
                void downloadPosterPng(node, design);
              }
            }}
          >
            {t("downloadQr")}
          </button>
          <a href={posterPdfPath(event.id, locale, design)} className={buttonVariants({ variant: "outline" })}>
            {t("downloadA5")}
          </a>
          <PrintButton label={t("print")} />
        </div>
      </div>
    </>
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
