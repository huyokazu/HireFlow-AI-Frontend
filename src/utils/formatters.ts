import type { Dictionary } from '../i18n/en';

/** "Amelia Chen" → "AC", "Cher" → "C". */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** "just now", "12 min ago", "3 h ago", "2 d ago" — in the dictionary's language. */
export function formatRelativeTime(
  isoTimestamp: string,
  labels: Dictionary['time'],
  now: number = Date.now(),
): string {
  const minutes = Math.floor((now - new Date(isoTimestamp).getTime()) / 60_000);
  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.hoursAgo(hours);
  return labels.daysAgo(Math.floor(hours / 24));
}
