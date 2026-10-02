import { calendar, type Holiday } from "../data/calendar";

export { calendar, type Holiday };

export const YEAR = calendar.year;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------- dates ----------
// Every date is a local calendar day built from y/m/d, so the machine's time zone never shifts it.
const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
export const diffDays = (a: Date, b: Date) => Math.round((toDate(toISO(b)).getTime() - toDate(toISO(a)).getTime()) / 864e5);
export const yearStart = () => new Date(YEAR, 0, 1);
export const yearEnd = () => new Date(YEAR, 11, 31);
export const daysInYear = () => diffDays(yearStart(), yearEnd()) + 1;

/** Today's date in India, where the office is. */
export function indiaToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: calendar.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return toDate(parts);
}

// ---------- closures ----------
export const isWeekend = (d: Date) => !calendar.workweek.includes(d.getDay());
const holidayByDate = new Map(calendar.holidays.map((h) => [h.date, h]));

/** Holidays that land on a working day: the days the office is actually closed. */
export const closures: Holiday[] = calendar.holidays
  .filter((h) => !isWeekend(toDate(h.date)))
  .sort((a, b) => a.date.localeCompare(b.date));

/** The holiday that closes the office on this working day, if any. */
export function closedOn(d: Date): Holiday | undefined {
  return isWeekend(d) ? undefined : holidayByDate.get(toISO(d));
}
export const isOff = (d: Date) => isWeekend(d) || closedOn(d) !== undefined;

export function nextClosure(from: Date): { date: Date; holiday: Holiday } | null {
  const h = closures.find((c) => c.date >= toISO(from));
  return h ? { date: toDate(h.date), holiday: h } : null;
}

/** The stretch of days off around a closure, and the working days either side of it. */
export function runAround(d: Date) {
  let start = new Date(d);
  let end = new Date(d);
  while (isOff(addDays(start, -1))) start = addDays(start, -1);
  while (isOff(addDays(end, 1))) end = addDays(end, 1);
  let work = 0;
  for (let x = new Date(start); x <= end; x = addDays(x, 1)) if (!isWeekend(x)) work++;
  return { start, end, days: diffDays(start, end) + 1, work, lastDayBefore: addDays(start, -1), back: addDays(end, 1) };
}

export function closuresIn(month: number): Holiday[] {
  return closures.filter((c) => toDate(c.date).getMonth() === month);
}

export function monthStats(month: number) {
  let working = 0;
  let closed = 0;
  for (let d = new Date(YEAR, month, 1); d.getMonth() === month; d = addDays(d, 1)) {
    if (isWeekend(d)) continue;
    if (closedOn(d)) closed++;
    else working++;
  }
  return { working, closed };
}

export interface GridCell {
  iso: string;
  date: Date;
  inMonth: boolean;
  weekend: boolean;
  closure?: Holiday;
}

/** Monday-first weeks covering the month. */
export function monthGrid(month: number): GridCell[] {
  const first = new Date(YEAR, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(YEAR, month + 1, 0).getDate();
  const weeks = Math.ceil((lead + dim) / 7);
  const start = addDays(first, -lead);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i);
    const inMonth = date.getMonth() === month;
    return { iso: toISO(date), date, inMonth, weekend: isWeekend(date), closure: inMonth ? closedOn(date) : undefined };
  });
}

// ---------- words ----------
export const mon = (d: Date) => MONTHS[d.getMonth()]!.slice(0, 3);
export const dow = (d: Date) => DAYS[d.getDay()]!.slice(0, 3);
export const shortDate = (d: Date) => `${dow(d)} ${d.getDate()} ${mon(d)}`;
export const longDate = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  const a = Math.abs(n);
  const t = a < 14 ? `${a} days` : a < 60 ? `${Math.round(a / 7)} weeks` : `${Math.round(a / 30.4)} months`;
  return n > 0 ? `in ${t}` : `${t} ago`;
}

export const hoursLabel = () => `${calendar.hours.start}–${calendar.hours.end}`;
export const hoursSentence = () => `Monday to Friday, ${calendar.hours.start} to ${calendar.hours.end} India time.`;
