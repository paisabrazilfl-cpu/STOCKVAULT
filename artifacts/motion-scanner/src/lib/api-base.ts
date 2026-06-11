import { setBaseUrl } from "@workspace/api-client-react";

// Where the API server lives, resolved once at module load (this module is
// imported first from main.tsx so it runs before any query fires).
//
// Resolution order:
// 1. VITE_API_BASE_URL — baked in at build time. Set it to a full origin
//    (https://my-api.example.com) to force a host, or to "/" to force
//    same-origin relative requests.
// 2. Same-origin everywhere else. The API service serves this frontend build
//    itself (see api-server/src/app.ts), so on Render the app and the API
//    share one origin and relative /api/... paths just work. Never hardcode
//    a Render host here — service URLs change and a dead host bricks the app.
function resolveApiBaseUrl(): string | null {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    const trimmed = fromEnv.trim().replace(/\/+$/, "");
    return trimmed === "" ? null : trimmed; // "/" → same-origin
  }
  return null;
}

export const API_BASE_URL = resolveApiBaseUrl();

setBaseUrl(API_BASE_URL);

/** Prefix a relative `/api/...` path with the resolved API origin. */
export function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}
