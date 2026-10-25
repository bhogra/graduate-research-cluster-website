const TZ = 'America/Los_Angeles';

// UW quarters as [month, day] cutoffs (inclusive). Adjust if a quarter shifts.
const TERMS = [
  { name: 'Winter', from: [1, 1],  to: [3, 20] },
  { name: 'Spring', from: [3, 21], to: [6, 13] },
  { name: 'Summer', from: [6, 14], to: [9, 15] },
  { name: 'Autumn', from: [9, 16], to: [12, 31] },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---- Data ---------------------------------------------------------- */

async function loadEvents() {
  const res = await fetch('./events.json', { cache: 'no-cache' });
  const data = await res.json();
  return (data.items || []).map(normalize).sort((a, b) => a.ymd.localeCompare(b.ymd) || a.ms - b.ms);
}

function normalize(raw) {
  const allDay = !raw.start.dateTime;
  const start = allDay ? null : new Date(raw.start.dateTime);
  return {
    id: raw.id,
    title: raw.summary || 'Untitled Event',
    location: raw.location || '',
    allDay,
    start,
    end: allDay ? null : new Date(raw.end.dateTime),
    ms: start ? start.getTime() : 0,
    ymd: allDay ? raw.start.date : ymdOf(start),
    raw,
    ...parseDescription(raw.description || ''),
  };
}

/* ---- Description parsing -------------------------------------------
   Labelled lines in the Google Calendar description:
     Speaker: Dr. Jane Doe
     Readings:
     - Author, Title (Press, Year), chapters 1–3
     About:
     Free text. Anything before the first label is also free text.
--------------------------------------------------------------------- */

const SPEAKER = /^(?:guest\s+)?speakers?\s*:\s*(.*)$/i;
const READING = /^(?:required\s+)?readings?\s*:\s*(.*)$/i;
const ABOUT = /^(?:about|description)\s*:\s*(.*)$/i;
const BULLET = /^(?:[-–•*]|\d+[.)])\s+/;

function parseDescription(html) {
  const lines = htmlToText(html).split('\n').map(l => l.trim());
  let speaker = '', mode = 'body';
  const readings = [], body = [];

  lines.forEach((line, i) => {
    let m;
    if ((m = line.match(SPEAKER))) { speaker = m[1]; mode = 'body'; return; }
    if ((m = line.match(READING))) { mode = 'reading'; if (m[1]) readings.push(m[1]); return; }
    if ((m = line.match(ABOUT))) { mode = 'body'; if (m[1]) body.push(m[1]); return; }
    if (mode === 'reading') {
      if (line) readings.push(line.replace(BULLET, ''));
      // A blank line ends the list unless the next line is another bullet.
      else if (!BULLET.test(lines.slice(i + 1).find(Boolean) || '')) mode = 'body';
      return;
    }
    body.push(line);
  });

  return {
    speaker,
    readings,
    body: body.join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
  };
}

function htmlToText(s) {
  if (!/<[a-z\/]/i.test(s)) return s;
  s = s.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|ul|ol|h\d)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    // Keep link targets as [label](url) so they survive tag stripping.
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      return label && label !== href ? `[${label}](${href})` : href;
    })
    .replace(/<[^>]+>/g, '');
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value.replace(/ /g, ' ');
}

/* ---- Dates ---------------------------------------------------------- */

const ymdOf = date => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const fmtTime = date => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(date);
const pad = n => String(n).padStart(2, '0');

// All-day events carry a plain YYYY-MM-DD, so build a local date from it
// rather than parsing it as UTC midnight.
function fmtDate(ev, opts) {
  if (ev.allDay) {
    const [y, m, d] = ev.ymd.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', opts).format(new Date(y, m - 1, d));
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(ev.start);
}

function timeRange(ev) {
  if (ev.allDay) return 'All day';
  let s = fmtTime(ev.start);
  const e = fmtTime(ev.end);
  if (s.slice(-2) === e.slice(-2)) s = s.slice(0, -3);
  return `${s}–${e}`;
}

function termFor(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const md = m * 100 + d;
  const t = TERMS.find(t => md >= t.from[0] * 100 + t.from[1] && md <= t.to[0] * 100 + t.to[1]);
  return { key: `${y}-${t.name}`, label: `${t.name} Quarter ${y}` };
}

/* ---- Rendering helpers ---------------------------------------------- */

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Escape, then turn [label](url) and bare URLs into links.
function inline(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+?)(?=[.,;:!?)]*(?:\s|$))/g, (_, label, href, bare) =>
      `<a href="${href || bare}" target="_blank" rel="noopener noreferrer">${label || bare}</a>`)
    .replace(/\n/g, '<br>');
}

const eventUrl = ev => `./event.html?id=${encodeURIComponent(ev.id)}`;

