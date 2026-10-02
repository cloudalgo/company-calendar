// Everything that depends on today's date. The page is complete without this; it adds
// the countdown, today markers and month switching.
import {
  MONTHS,
  YEAR,
  addDays,
  closedOn,
  closures,
  closuresIn,
  diffDays,
  dow,
  indiaToday,
  isOff,
  isWeekend,
  longDate,
  mon,
  nextClosure,
  relDays,
  runAround,
  shortDate,
  toDate,
  toISO,
  yearEnd,
  yearStart,
  calendar,
} from "../lib/calendar";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pad = (n: number) => String(n).padStart(2, "0");
const FIRST = toISO(yearStart());
const LAST = toISO(yearEnd());
const withYear = (d: Date) => (d.getFullYear() !== YEAR ? ` ${d.getFullYear()}` : "");
const smooth = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// ---------- state ----------
function startToday(): Date {
  const q = new URLSearchParams(location.search).get("today");
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? toDate(q) : indiaToday();
}
function defaultMonth(t: Date): number {
  const hm = /^#(\d{4})-(\d{2})$/.exec(location.hash);
  if (hm && +hm[1]! === YEAR) return Math.min(11, Math.max(0, +hm[2]! - 1));
  const k = toISO(t);
  return k < FIRST ? 0 : k > LAST ? 11 : t.getMonth();
}
const state = {
  today: startToday(),
  month: 0,
  selected: null as string | null,
  showPast: false,
};
state.month = defaultMonth(state.today);
const T0 = () => toISO(state.today);

// ---------- chrome ----------
function renderChrome() {
  $("today-label").textContent = `Today is ${longDate(state.today)} ${state.today.getFullYear()}`;
}

// ---------- hero ----------
let lastBig: string | null = null;
function renderHero() {
  const T = state.today;
  const t0 = T0();
  const set = (id: string, html: string) => ($(id).innerHTML = html);
  const nx = nextClosure(T);
  const big = $("c-big");
  const left = closures.filter((c) => c.date >= t0).length;

  if (!nx) {
    set("c-date", "");
    big.textContent = "–";
    lastBig = null;
    set("c-title", `No more closures in ${YEAR}`);
    set("c-sub", "");
    set("c-cells", "");
    set("c-foot", "");
  } else {
    const n = diffDays(T, nx.date);
    const run = runAround(nx.date);
    const name = esc(nx.holiday.name);
    set("c-date", `${shortDate(nx.date)} ${YEAR}`);
    const value = String(n);
    if (value !== lastBig) {
      big.textContent = value;
      big.classList.remove("roll");
      if (lastBig !== null) {
        void big.offsetWidth;
        big.classList.add("roll");
      }
      lastBig = value;
    }
    set("c-title", n === 0 ? `Today: ${name}` : `${n === 1 ? "day" : "days"} until ${name}`);
    set("c-sub", `${longDate(nx.date)} ${YEAR}`);
    set(
      "c-cells",
      `<div><span class="label">Closed for</span><b class="hot">${run.work}</b><small>Working day${run.work === 1 ? "" : "s"}</small></div>
       <div><span class="label">Back on</span><b>${dow(run.back)}</b><small>${shortDate(run.back)}${withYear(run.back)}</small></div>
       <div><span class="label">Raise by</span><b>${dow(run.lastDayBefore)}</b><small>${shortDate(run.lastDayBefore)}${withYear(run.lastDayBefore)}</small></div>
       <div><span class="label">Left</span><b>${left}</b><small>Closed days in ${YEAR}</small></div>`,
    );
    set(
      "c-foot",
      n === 0
        ? `We're back on ${longDate(run.back)}.`
        : `Need something before then? Raise it by ${longDate(run.lastDayBefore)} and we'll get to it before we close.`,
    );
  }

  // Headline
  const hours = `${calendar.hours.start} to ${calendar.hours.end} India time`;
  const closedToday = closedOn(T);
  if (t0 < FIRST) {
    set("h-title", `Our <span class="mark">${YEAR}</span> calendar.`);
    set("h-sub", `We're closed on <b>${closures.length} weekdays</b> in ${YEAR}. Otherwise we work Monday to Friday, ${hours}.`);
  } else if (t0 > LAST) {
    set("h-title", `That's <span class="mark">${YEAR}</span> done.`);
    set("h-sub", `We work Monday to Friday, ${hours}.`);
  } else if (closedToday) {
    set("h-title", `We're <span class="mark">closed today</span>.`);
    set("h-sub", `Closed for ${esc(closedToday.name)}. We're back on <b>${longDate(runAround(T).back)}</b>, ${hours}.`);
  } else if (isWeekend(T)) {
    let back = new Date(T);
    while (isOff(back)) back = addDays(back, 1);
    set("h-title", `We're off for the <span class="mark">weekend</span>.`);
    set("h-sub", `Back on <b>${longDate(back)}</b>, ${hours}.`);
  } else {
    set("h-title", `We're <span class="mark">open today</span>.`);
    set("h-sub", `Monday to Friday, ${hours}.`);
  }

  // Coming up, after the one on the card
  const skip = nx ? toISO(nx.date) : "";
  const soon = closures.filter((c) => c.date >= t0 && c.date !== skip).slice(0, 4);
  set(
    "soon",
    soon
      .map((c) => {
        const d = toDate(c.date);
        return `<li><span class="when">${d.getDate()} ${mon(d)}</span><span><button type="button" data-go="${c.date}">${esc(c.name)}</button><span class="tag">Office closed</span></span><span class="rel">${relDays(diffDays(T, d))}</span></li>`;
      })
      .join("") || `<li><span></span><span>Nothing else this year.</span></li>`,
  );
}

