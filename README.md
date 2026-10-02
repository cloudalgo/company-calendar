# CloudAlgo Calendar

A static page that shows clients the weekdays CloudAlgo's office is closed. It's hosted on GitHub Pages.

The page shows the current calendar year, January to December, and switches to the next year on 1 January. Each year has **exactly 12 weekday closures**: 10 government-mandated holidays plus 2 company holidays. A holiday that falls on a Saturday or Sunday doesn't count toward the 12 and doesn't appear on the page.

## Editing the holidays

The holidays come from a Google Calendar that the admin manages. Each deploy reads that calendar.

### One-time setup

1. In Google Calendar, create a calendar, for example "CloudAlgo holidays".
2. Import [holidays/2026.ics](holidays/2026.ics) and [holidays/2027.ics](holidays/2027.ics) into it: **Settings → Import & export → Import**.
3. Go to the calendar's **Settings → Integrate calendar** and copy **Secret address in iCal format**.
4. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add a secret named `HOLIDAYS_ICS_URL` with that address as its value. The address gives read access to the calendar, so keep it only in this secret.
5. Under **Settings → Pages**, set **Source** to **GitHub Actions**.

### Rules for events

- Make each holiday an **all-day** event. Timed events are ignored.
- The event title is the holiday name, such as "Diwali".
- The description, if any, appears as the holiday's note.
- A multi-day event closes the office on each of its days.
- Yearly repeating events work.

### Picking the 2 company holidays

The 2026 file has 12 weekday closures. New Year's Day is a placeholder for one of the company holidays, so check that it matches what the office actually took.

The 2027 file has 10 weekday closures, so the admin needs to add 2 before 1 January 2027. Until then, the build on that day fails and the site keeps showing 2026. Weekday options in 2027:

- New Year's Day, Fri 1 Jan
- Vasant Panchami, Thu 11 Feb
- Mahavir Jayanti, Mon 19 Apr
- Maha Ashtami, Thu 7 Oct
- Karva Chauth, Mon 18 Oct
- Christmas Eve, Fri 24 Dec

### When changes appear

- The site rebuilds every day at 06:00 IST.
- To publish right away, open **Actions → Deploy to GitHub Pages → Run workflow**.
- If the calendar doesn't have exactly 12 weekday closures, the build stops. The log lists the closures it found and says how many to add or remove. The live site keeps the last good version.
- GitHub pauses scheduled workflows after 60 days with no commits. If that happens, re-enable the workflow from the Actions tab.

### Next year

Add the next year's holidays to the same Google Calendar before 1 January. No code change is needed.

## Development

```sh
npm install
npm run dev       # http://localhost:4321, uses holidays/<current year>.ics
npm test
npm run build     # fails unless the year has 12 weekday closures
```

To try a different calendar, set `HOLIDAYS_ICS_URL` to a URL or a local `.ics` file:

```sh
HOLIDAYS_ICS_URL=path/to/holidays.ics npm run build
```

To preview another year, set `CALENDAR_YEAR`, for example `CALENDAR_YEAR=2027 npm run dev`. The dev server only warns about a wrong count, so it still runs with the 10-closure 2027 sample.

To preview the page as of a given day, add `?today=2027-03-22` to the URL.
