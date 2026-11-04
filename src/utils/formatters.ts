/** "Amelia Chen" → "AC", "Cher" → "C". */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export function formatYearsOfExperience(years: number): string {
  return years === 1 ? '1 yr experience' : `${years} yrs experience`;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function formatRelativeTime(isoTimestamp: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(isoTimestamp).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Wednesday, November 4". Always English, whatever the device locale. */
export function formatLongDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
