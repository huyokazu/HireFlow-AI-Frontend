/**
 * Build-time settings. Expo inlines `EXPO_PUBLIC_*` variables only when they are read with a static
 * `process.env.NAME`, so each one is spelled out here.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * The app talks to the HireFlow API (sign-in, live data, Realtime) only when all three are set.
 * Otherwise it runs on the built-in mock data with no sign-in, so a demo works with no backend.
 */
export const apiEnabled = Boolean(
  process.env.EXPO_PUBLIC_API_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** Shows the "Use demo account" helper on the sign-in screen. */
export const demoLoginEnabled = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_DEMO_LOGIN === '1';

/** The seeded demo user (see the backend seed). Not a secret: it only exists in demo databases. */
export const DEMO_ACCOUNT = { email: 'demo@hireflow.local', password: 'hireflow-demo-2026' };
