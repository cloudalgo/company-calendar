// Reads holidays out of an iCal feed (a Google Calendar export) and checks the yearly count.
// Pure functions only, so the build plugin and the tests can both use them.

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  note?: string;
}

interface Prop {
  params: Record<string, string>;
  value: string;
}

const unescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
const isoOf = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
function addDay(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
// Google sometimes stores descriptions as HTML
const plain = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

function parseLine(line: string): [string, Prop] {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  const head = colon < 0 ? line : line.slice(0, colon);
  const [name, ...ps] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v = ""] = p.split("=");
    params[k!.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return [name!.toUpperCase(), { params, value: colon < 0 ? "" : line.slice(colon + 1) }];
}

export interface ParseResult {
  holidays: Holiday[];
  /** Events that were left out, and why, so the admin can fix them. */
  skipped: string[];
}

/**
 * Every all-day event in the feed that touches `year`, one entry per day.
 * Multi-day events cover each of their days. Yearly repeating events are placed in `year`.
 */
export function parseIcs(text: string, year: number): ParseResult {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: Map<string, Prop[]>[] = [];
  let cur: Map<string, Prop[]> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = new Map();
    else if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur && line) {
      const [name, prop] = parseLine(line);
      cur.set(name, [...(cur.get(name) ?? []), prop]);
    }
  }
  const one = (ev: Map<string, Prop[]>, k: string) => ev.get(k)?.[0];

  // A moved instance of a repeating event replaces the instance it came from
  const moved = new Set<string>();
  for (const ev of events) {
    const rid = one(ev, "RECURRENCE-ID");
    if (rid) moved.add(`${one(ev, "UID")?.value}|${isoOf(rid.value)}`);
  }

  const byDate = new Map<string, Holiday>();
  const skipped: string[] = [];
  for (const ev of events) {
    const name = unescape(one(ev, "SUMMARY")?.value ?? "").trim() || "Holiday";
    if (one(ev, "STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    const start = one(ev, "DTSTART");
    if (!start) continue;
    const allDay = start.params.VALUE === "DATE" || /^\d{8}$/.test(start.value);
    const s = isoOf(start.value);
    if (!allDay) {
      if (s.startsWith(`${year}-`)) skipped.push(`${name} (${s}): not an all-day event`);
      continue;
    }
    const end = one(ev, "DTEND");
    const length = Math.max(1, end && /^\d{8}/.test(end.value) ? daysBetween(s, isoOf(end.value)) : 1);

    let starts = [s];
    const rrule = one(ev, "RRULE")?.value;
    if (rrule) {
      const r = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
      if (r.FREQ !== "YEARLY" || Object.keys(r).some((k) => k.startsWith("BY"))) {
        skipped.push(`${name}: repeats in a way the site can't follow. Add the ${year} date as its own event.`);
        continue;
      }
      const k = year - Number(s.slice(0, 4));
      const interval = Number(r.INTERVAL ?? 1);
      const occ = `${year}${s.slice(4)}`;
      const exdates = (ev.get("EXDATE") ?? []).flatMap((p) => p.value.split(",")).map(isoOf);
      const inRange = k >= 0 && k % interval === 0 && (!r.COUNT || k / interval < Number(r.COUNT)) && (!r.UNTIL || r.UNTIL.slice(0, 8) >= occ.replace(/-/g, ""));
      starts = inRange && !exdates.includes(occ) && !moved.has(`${one(ev, "UID")?.value}|${occ}`) ? [occ] : [];
    }

    const description = one(ev, "DESCRIPTION");
    const note = description ? plain(unescape(description.value)) : "";
    for (const st of starts) {
      for (let i = 0; i < length; i++) {
        const date = addDay(st, i);
        if (!date.startsWith(`${year}-`)) continue;
        const prev = byDate.get(date);
        if (prev) {
          prev.name = `${prev.name} and ${name}`;
          if (note) prev.note = prev.note ? `${prev.note} ${note}` : note;
        } else byDate.set(date, note ? { date, name, note } : { date, name });
      }
    }
  }
  const holidays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { holidays, skipped };
}

/** Holidays on working days are the days the office is closed. Their count must be exact. */
export function checkClosures(holidays: Holiday[], opts: { year: number; workweek: number[]; required: number }) {
  const closures = holidays.filter((h) => opts.workweek.includes(weekday(h.date)));
  const ok = closures.length === opts.required;
  const message = ok
    ? `${closures.length} weekday closures in ${opts.year}.`
    : `The holiday calendar has ${closures.length} weekday closures in ${opts.year}; it needs exactly ${opts.required}. ` +
      `Holidays on a Saturday or Sunday don't count. ${closures.length < opts.required ? "Add" : "Remove"} ${Math.abs(opts.required - closures.length)}.\n` +
      closures.map((c) => `  ${c.date}  ${c.name}`).join("\n");
  return { closures, ok, message };
}
