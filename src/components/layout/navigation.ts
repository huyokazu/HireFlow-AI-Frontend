import type { Href } from 'expo-router';

import type { NavKey } from './Sidebar';

/** Where each sidebar item leads. */
export const NAV_HREFS: Record<NavKey, Href> = {
  dashboard: '/',
  campaigns: '/campaigns',
  candidates: '/candidates',
  agents: '/agents',
  'self-healing': '/self-healing',
  'digital-twin': '/digital-twin',
  analytics: '/analytics',
  settings: '/settings',
};

const NAV_KEYS = Object.keys(NAV_HREFS) as NavKey[];

export function isNavKey(value: string): value is NavKey {
  return (NAV_KEYS as string[]).includes(value);
}

/** The sidebar item a URL path belongs to, or `null` for pages outside the navigation. */
export function navKeyForPath(pathname: string): NavKey | null {
  const [section] = pathname.split('/').filter(Boolean);
  if (!section) return 'dashboard';
  return isNavKey(section) ? section : null;
}
