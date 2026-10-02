import { addDays, calendar, closures, toDate, toISO, YEAR } from "./calendar";

const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

// RFC 5545 lines are at most 75 octets; longer ones continue on a line starting with a space
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  for (const ch of line) {
    if (new TextEncoder().encode(chunk + ch).length > (out.length ? 74 : 75)) {
      out.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

/** Every working day the office is closed, as an all-day event. */
export function buildIcs(stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ymd = (iso: string) => iso.replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${calendar.company}//Calendar ${YEAR}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendar.company} closures ${YEAR}`,
    `X-WR-TIMEZONE:${calendar.timezone}`,
  ];
  for (const c of closures) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.date}-${c.name.replace(/\W+/g, "-").toLowerCase()}@cloudalgo.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${ymd(c.date)}`,
      `DTEND;VALUE=DATE:${ymd(toISO(addDays(toDate(c.date), 1)))}`,
      `SUMMARY:${text(`${calendar.company} closed: ${c.name}`)}`,
      ...(c.note ? [`DESCRIPTION:${text(c.note)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
