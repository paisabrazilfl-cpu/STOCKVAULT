// Whether Clerk-backed multi-tenant auth is active for this deployment.
//
// Auth is enabled when EITHER a real standalone Clerk key is provided, OR we're
// running on a Replit host (where Clerk's `clerk.<host>` proxy is provisioned
// and `publishableKeyFromHost` can derive a working key). On any other host
// (e.g. Render) without a real key, that proxy doesn't exist and Clerk can't
// load — so the app falls back to a single-tenant, no-auth experience instead
// of rendering a blank screen. Set VITE_CLERK_PUBLISHABLE_KEY to a real
// pk_test_/pk_live_ key to turn full multi-tenant auth back on anywhere.
const RAW_CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export const HAS_REAL_CLERK_KEY = !!RAW_CLERK_PK && /^pk_(test|live)_/.test(RAW_CLERK_PK);
export const IS_REPLIT_HOST = /\.(replit\.(dev|app)|repl\.co)$/.test(
  typeof window !== "undefined" ? window.location.hostname : "",
);
export const AUTH_ENABLED = HAS_REAL_CLERK_KEY || IS_REPLIT_HOST;
export const RAW_CLERK_PUBLISHABLE_KEY = RAW_CLERK_PK;
