import OpenAI from "openai";

let cached: OpenAI | null = null;

/** Construct + validate the real client on first use (throws only then). */
function build(): OpenAI {
  if (cached) return cached;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  cached = new OpenAI({ apiKey, baseURL });
  return cached;
}

/**
 * Returns an `OpenAI`-typed proxy that builds the underlying client on first
 * property access. Importing it never touches env, so a missing integration
 * doesn't crash the process at module load.
 */
export function lazyOpenAI(): OpenAI {
  return new Proxy({} as OpenAI, {
    get(_target, prop, receiver) {
      const client = build();
      const value = Reflect.get(client as object, prop, receiver);
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
    },
  });
}
