import OpenAI from "openai";
import { lazyOpenAI } from "./lazy-client";

/**
 * Lazy OpenAI client. Validation/construction is deferred to first use so that
 * importing this module never crashes the server when the OpenAI integration
 * isn't provisioned — the rest of the app boots fine and only OpenAI-backed
 * routes fail (clearly) if called without configuration.
 */
export const openai: OpenAI = lazyOpenAI();
