"use client";

import { useTranslations } from "next-intl";
import {
  retentionChoice,
  retentionDayChoices,
  type RetentionDays,
} from "@/lib/events/retention";

const dayKey: Record<RetentionDays, "days30" | "days60" | "days90"> = {
  30: "days30",
  60: "days60",
  90: "days90",
};

export function RetentionField({
  value,
  className,
}: {
  value?: number | null;
  className: string;
}) {
  const t = useTranslations("events");
  const selected = retentionChoice(value);

  return (
    <label className="grid gap-2 text-sm font-medium">
      {t("retention")}
      <select className={className} name="retentionDays" required defaultValue={selected}>
        {retentionDayChoices.map((days) => (
          <option key={days} value={days}>
            {t(dayKey[days])}
          </option>
        ))}
      </select>
      <span className="text-sm font-normal leading-6 text-foreground/70">{t("retentionHint")}</span>
      {typeof value === "number" && value !== selected ? (
        <span className="text-sm font-normal leading-6 text-primary">{t("retentionLegacy")}</span>
      ) : null}
    </label>
  );
}
