import type { FocusDay } from '../types';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The band this streak is scaled against: 1.5h is the floor a session is
// meant to clear, 5h is the hard stop the timer itself enforces.
const MIN_HOURS = 1.5;
const MAX_HOURS = 5;

// Local calendar date, not `toISOString`'s UTC one — that shifts the date
// by one in any timezone ahead of UTC, which misaligns every day against
// the Mon–Sat labels (the server's focusWeek() makes the same fix).
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday-through-Saturday streak: hours logged each day against the 1.5–5h band. */
export function Streak({ week }: { week: FocusDay[] }) {
  const today = todayIso();

  return (
    <section className="card streak">
      <header>
        <h3>Week</h3>
        <span className="stat">
          {MIN_HOURS}h–{MAX_HOURS}h target
        </span>
      </header>
      <div className="streak-days">
        {week.map((day, i) => {
          const hours = day.minutes / 60;
          const isToday = day.date === today;
          const isFuture = day.date > today;
          const met = hours >= MIN_HOURS;
          const fillPct = Math.min(100, (hours / MAX_HOURS) * 100);
          const minPct = (MIN_HOURS / MAX_HOURS) * 100;

          return (
            <div
              key={day.date}
              className={[
                'streak-day',
                isToday ? 'today' : '',
                isFuture ? 'future' : '',
                !isFuture && met ? 'met' : '',
                !isFuture && !met && hours > 0 ? 'short' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={`${DAY_LABEL[i]} · ${hours.toFixed(1)}h`}
            >
              <div className="streak-bar">
                <span className="streak-min" style={{ bottom: `${minPct}%` }} />
                {!isFuture && <span className="streak-fill" style={{ height: `${fillPct}%` }} />}
              </div>
              <span className="streak-hours">{isFuture ? '·' : hours.toFixed(1)}</span>
              <span className="streak-label">{DAY_LABEL[i]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
