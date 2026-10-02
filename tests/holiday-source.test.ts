import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkClosures, parseIcs } from "../src/lib/holiday-source";

const cal = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.flatMap((e) => ["BEGIN:VEVENT", ...e.trim().split("\n").map((l) => l.trim()), "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
const opts = { year: 2027, workweek: [1, 2, 3, 4, 5], required: 12 };

describe("parseIcs", () => {
  it("reads all-day events with escaped text", () => {
    const { holidays } = parseIcs(
      cal(`
        UID:a
        DTSTART;VALUE=DATE:20270126
        DTEND;VALUE=DATE:20270127
        SUMMARY:Republic Day
        DESCRIPTION:National holiday\\, by law.`),
      2027,
    );
    expect(holidays).toEqual([{ date: "2027-01-26", name: "Republic Day", note: "National holiday, by law." }]);
  });

  it("unfolds long lines and strips HTML from descriptions", () => {
    const text = cal(`
      UID:a
      DTSTART;VALUE=DATE:20270815
      SUMMARY:Independence
      DESCRIPTION:<b>Office</b> closed`).replace("SUMMARY:Independence", "SUMMARY:Independen\r\n ce Day");
    expect(parseIcs(text, 2027).holidays).toEqual([{ date: "2027-08-15", name: "Independence Day", note: "Office closed" }]);
  });

  it("gives a multi-day event one entry per day, end date excluded", () => {
    const { holidays } = parseIcs(cal("UID:a\nDTSTART;VALUE=DATE:20271029\nDTEND;VALUE=DATE:20271101\nSUMMARY:Diwali break"), 2027);
    expect(holidays.map((h) => h.date)).toEqual(["2027-10-29", "2027-10-30", "2027-10-31"]);
  });

  it("places a yearly event in the year, minus excluded and moved instances", () => {
    const yearly = (uid: string, extra = "") => `UID:${uid}\nDTSTART;VALUE=DATE:20240101\nSUMMARY:${uid}\nRRULE:FREQ=YEARLY\n${extra}`;
    const { holidays } = parseIcs(
      cal(yearly("kept"), yearly("excluded", "EXDATE;VALUE=DATE:20270101"), yearly("moved"), "UID:moved\nRECURRENCE-ID;VALUE=DATE:20270101\nDTSTART;VALUE=DATE:20270104\nSUMMARY:moved"),
      2027,
    );
    expect(holidays).toEqual([
      { date: "2027-01-01", name: "kept" },
      { date: "2027-01-04", name: "moved" },
    ]);
  });

  it("drops cancelled events, skips timed ones and ignores other years", () => {
    const { holidays, skipped } = parseIcs(
      cal(
        "UID:a\nDTSTART;VALUE=DATE:20270301\nSUMMARY:Cancelled\nSTATUS:CANCELLED",
        "UID:b\nDTSTART;TZID=Asia/Kolkata:20270302T100000\nSUMMARY:Offsite",
        "UID:c\nDTSTART;VALUE=DATE:20260301\nSUMMARY:Last year",
      ),
      2027,
    );
    expect(holidays).toEqual([]);
    expect(skipped).toEqual(["Offsite (2027-03-02): not an all-day event"]);
  });

  it("joins two holidays on the same day", () => {
    const { holidays } = parseIcs(cal("UID:a\nDTSTART;VALUE=DATE:20270322\nSUMMARY:Holi", "UID:b\nDTSTART;VALUE=DATE:20270322\nSUMMARY:Dhulandi"), 2027);
    expect(holidays).toEqual([{ date: "2027-03-22", name: "Holi and Dhulandi" }]);
  });
});

describe("checkClosures", () => {
  const day = (date: string) => ({ date, name: date });

  it("counts only weekdays", () => {
    // 2 and 3 Jan 2027 are a weekend; the February dates are Mon–Fri
    const weekend = ["2027-01-02", "2027-01-03"];
    const weekdays = ["01", "02", "03", "04", "05", "08", "09", "10", "11", "12", "15", "16"].map((d) => `2027-02-${d}`);
    const r = checkClosures([...weekend, ...weekdays].map(day), opts);
    expect(r.ok).toBe(true);
    expect(r.closures.map((c) => c.date)).toEqual(weekdays);
  });

  it("says how many to add when short", () => {
    const r = checkClosures([day("2027-01-26")], opts);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("has 1 weekday closures in 2027; it needs exactly 12");
    expect(r.message).toContain("Add 11");
  });

  it("finds 12 weekday closures in the 2026 file", () => {
    const { holidays } = parseIcs(readFileSync("holidays/2026.ics", "utf8"), 2026);
    expect(checkClosures(holidays, { ...opts, year: 2026 }).ok).toBe(true);
  });

  it("finds 10 weekday closures in the 2027 sample, leaving 2 to pick", () => {
    const { holidays } = parseIcs(readFileSync("holidays/2027.ics", "utf8"), 2027);
    expect(checkClosures(holidays, opts).closures).toHaveLength(10);
  });
});
