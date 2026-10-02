// CloudAlgo, India. Holiday dates themselves come from the admin's Google Calendar;
// see README, "Editing the holidays". The year is the current one in India, set at build time.
export const settings = {
  company: "CloudAlgo",
  timezone: "Asia/Kolkata",
  workweek: [1, 2, 3, 4, 5], // Mon–Fri (0 = Sunday)
  hours: { start: "09:30", end: "18:30" },
  contact: "support@cloudalgo.com",
  /** 10 government-mandated holidays plus 2 company holidays, every year. */
  closuresPerYear: 12,
};
