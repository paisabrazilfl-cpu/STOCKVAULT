import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_BASE_URL,
  DEFAULT_MAX_TOKENS,
  aiExtraBody,
  DEFAULT_REASONING_BUDGET,
} from "../ai-engine";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("ai-engine defaults", () => {
  it("defaults to DeepSeek V4 Pro on NVIDIA NIM", () => {
    expect(DEFAULT_AI_MODEL).toBe("deepseek-ai/deepseek-v4-pro");
    expect(DEFAULT_AI_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
    expect(DEFAULT_MAX_TOKENS).toBe(16384);
  });
});

describe("aiExtraBody", () => {
  it("returns thinking params for deepseek models with thinking enabled", () => {
    expect(aiExtraBody({ model: "deepseek-ai/deepseek-v4-pro", thinking: true })).toEqual({
      chat_template_kwargs: { thinking: true },
    });
  });

  it("returns thinking=false for deepseek models with thinking disabled", () => {
    expect(aiExtraBody({ model: "deepseek-ai/deepseek-v4-pro", thinking: false })).toEqual({
      chat_template_kwargs: { thinking: false },
    });
  });

  it("returns enable_thinking params for nemotron models with thinking enabled", () => {
    expect(aiExtraBody({ model: "nvidia/nemotron-3-ultra-550b-a55b", thinking: true })).toEqual({
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: DEFAULT_REASONING_BUDGET,
    });
  });

  it("returns empty object for nemotron models with thinking disabled", () => {
    expect(aiExtraBody({ model: "nvidia/nemotron-3-ultra-550b-a55b", thinking: false })).toEqual({});
  });

  it("returns empty object for unknown models", () => {
    expect(aiExtraBody({ model: "gpt-4o", thinking: true })).toEqual({});
  });
});
