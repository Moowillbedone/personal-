// Scheduled US cash-equity sessions (America/New_York, including DST).
// NYSE regular holidays/early closes: https://www.nyse.com/markets/hours-calendars
// This is a schedule, not an exchange status feed; emergency closures/halts
// still require checking the broker. Explicit exceptional closures live below.
export type MarketSession = "pre" | "regular" | "after" | "closed";

export function nyClock(now: Date = new Date()): { date: string; minutes: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => p.find((part) => part.type === type)?.value ?? "0";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

function day(year: number, month: number, date: number): string {
  return new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10);
}
function nthMonday(year: number, month: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return day(year, month, 1 + (8 - first) % 7 + (n - 1) * 7);
}
function observed(year: number, month: number, date: number): string {
  const d = new Date(Date.UTC(year, month - 1, date));
  return day(year, month, date + (d.getUTCDay() === 6 ? -1 : d.getUTCDay() === 0 ? 1 : 0));
}
function goodFriday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return day(year, Math.floor((h + l - 7 * m + 114) / 31), (h + l - 7 * m + 114) % 31 - 1);
}
function thanksgiving(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  return day(year, 11, 1 + (11 - first) % 7 + 21);
}

export function isTradingDate(date: string): boolean {
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.getUTCDay() === 0 || d.getUTCDay() === 6) return false;
  const year = d.getUTCFullYear();
  const holidays = [
    // NYSE does not observe a Saturday New Year's Day on the prior Friday.
    day(year, 1, new Date(Date.UTC(year, 0, 1)).getUTCDay() === 0 ? 2 : 1),
    nthMonday(year, 1, 3), nthMonday(year, 2, 3), goodFriday(year),
    day(year, 5, 31 - (new Date(Date.UTC(year, 4, 31)).getUTCDay() + 6) % 7),
    observed(year, 7, 4), nthMonday(year, 9, 1), thanksgiving(year), observed(year, 12, 25),
    ...(year >= 2022 ? [observed(year, 6, 19)] : []),
    "2025-01-09", // National day of mourning for President Carter.
  ];
  return !holidays.includes(date);
}

export function regularCloseMinutes(date: string): number {
  const year = Number(date.slice(0, 4));
  const afterThanksgiving = day(year, 11, Number(thanksgiving(year).slice(-2)) + 1);
  return date.endsWith("-07-03") || date.endsWith("-12-24") || date === afterThanksgiving ? 13 * 60 : 16 * 60;
}

export function scheduledMarketSession(now: Date = new Date()): MarketSession {
  const { date, minutes } = nyClock(now);
  if (!isTradingDate(date)) return "closed";
  if (minutes >= 240 && minutes < 570) return "pre";
  if (minutes >= 570 && minutes < regularCloseMinutes(date)) return "regular";
  // Early-close late sessions end at 17:00 ET per the published schedule.
  const lateClose = regularCloseMinutes(date) === 780 ? 1020 : 1200;
  if (minutes >= regularCloseMinutes(date) && minutes < lateClose) return "after";
  return "closed";
}

/** Latest session with a complete daily bar available on delayed SIP. */
export function lastCompletedTradingDate(now: Date = new Date()): string {
  const { date, minutes } = nyClock(now);
  let d = new Date(`${date}T12:00:00Z`);
  if (minutes < regularCloseMinutes(date) + 20) d.setUTCDate(d.getUTCDate() - 1);
  while (!isTradingDate(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
