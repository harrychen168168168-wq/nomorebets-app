export const APP_VERSION = '1.1.0';

export const REVENUECAT_IOS_KEY = 'appl_cARPBxsGcMQCnDXFWPDSKMGjWkK';
export const REVENUECAT_ENTITLEMENT_ID = 'NO MORE BETS Pro';
export const MONTHLY_PRODUCT_IDS = ['com.nomorebets.app.monthly'];
export const ANNUAL_PRODUCT_IDS = ['com.nomorebets.app.yearly'];
export const MUTUAL_PRODUCT_IDS = ['com.nomorebets.app.mutual_yearly'];
export const LIFETIME_PRODUCT_IDS = ['com.nomorebets.app.lifetime']; // 非消耗型买断 · 正常价 $99.99
export const LIFETIME_LAUNCH_PRODUCT_IDS = ['com.nomorebets.app.lifetime_launch']; // 上线促销买断 $79.99（倒计时内显示）

export const ADMIN_EMAILS = ['harrychen168168168@gmail.com'];
export const ADMIN_LOCAL_PIN = '168168';

export const GOOGLE_IOS_CLIENT_ID = '564022564634-kvotavoqdnqaf9f98arrom80be6qvi34.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID = '';

export const AI_PROXY_URL = 'https://nomorebets-app-production.up.railway.app/ai/chat';
export const AI_ADDON_10_PRODUCT_ID = 'nomorebets_ai_addon_999';

// Crash/error reporting. Empty = disabled (no init, zero overhead), so shipping without it is safe.
// To turn it on: create a project at sentry.io → copy its DSN → paste it here.
// This is baked into the JS bundle at build time. OTA could swap it without a new build, but only
// for builds that carry the update channel — set this BEFORE triggering a build, not after.
export const SENTRY_DSN = 'https://7dbc0c3ab83f88d5810d03a4efaa8a51@o4511764605698048.ingest.us.sentry.io/4511764619001856';

export const PRIVACY_POLICY_URL = 'https://nezha2capital.com/privacy';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_EMAIL = 'nomorebets@nezha2capital.com';

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL?: string;
  };
};

// These three are PUBLIC client config (the anon key is safe to ship — it only works through RLS).
// EXPO_PUBLIC_* must be read as a STATIC `process.env.NAME` for Metro to inline it into the bundle;
// a dynamic `process.env[name]` lookup is never replaced (which silently left these empty and made
// the build depend entirely on the hardcoded fallback). We still keep the same public values as a
// fallback so a build without the env vars can't hit the "Missing SUPABASE_URL" startup crash.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ibqmukrxtlimsuvnfrud.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicW11a3J4dGxpbXN1dm5mcnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTM4MjksImV4cCI6MjA5Nzk4OTgyOX0.Awh6C0O4D8Peb8QfXYrS4rzzIWW0w-qeOChnvHV8n2M';
export const SUPABASE_FUNCTIONS_URL =
  process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://ibqmukrxtlimsuvnfrud.functions.supabase.co';
