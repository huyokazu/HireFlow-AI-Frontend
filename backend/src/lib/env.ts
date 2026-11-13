import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Server configuration. Read lazily so a missing optional integration never breaks unrelated routes. */
export const env = {
  get supabaseUrl() {
    return required('SUPABASE_URL');
  },
  get supabasePublishableKey() {
    return required('SUPABASE_PUBLISHABLE_KEY');
  },
  get supabaseSecretKey() {
    return required('SUPABASE_SECRET_KEY');
  },
  /** Comma-separated origins allowed to call the API from a browser (Expo web). */
  get corsOrigins(): string[] {
    return (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  },
  /** Shared secret for scheduled jobs (Vercel Cron sends it as a bearer token). */
  get cronSecret() {
    return process.env.CRON_SECRET ?? '';
  },
};
