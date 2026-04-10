// ============================================================
// Configuration — TODO: Fill in your values
// ============================================================

const CALENDAR_ID = 'TODO_YOUR_CALENDAR_ID@group.calendar.google.com';
const API_KEY = 'TODO_YOUR_GOOGLE_API_KEY';

// ============================================================
// Fetch and render events
// ============================================================

const eventsContainer = document.getElementById('events-list');

async function fetchEvents() {
  const now = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}` +
    `/events?key=${API_KEY}` +
    `&timeMin=${now}` +
    `&orderBy=startTime` +
    `&singleEvents=true` +
    `&maxResults=20`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    render(data.items || []);
  } catch (err) {
    console.error('Failed to load calendar events:', err);
    eventsContainer.innerHTML =
      '<p class="events-error">Unable to load events. Please check back later.</p>';
  }
}

function render(events) {
  if (events.length === 0) {
    eventsContainer.innerHTML =
      '<p class="events-empty">No upcoming events.</p>';
    return;
  }

  eventsContainer.innerHTML = events.map(event => {
    const start = event.start.dateTime || event.start.date;
    const date = new Date(start);

    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = event.start.dateTime
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'All day';

    const location = event.location
      ? `<p class="event-location">${escapeHTML(event.location)}</p>`
      : '';

    const description = event.description
      ? `<p class="event-description">${escapeHTML(truncate(event.description, 200))}</p>`
      : '';

    return `
      <article class="event">
        <div class="event-date-col">
          <p class="event-date">${month}</p>
          <p class="event-day">${day}</p>
        </div>
        <div class="event-details">
          <p class="event-title">${escapeHTML(event.summary || 'Untitled Event')}</p>
          <p class="event-time">${time}</p>
          ${location}
          ${description}
        </div>
      </article>
    `;
  }).join('');
}

// ============================================================
// Helpers
// ============================================================

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

// ============================================================
// Init
// ============================================================

fetchEvents();