// ---------- closure strip ----------
function renderAllowance() {
  const t0 = T0();
  document.querySelectorAll<HTMLElement>(".bcell[data-go]").forEach((b) => b.classList.toggle("taken", b.dataset.go! < t0));
}

// ---------- month view ----------
// Line the current month name up with the content edge; the rest of the year runs off to the right
let baseX = 0;
let placed = false;
const mtrack = $("mtrack");
const mhead = $("mhead");
function placeTrack(instant: boolean) {
  const el = mtrack.querySelector<HTMLElement>(".mname.is-current");
  if (!el) return;
  const sec = $("month");
  const left = sec.getBoundingClientRect().left + parseFloat(getComputedStyle(sec).paddingLeft) - mhead.getBoundingClientRect().left;
  // Archivo capitals carry a small left side bearing
  baseX = left - el.offsetLeft - el.offsetHeight * 0.03;
  if (instant) mtrack.style.transition = "none";
  mtrack.style.transform = `translateX(${baseX}px)`;
  if (instant) {
    void mtrack.offsetWidth;
    mtrack.style.transition = "";
  }
}

function renderMonth(userChange = false) {
  const m = state.month;
  document.querySelectorAll<HTMLElement>("#mtabs [data-month]").forEach((b) => {
    const on = +b.dataset.month! === m;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll<HTMLElement>("#month [data-panel]").forEach((p) => (p.hidden = +p.dataset.panel! !== m));
  mtrack.querySelectorAll<HTMLElement>(".mname").forEach((el) => el.classList.toggle("is-current", +el.dataset.m! === m));
  $("mname-sr").textContent = `${MONTHS[m]} ${YEAR}`;
  placeTrack(!placed);
  placed = true;
  if (userChange) {
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#${YEAR}-${pad(m + 1)}`);
    } catch {
      /* history blocked */
    }
  }
  const t0 = T0();
  document.querySelectorAll<HTMLElement>(`#month [data-panel="${m}"] .cell[data-day]`).forEach((c) => {
    c.classList.toggle("today", c.dataset.day === t0);
    c.classList.toggle("sel", c.dataset.day === state.selected);
  });
  renderDetail();
}

function renderDetail() {
  const m = state.month;
  const t0 = T0();
  let k = state.selected;
  if (!k || toDate(k).getMonth() !== m) {
    const upcoming = closuresIn(m).find((c) => c.date >= t0);
    k = state.today.getFullYear() === YEAR && state.today.getMonth() === m ? t0 : upcoming ? upcoming.date : toISO(new Date(YEAR, m, 1));
  }
  const d = toDate(k);
  const c = closedOn(d);
  const row = c
    ? `<div class="row"><span class="label"><i class="k-holiday"></i>Office closed</span><strong>${esc(c.name)}</strong>${c.note ? `<p>${esc(c.note)}</p>` : ""}</div>`
    : `<div class="row"><p>${isWeekend(d) ? "Nothing on. Enjoy the weekend." : "A normal working day."}</p></div>`;
  const status = c
    ? `<span class="status closed">Office closed</span>`
    : isWeekend(d)
      ? `<span class="status off">Weekend</span>`
      : `<span class="status open">Working day, ${calendar.hours.start}–${calendar.hours.end} IST</span>`;
  $("detail").innerHTML = `<h4>${longDate(d)}${k === t0 ? " <small>Today</small>" : ""}</h4>${row}${status}`;
}

// ---------- ledger ----------
function renderLedger() {
  const t0 = T0();
  const rows = [...document.querySelectorAll<HTMLElement>("#ledger .lrow")];
  let pastCount = 0;
  for (const r of rows) {
    const k = r.dataset.go!;
    const done = k < t0;
    if (done) pastCount++;
    r.classList.toggle("done", done);
    r.hidden = done && !state.showPast;
    const n = diffDays(state.today, toDate(k));
    r.querySelector<HTMLElement>("[data-rel]")!.textContent = k === t0 ? "today" : relDays(n);
  }
  document.querySelectorAll<HTMLElement>("#ledger .lmonth").forEach((g) => {
    const rs = [...g.querySelectorAll<HTMLElement>(".lrow")];
    g.hidden = rs.every((r) => r.hidden);
    g.classList.toggle("past", rs.every((r) => r.classList.contains("done")));
  });
  $("l-left").textContent = String(rows.length - pastCount);

  const tg = $("pasttoggle");
  tg.hidden = !pastCount;
  tg.setAttribute("aria-expanded", String(state.showPast));
  tg.innerHTML = `<span>${state.showPast ? "Hide" : "Show"} closures so far</span><span class="mono">${pastCount} date${pastCount === 1 ? "" : "s"} behind you</span>`;

  // The "today" line sits just above the next closure, or after the last one
  const line = $("todayline");
  $("todaychip").textContent = `Today, ${state.today.getDate()} ${mon(state.today)}${withYear(state.today)}`;
  const next = rows.find((r) => r.dataset.go! >= t0);
  if (next) next.before(line);
  else rows[rows.length - 1]?.after(line);
  line.hidden = false;
}

// ---------- updates ----------
function renderAll() {
  renderChrome();
  renderHero();
  renderAllowance();
  renderMonth();
  renderLedger();
}

function setMonth(m: number, scroll = false) {
  const nm = Math.min(11, Math.max(0, m));
  if (nm === state.month && !scroll) {
    placeTrack(false);
    return;
  }
  state.month = nm;
  renderMonth(true);
  if (scroll) $("month").scrollIntoView({ behavior: smooth() });
}
function go(k: string) {
  state.selected = k;
  state.month = toDate(k).getMonth();
  renderMonth(true);
  $("month").scrollIntoView({ behavior: smooth() });
}

// ---------- input ----------
document.addEventListener("click", (ev) => {
  const t = (ev.target as Element).closest<HTMLElement>("button");
  if (!t) return;
  if (t.dataset.month !== undefined) setMonth(+t.dataset.month, t.hasAttribute("data-scroll"));
  else if (t.dataset.go) go(t.dataset.go);
  else if (t.dataset.day) {
    state.selected = t.dataset.day;
    renderMonth();
  } else if (t.id === "pasttoggle") {
    state.showPast = !state.showPast;
    renderLedger();
  } else if (t.id === "mprev") setMonth(state.month - 1);
  else if (t.id === "mnext") setMonth(state.month + 1);
});

$("mtabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  setMonth(state.month + (e.key === "ArrowRight" ? 1 : -1));
  document.querySelector<HTMLElement>(`#mtabs [data-month="${state.month}"]`)?.focus();
});
mhead.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    e.preventDefault();
    setMonth(state.month + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    setMonth(state.month - 1);
  }
});

