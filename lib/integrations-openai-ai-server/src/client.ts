import OpenAI from "openai";
import { lazyOpenAI } from "./lazy-client";

/**
 * Lazy OpenAI client. Validation/construction is deferred to first use so that
 * importing this module never crashes the server when the OpenAI integration
 * isn't provisioned — the rest of the app boots fine and only OpenAI-backed
 * routes fail (clearly) if called without configuration.
 */
export const openai: OpenAI = lazyOpenAI();

/**
 * Construct an OpenAI-compatible client from explicit config. Used for
 * per-tenant AI engine keys (e.g. a user's own NVIDIA NIM / OpenAI key entered
 * in Settings) instead of the server-wide env-based singleton above.
 */
export function createOpenAIClient(opts: { apiKey: string; baseURL: string }): OpenAI {
  return new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
}
