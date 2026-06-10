import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_BASE_URL,
  DEFAULT_MAX_TOKENS,
  isReasoningModel,
  reasoningParams,
} from "../ai-engine";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("ai-engine defaults", () => {
  it("defaults to Nemotron 3 Ultra on NVIDIA NIM", () => {
    expect(DEFAULT_AI_MODEL).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    expect(DEFAULT_AI_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
    expect(DEFAULT_MAX_TOKENS).toBe(16384);
  });
});

describe("isReasoningModel", () => {
  it("detects nemotron family models", () => {
    expect(isReasoningModel("nvidia/nemotron-3-ultra-550b-a55b")).toBe(true);
    expect(isReasoningModel("nvidia/nemotron-3-super-120b-a12b")).toBe(true);
  });

  it("rejects non-thinking models", () => {
    expect(isReasoningModel("minimaxai/minimax-m2.7")).toBe(false);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });
});

describe("reasoningParams", () => {
  it("returns thinking params for nemotron models", () => {
    expect(reasoningParams("nvidia/nemotron-3-ultra-550b-a55b")).toEqual({
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 16384,
    });
  });

  it("returns empty object for non-thinking models", () => {
    expect(reasoningParams("minimaxai/minimax-m2.7")).toEqual({});
  });

  it("can be disabled via AI_ENABLE_THINKING=false", () => {
    process.env.AI_ENABLE_THINKING = "false";
    expect(reasoningParams("nvidia/nemotron-3-ultra-550b-a55b")).toEqual({});
  });
});
