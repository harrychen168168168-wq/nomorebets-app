export const APP_VERSION = '1.1.0';

export const REVENUECAT_IOS_KEY = 'appl_cARPBxsGcMQCnDXFWPDSKMGjWkK';
export const REVENUECAT_ENTITLEMENT_ID = 'NO MORE BETS Pro';
export const MONTHLY_PRODUCT_IDS = ['com.nomorebets.app.monthly'];
export const ANNUAL_PRODUCT_IDS = ['com.nomorebets.app.yearly'];
export const MUTUAL_PRODUCT_IDS = ['com.nomorebets.app.mutual_yearly'];
export const LIFETIME_PRODUCT_IDS = ['com.nomorebets.app.lifetime']; // 非消耗型买断（待 ASC 建 SKU）

export const ADMIN_EMAILS = ['harrychen168168168@gmail.com'];
export const ADMIN_LOCAL_PIN = '168168';

export const GOOGLE_IOS_CLIENT_ID = '564022564634-kvotavoqdnqaf9f98arrom80be6qvi34.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID = '';

export const AI_PROXY_URL = 'https://nomorebets-app.onrender.com/ai/chat';
export const AI_ADDON_10_PRODUCT_ID = 'nomorebets_ai_addon_999';
export const AI_ADDON_5_PRODUCT_ID = 'nomorebets_ai_addon_499'; // $4.99 冲动小包（待 ASC 建 SKU）

export const PRIVACY_POLICY_URL = 'https://nezha2capital.com/privacy';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_EMAIL = 'nomorebets@nezha2capital.com';

declare const process: { env?: Record<string, string | undefined> };

function readEnv(name: string) {
  return process?.env?.[name] || '';
}

// These three are PUBLIC client config (the anon key is safe to ship — it only works through RLS).
// We prefer the EXPO_PUBLIC_* env vars, but hardcode the same public values as a fallback because
// the Codemagic build does not reliably inline them into the bundle (caused a "Missing SUPABASE_URL"
// startup failure on TestFlight). Hardcoding guarantees the client is always configured.
export const SUPABASE_URL = readEnv('EXPO_PUBLIC_SUPABASE_URL') || 'https://ibqmukrxtlimsuvnfrud.supabase.co';
export const SUPABASE_ANON_KEY =
  readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicW11a3J4dGxpbXN1dm5mcnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTM4MjksImV4cCI6MjA5Nzk4OTgyOX0.Awh6C0O4D8Peb8QfXYrS4rzzIWW0w-qeOChnvHV8n2M';
export const SUPABASE_FUNCTIONS_URL =
  readEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL') || 'https://ibqmukrxtlimsuvnfrud.functions.supabase.co';
export const ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS = readEnv('EXPO_PUBLIC_ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS');
