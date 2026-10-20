"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePicker } from "@/components/file-picker";
import { LogoEditor } from "@/components/logo-editor";
import { LogoMark } from "@/components/logo-mark";
import { buttonVariants } from "@/components/ui/button";
import {
  isLogoCorner,
  isLogoSize,
  logoImageClass,
  panelStyles,
  type LogoCorner,
  type LogoSize,
  type PanelStyle,
} from "@/lib/events/appearance";
import {
  defaultLogoPlacement,
  hasLogoPlacement,
  type LogoPlacement,
} from "@/lib/events/logo-placement";
import {
  brandingSlots,
  removeBrandingFile,
  uploadBrandingFile,
  type BrandingSlot,
} from "@/lib/uploads/branding-client";

function placementIdentity(placement: LogoPlacement | null) {
  if (!placement) {
    return "legacy";
  }

  return `${placement.scale}:${placement.x}:${placement.y}`;
}

export function BrandingUploads({
  eventId,
  previews,
  disabled = false,
  uploadOnSave = false,
  onStagedChange,
  panelStyle = "solid",
  logoPlacement = null,
  onLogoDraft,
  onCommitLogoPlacement,
}: {
  eventId?: string;
  previews?: {
    cover: string | null;
    logo: string | null;
    background: string | null;
  };
  disabled?: boolean;
  uploadOnSave?: boolean;
  onStagedChange?: (files: Partial<Record<BrandingSlot, File>>) => void;
  panelStyle?: PanelStyle;
  logoPlacement?: LogoPlacement | null;
  onLogoDraft?: (placement: LogoPlacement | null) => void;
  onCommitLogoPlacement?: (placement: LogoPlacement | null) => Promise<boolean | void> | boolean | void;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Partial<Record<BrandingSlot, string>>>({});
  const [cleared, setCleared] = useState<Partial<Record<BrandingSlot, boolean>>>({});
  const [pickerGeneration, setPickerGeneration] = useState<Partial<Record<BrandingSlot, number>>>(
    {},
  );
  const [cardStyle, setCardStyle] = useState<PanelStyle>(panelStyle);
  const [logoSize, setLogoSize] = useState<LogoSize>("medium");
  const [logoCorner, setLogoCorner] = useState<LogoCorner>("square");
  const [savedPlacement, setSavedPlacement] = useState<LogoPlacement | null>(logoPlacement);
  const [placementKey, setPlacementKey] = useState(placementIdentity(logoPlacement));
  const [editingLogo, setEditingLogo] = useState(false);
  const [logoDraft, setLogoDraft] = useState<LogoPlacement>(logoPlacement ?? defaultLogoPlacement);
  const sectionRef = useRef<HTMLElement>(null);
  const staged = useRef<Partial<Record<BrandingSlot, File>>>({});
  const previewUrls = useRef<string[]>([]);
  const nextPlacementKey = placementIdentity(logoPlacement);

  if (!editingLogo && placementKey !== nextPlacementKey) {
    setPlacementKey(nextPlacementKey);
    setSavedPlacement(logoPlacement);
    setLogoDraft(logoPlacement ?? defaultLogoPlacement);
  }

  useEffect(() => {
    const urls = previewUrls.current;

    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    const form = sectionRef.current?.closest("form");

    if (!form) {
      return;
    }

    const read = () => {
      const data = new FormData(form);
      const size = data.get("logoSize");
      const corner = data.get("logoCorner");

      if (typeof size === "string" && isLogoSize(size)) {
        setLogoSize(size);
      }

      if (typeof corner === "string" && isLogoCorner(corner)) {
        setLogoCorner(corner);
      }
    };

    const frame = requestAnimationFrame(read);
    form.addEventListener("change", read);

    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", read);
    };
  }, []);

  function stage(slot: BrandingSlot, file: File) {
    const next = { ...staged.current, [slot]: file };
    staged.current = next;
    onStagedChange?.(next);
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.push(previewUrl);
    setLocalPreviews((current) => {
      const previous = current[slot];

      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return { ...current, [slot]: previewUrl };
    });
  }

  async function upload(slot: BrandingSlot, file: File) {
    if (slot === "logo") {
      setSavedPlacement(null);
      setLogoDraft(defaultLogoPlacement);
      setEditingLogo(true);
      onLogoDraft?.(null);
    }

    if (!eventId || uploadOnSave) {
      stage(slot, file);
      return;
    }

    setPendingSlot(slot);
    setMessage(null);

    try {
      await uploadBrandingFile(eventId, slot, file);
      setMessage(t("brandingSaved"));
      router.refresh();
    } catch {
      setMessage(t("brandingFailed"));
    } finally {
      setPendingSlot(null);
    }
  }

  function clearStaged(slot: BrandingSlot) {
    if (staged.current[slot]) {
      const next = { ...staged.current };
      delete next[slot];
      staged.current = next;
      onStagedChange?.(next);
    }

    setLocalPreviews((current) => {
      const previous = current[slot];

      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return { ...current, [slot]: undefined };
    });
    setPickerGeneration((current) => ({
      ...current,
      [slot]: (current[slot] ?? 0) + 1,
    }));
  }

  async function remove(slot: BrandingSlot) {
    const hasStored = Boolean(previews?.[slot]) && !cleared[slot];
    clearStaged(slot);

    if (slot === "logo" && !hasStored) {
      setEditingLogo(false);
      setLogoDraft(savedPlacement ?? defaultLogoPlacement);
      onLogoDraft?.(null);
    }

    if (!eventId || !hasStored) {
      return;
    }

    setCleared((current) => ({ ...current, [slot]: true }));
    setPendingSlot(slot);
    setMessage(null);

    try {
      await removeBrandingFile(eventId, slot);

      if (slot === "logo") {
        setSavedPlacement(null);
        setLogoDraft(defaultLogoPlacement);
        setEditingLogo(false);
        onLogoDraft?.(null);
        await onCommitLogoPlacement?.(null);
      }

      setMessage(t("brandingRemoved"));
      router.refresh();
    } catch {
      setCleared((current) => ({ ...current, [slot]: false }));
      setMessage(t("brandingRemoveFailed"));
    } finally {
      setPendingSlot(null);
    }
  }

  const storedBackground = cleared.background ? null : (previews?.background ?? null);
  const backgroundPreview = localPreviews.background ?? storedBackground;
  const hintKey = {
    solid: "panelStyleSolidHint",
    glass: "panelStyleGlassHint",
    frosted: "panelStyleFrostedHint",
  } as const;

  async function saveLogoPlacement() {
    const committed = await onCommitLogoPlacement?.(logoDraft);

    if (committed === false) {
      setMessage(t("logoPositionFailed"));
      return;
    }

    setSavedPlacement(logoDraft);
    setEditingLogo(false);
    setMessage(eventId ? t("logoPositionSaved") : t("logoPositionReady"));
  }

  return (
    <section ref={sectionRef} className="mt-2 grid gap-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">{t("brandingTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/80">{t("brandingLead")}</p>
      </div>
      {brandingSlots.map((slot) => {
        const label = slot === "background" ? t("backgroundImage") : t(slot);
        const storedPreview = cleared[slot] ? null : (previews?.[slot] ?? null);
        const preview = localPreviews[slot] ?? storedPreview;

        return (
          <div key={slot} className="grid gap-2 text-sm font-medium">
            <span>{label}</span>
            {slot === "logo" && preview && editingLogo ? (
              <LogoEditor
                src={preview}
                size={logoSize}
                corner={logoCorner}
                placement={logoDraft}
                disabled={disabled || pendingSlot !== null}
                onChange={(next) => {
                  setLogoDraft(next);
                  onLogoDraft?.(next);
                }}
                onReset={() => {
                  setLogoDraft(defaultLogoPlacement);
                  onLogoDraft?.(defaultLogoPlacement);
                }}
                onSave={() => {
                  void saveLogoPlacement();
                }}
                onCancel={() => {
                  setLogoDraft(savedPlacement ?? defaultLogoPlacement);
                  onLogoDraft?.(null);
                  setEditingLogo(false);
                }}
              />
            ) : null}
            {slot === "logo" && preview && !editingLogo ? (
              hasLogoPlacement(savedPlacement?.scale) && savedPlacement ? (
                <LogoMark
                  src={preview}
                  size={logoSize}
                  corner={logoCorner}
                  placement={savedPlacement}
                />
              ) : (
                // Signed storage URL or a local preview; the image optimizer is not used.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={logoImageClass(logoSize, logoCorner, "screen")}
                  src={preview}
                  alt=""
                />
              )
            ) : null}
            {slot !== "logo" && preview ? (
              // Signed storage URL or a local preview; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="max-h-40 w-full rounded-2xl object-cover" src={preview} alt="" />
            ) : null}
            {slot === "logo" && preview && !editingLogo ? (
              <button
                type="button"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                disabled={disabled || pendingSlot !== null}
                onClick={() => {
                  setLogoDraft(savedPlacement ?? defaultLogoPlacement);
                  setEditingLogo(true);
                }}
              >
                {t("logoEdit")}
              </button>
            ) : null}
            <FilePicker
              key={`${slot}-${pickerGeneration[slot] ?? 0}`}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={disabled || pendingSlot !== null}
              buttonLabel={t("chooseFile")}
              formatSelection={(files) => files[0]?.name ?? ""}
              onFiles={(files) => {
                const file = files?.[0];

                if (file) {
                  void upload(slot, file);
                }
              }}
            />
            {preview ? (
              <button
                type="button"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                disabled={disabled || pendingSlot !== null}
                onClick={() => {
                  void remove(slot);
                }}
              >
                {t("removeImage")}
              </button>
            ) : null}
            {pendingSlot === slot ? <span>{t("pending")}</span> : null}
            {slot === "background" && preview ? (
              <label className="grid gap-2 font-medium">
                {t("panelStyle")}
                <select
                  className="h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="panelStyle"
                  value={cardStyle}
                  aria-describedby="panel-style-hint"
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "solid" || next === "glass" || next === "frosted") {
                      setCardStyle(next);
                    }
                  }}
                >
                  {panelStyles.map((style) => (
                    <option key={style} value={style}>
                      {t(
                        style === "solid"
                          ? "panelStyleSolid"
                          : style === "glass"
                            ? "panelStyleGlass"
                            : "panelStyleFrosted",
                      )}
                    </option>
                  ))}
                </select>
                <span id="panel-style-hint" className="text-sm font-normal leading-6 text-foreground/70">
                  {t(hintKey[cardStyle])}
                </span>
              </label>
            ) : null}
          </div>
        );
      })}
      {backgroundPreview ? null : (
        <input type="hidden" name="panelStyle" value={cardStyle} />
      )}
      {message ? (
        <p role="status" className="text-sm text-foreground/80">
          {message}
        </p>
      ) : null}
    </section>
  );
}
