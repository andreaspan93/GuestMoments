import { z } from "zod";

export const retentionDayChoices = [30, 60, 90] as const;

export type RetentionDays = (typeof retentionDayChoices)[number];

export function isRetentionDays(value: number): value is RetentionDays {
  return value === 30 || value === 60 || value === 90;
}

export function retentionChoice(value: number | null | undefined): RetentionDays {
  if (value === 30 || value === 60 || value === 90) {
    return value;
  }

  return 90;
}

export const retentionDaysSchema = z
  .union([
    z.literal(30),
    z.literal(60),
    z.literal(90),
    z.literal("30"),
    z.literal("60"),
    z.literal("90"),
  ])
  .transform((value) => Number(value) as RetentionDays);