// Drag or swipe the month name: the track follows the pointer, then snaps
let drag: { x: number; y: number; dx: number; moved: boolean; id: number; target: Element } | null = null;
mhead.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false, id: e.pointerId, target: e.target as Element };
});
mhead.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved) {
    if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
    drag.moved = true;
    mhead.setPointerCapture(e.pointerId);
    mhead.classList.add("dragging");
    mtrack.style.transition = "none";
  }
  const atEdge = (state.month === 0 && dx > 0) || (state.month === 11 && dx < 0);
  drag.dx = atEdge ? dx * 0.25 : dx;
  mtrack.style.transform = `translateX(${baseX + drag.dx}px)`;
});
const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  mhead.classList.remove("dragging");
  mtrack.style.transition = "";
  if (d.moved) {
    if (d.dx < -60 && state.month < 11) setMonth(state.month + 1);
    else if (d.dx > 60 && state.month > 0) setMonth(state.month - 1);
    else placeTrack(false);
  } else {
    const n = d.target.closest<HTMLElement>(".mname");
    if (n && +n.dataset.m! !== state.month) setMonth(+n.dataset.m!);
  }
};
mhead.addEventListener("pointerup", endDrag);
mhead.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", () => placeTrack(true));
document.fonts?.ready.then(() => placeTrack(true));

renderAll();
