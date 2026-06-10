import { setBaseUrl } from "@workspace/api-client-react";

// Where the API server lives, resolved once at module load (this module is
// imported first from main.tsx so it runs before any query fires).
//
// Resolution order:
// 1. VITE_API_BASE_URL — baked in at build time. Set it to a full origin
//    (https://my-api.example.com) to force a host, or to "/" to force
//    same-origin relative requests.
// 2. On *.onrender.com the static site has no same-origin /api proxy (the
//    API is a separate Render service), so default to the live API host.
// 3. Anywhere else (Replit dev, local vite + proxy) use same-origin paths.
const RENDER_API_HOST = "https://stockvault-5qjg.onrender.com";

function resolveApiBaseUrl(): string | null {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    const trimmed = fromEnv.trim().replace(/\/+$/, "");
    return trimmed === "" ? null : trimmed; // "/" → same-origin
  }
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".onrender.com")
  ) {
    return RENDER_API_HOST;
  }
  return null;
}

export const API_BASE_URL = resolveApiBaseUrl();

setBaseUrl(API_BASE_URL);

/** Prefix a relative `/api/...` path with the resolved API origin. */
export function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}
