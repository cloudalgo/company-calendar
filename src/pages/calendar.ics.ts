import type { APIRoute } from "astro";
import { buildIcs } from "../lib/ics";

// Written to dist/calendar.ics at build time
export const GET: APIRoute = () =>
  new Response(buildIcs(), { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