function addToCalUrl(ev) {
  const stamp = d => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dates = ev.allDay
    ? `${ev.ymd.replace(/-/g, '')}/${ev.raw.end.date.replace(/-/g, '')}`
    : `${stamp(ev.start)}/${stamp(ev.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title, dates, location: ev.location,
    details: htmlToText(ev.raw.description || ''),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/* ---- Index page: month calendar + this quarter's list --------------- */

function initIndex(events) {
  const today = ymdOf(new Date());
  const byDay = {};
  for (const ev of events) (byDay[ev.ymd] ||= []).push(ev);

  const calendarEl = document.getElementById('calendar');
  const view = { year: +today.slice(0, 4), month: +today.slice(5, 7) };
  const draw = () => { calendarEl.innerHTML = renderCalendar(view, byDay, today); };

  calendarEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    view.month += +btn.dataset.nav;
    if (view.month < 1) { view.month = 12; view.year--; }
    if (view.month > 12) { view.month = 1; view.year++; }
    draw();
  });
  draw();

  const term = termFor(today);
  document.getElementById('term-label').textContent = term.label;
  const upcoming = events.filter(ev => ev.ymd >= today);
  const inTerm = upcoming.filter(ev => termFor(ev.ymd).key === term.key);
  document.getElementById('events-list').innerHTML = inTerm.length
    ? inTerm.map(renderListItem).join('')
    : `<p class="events-empty">No more events scheduled for ${term.label}.${upcoming[0]
        ? ` Next up: <a href="${eventUrl(upcoming[0])}">${esc(upcoming[0].title)}</a>, ${fmtDate(upcoming[0], { month: 'long', day: 'numeric' })}.`
        : ''}</p>`;
}

function renderCalendar({ year, month }, byDay, today) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = WEEKDAYS.map(w => `<div class="calendar-weekday">${w}</div>`);

  for (let i = 0; i < first.getDay(); i++) cells.push('<div class="calendar-day calendar-day--empty"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${pad(month)}-${pad(d)}`;
    const cls = ymd < today ? ' calendar-day--past' : ymd === today ? ' calendar-day--today' : '';
    const links = (byDay[ymd] || []).map(ev =>
      `<a class="calendar-event" href="${eventUrl(ev)}" title="${esc(ev.title)}"><span>${esc(ev.title)}</span></a>`).join('');
    cells.push(`<div class="calendar-day${cls}"><span class="calendar-day-number">${d}</span>${links}</div>`);
  }
  while (cells.length % 7) cells.push('<div class="calendar-day calendar-day--empty"></div>');

  return `
    <div class="calendar-head">
      <h2 class="calendar-month">${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
      <div class="calendar-nav">
        <button type="button" data-nav="-1" aria-label="Previous month">&larr;</button>
        <button type="button" data-nav="1" aria-label="Next month">&rarr;</button>
      </div>
    </div>
    <div class="calendar-grid">${cells.join('')}</div>`;
}

function renderListItem(ev) {
  const when = [fmtDate(ev, { weekday: 'long' }), timeRange(ev), ev.location].filter(Boolean).map(esc).join(' · ');
  return `
    <article class="event">
      <div class="event-date-col">
        <p class="event-date">${MONTHS[+ev.ymd.slice(5, 7) - 1]}</p>
        <p class="event-day">${+ev.ymd.slice(8)}</p>
      </div>
      <div class="event-details">
        <p class="event-title"><a href="${eventUrl(ev)}">${esc(ev.title)}</a></p>
        ${ev.speaker ? `<p class="event-speaker">${esc(ev.speaker)}</p>` : ''}
        <p class="event-time">${when}</p>
        <a class="event-more" href="${eventUrl(ev)}">Details and readings</a>
      </div>
    </article>`;
}

/* ---- Event page ----------------------------------------------------- */

function initEventPage(events) {
  const el = document.getElementById('event-page');
  const ev = events.find(e => e.id === new URLSearchParams(location.search).get('id'));
  if (!ev) {
    el.innerHTML = `<a class="back-link" href="./">All events</a>
      <h1 class="event-page-title">Event not found</h1>
      <p class="events-empty">This event may have passed or been removed from the calendar.</p>`;
    return;
  }

  document.title = `${ev.title} · Technologies of Settler Governance and Global Indigenous Response`;
  const tzName = ev.allDay ? '' : ' ' + new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' })
    .formatToParts(ev.start).find(p => p.type === 'timeZoneName').value;

  const meta = [
    ['Speaker', ev.speaker && inline(ev.speaker)],
    ['Date', esc(fmtDate(ev, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))],
    ['Time', esc(timeRange(ev) + tzName)],
    ['Location', ev.location && inline(ev.location)],
  ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  el.innerHTML = `
    <a class="back-link" href="./">All events</a>
    <p class="section-label section-label--plain">${termFor(ev.ymd).label}</p>
    <h1 class="event-page-title">${esc(ev.title)}</h1>
    <dl class="event-meta">${meta}</dl>
    ${ev.readings.length ? `
      <section class="event-section">
        <h2 class="event-section-title">Required Reading</h2>
        <ol class="reading-list">${ev.readings.map(r => `<li><span>${inline(r)}</span></li>`).join('')}</ol>
      </section>` : ''}
    ${ev.body.length ? `
      <section class="event-section">
        <h2 class="event-section-title">About</h2>
        <div class="event-body">${ev.body.map(p => `<p>${inline(p)}</p>`).join('')}</div>
      </section>` : ''}
    <a class="event-add-cal" href="${addToCalUrl(ev)}" target="_blank" rel="noopener noreferrer">+ Add to Google Calendar</a>`;
}

/* ---- Boot ----------------------------------------------------------- */

loadEvents()
  .then(events => document.getElementById('event-page') ? initEventPage(events) : initIndex(events))
  .catch(err => {
    console.error('Failed to load events:', err);
    const msg = '<p class="events-error">Unable to load events. Please check back later.</p>';
    for (const id of ['calendar', 'events-list', 'event-page']) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = id === 'calendar' ? '' : msg;
    }
  });
