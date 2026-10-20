"use client";

import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import {
  logoScaleMax,
  logoScaleMin,
  type LogoPlacement,
} from "@/lib/events/logo-placement";

export function LogoEditor({
  src,
  size,
  corner,
  placement,
  disabled = false,
  onChange,
  onReset,
  onSave,
  onCancel,
}: {
  src: string;
  size: string;
  corner: string;
  placement: LogoPlacement;
  disabled?: boolean;
  onChange: (placement: LogoPlacement) => void;
  onReset: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("events");

  return (
    <div className="grid gap-3 rounded-3xl border border-border bg-card p-4">
      <p className="text-sm leading-6 font-normal text-foreground/80">{t("logoEditorLead")}</p>
      <LogoMark
        src={src}
        size={size}
        corner={corner}
        placement={placement}
        interactive
        dragLabel={t("logoDrag")}
        onPlacementChange={onChange}
      />
      <label className="grid gap-2 text-sm font-medium">
        {t("logoZoom")}
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="text-base">
            −
          </span>
          <input
            className="h-10 min-w-0 flex-1 accent-primary"
            type="range"
            min={logoScaleMin}
            max={logoScaleMax}
            step={0.01}
            value={placement.scale}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...placement, scale: Number(event.target.value) });
            }}
          />
          <span aria-hidden="true" className="text-base">
            +
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={onReset}>
          {t("logoReset")}
        </Button>
        <Button type="button" disabled={disabled} onClick={onSave}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
