// Holidays read from the Google Calendar feed at build time (plugins/holidays.ts)
declare module "virtual:cloudalgo-holidays" {
  export const year: number;
  export const holidays: { date: string; name: string; note?: string }[];
  export const source: { name: string; synced: string };
}
