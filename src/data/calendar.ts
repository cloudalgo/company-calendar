import { holidays, source, year } from "virtual:cloudalgo-holidays";
import { settings } from "./settings";

export type { Holiday } from "../lib/holiday-source";

export const calendar = { ...settings, year, source, holidays };
