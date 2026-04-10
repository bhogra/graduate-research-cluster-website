const eventsContainer = document.getElementById('events-list');

async function fetchEvents() {
  try {
    const res = await fetch('./events.json');
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    render(data.items || []);
  } catch (err) {
    console.error('Failed to load events:', err);
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

    const addToCalUrl = buildAddToCalUrl(event);

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
          <a class="event-add-cal" href="${addToCalUrl}" target="_blank" rel="noopener noreferrer">+ Add to Google Calendar</a>
        </div>
      </article>
    `;
  }).join('');
}

function buildAddToCalUrl(event) {
  const fmt = (dt) => dt.replace(/[-:]/g, '').replace('.000', '');
  const start = event.start.dateTime
    ? fmt(event.start.dateTime)
    : event.start.date.replace(/-/g, '');
  const end = event.end.dateTime
    ? fmt(event.end.dateTime)
    : event.end.date.replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary || '',
    dates: `${start}/${end}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

fetchEvents();
