// Loads the holidays when the site builds and serves them as `virtual:cloudalgo-holidays`.
//
// HOLIDAYS_ICS_URL is the admin's Google Calendar "secret address in iCal format" (or a local
// .ics path). Without it, the sample file in holidays/ is used. The year is the current year
// in India, or CALENDAR_YEAR to preview another. A build stops unless the year
// has exactly `closuresPerYear` weekday closures; the dev server only warns.
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { settings } from "../src/data/settings";
import { checkClosures, parseIcs } from "../src/lib/holiday-source";

const ID = "virtual:cloudalgo-holidays";
const RESOLVED = `\0${ID}`;

async function readFeed(where: string): Promise<string> {
  if (!/^https?:\/\//.test(where)) return readFile(where, "utf8");
  const res = await fetch(where, { signal: AbortSignal.timeout(20_000) });
  // The URL holds a secret, so it never goes into a message
  if (!res.ok) throw new Error(`Couldn't read the holiday calendar (HTTP ${res.status}). Check the HOLIDAYS_ICS_URL secret.`);
  return res.text();
}

export function holidaysPlugin(): Plugin {
  let building = false;
  let code: Promise<string> | null = null;

  async function load(): Promise<string> {
    const now = new Date();
    const inIndia = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, ...o }).format(now);
    const year = Number(process.env.CALENDAR_YEAR) || Number(inIndia({ year: "numeric" }));
    const url = process.env.HOLIDAYS_ICS_URL?.trim();
    const where = url || `holidays/${year}.ics`;
    const { holidays, skipped } = parseIcs(await readFeed(where), year);
    for (const s of skipped) console.warn(`[holidays] Skipped ${s}`);

    const check = checkClosures(holidays, { year, workweek: settings.workweek, required: settings.closuresPerYear });
    if (!check.ok) {
      if (building) throw new Error(`[holidays] ${check.message}`);
      console.warn(`[holidays] ${check.message}`);
    } else console.info(`[holidays] ${check.message}`);

    const synced = inIndia({ day: "numeric", month: "short", year: "numeric" });
    const source = { name: url ? "CloudAlgo's holiday calendar" : "the sample holiday file", synced };
    return `export const year = ${year};\nexport const holidays = ${JSON.stringify(holidays)};\nexport const source = ${JSON.stringify(source)};\n`;
  }

  return {
    name: "cloudalgo-holidays",
    configResolved(config) {
      building = config.command === "build";
    },
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      // One read per run, shared by the server and browser bundles
      code ??= load();
      return code;
    },
  };
}
