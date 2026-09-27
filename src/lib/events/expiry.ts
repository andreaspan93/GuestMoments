const ATHENS = "Europe/Athens";

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string) {
  const match = datePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addCalendarDays(isoDate: string, days: number) {
  if (!isCalendarDate(isoDate) || !Number.isInteger(days)) {
    throw new Error("Invalid calendar date");
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");

  return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

export function calendarDateFromDb(value: Date) {
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${value.getUTCFullYear()}-${month}-${day}`;
}

export function calendarDateToDb(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const wholeSecond = new Date(Math.floor(instant.getTime() / 1000) * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(wholeSecond);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(map.hour);

  if (hour === 24) {
    hour = 0;
  }

  const zonedAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );

  return zonedAsUtc - wholeSecond.getTime();
}

export function athensEndOfDay(isoDate: string) {
  if (!isCalendarDate(isoDate)) {
    throw new Error("Invalid calendar date");
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  let utc = wallClock;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    utc = wallClock - timeZoneOffsetMs(new Date(utc), ATHENS);
  }

  return new Date(utc);
}

export function expiresAtFor(eventDate: string, retentionDays: number) {
  if (!Number.isInteger(retentionDays) || retentionDays < 0) {
    throw new Error("Invalid retention");
  }

  return athensEndOfDay(addCalendarDays(eventDate, retentionDays));
}

export function isExpiryPast(expiresAt: Date, now: Date) {
  return expiresAt.getTime() <= now.getTime();
}

export function formatCalendarDate(isoDate: string, locale: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatAthensDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    timeZone: ATHENS,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
