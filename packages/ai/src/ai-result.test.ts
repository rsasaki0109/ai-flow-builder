import { describe, expect, it } from "vitest";
import {
  AiProviderError,
  aiErrorCodes,
  isAiProviderError,
  type AiErrorCode,
} from "./ai-result.js";

describe("AI result and error types", () => {
  it("exposes the supported provider error code allowlist", () => {
    const codes: readonly AiErrorCode[] = aiErrorCodes;

    expect(codes).toEqual([
      "AI_DISABLED",
      "AI_TIMEOUT",
      "AI_RATE_LIMITED",
      "AI_AUTHENTICATION_FAILED",
      "AI_REFUSED",
      "AI_INCOMPLETE_OUTPUT",
      "AI_INVALID_STRUCTURED_OUTPUT",
      "AI_PROVIDER_UNAVAILABLE",
      "AI_UNKNOWN_ERROR",
    ]);
  });

  it("creates typed provider errors without leaking provider internals", () => {
    const cause = new Error("raw sdk failure");
    const error = new AiProviderError({
      code: "AI_RATE_LIMITED",
      message: "The AI provider is rate limited.",
      provider: "openai",
      model: "gpt-test",
      retryable: true,
      cause,
    });

    expect(isAiProviderError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "AI_RATE_LIMITED",
      message: "The AI provider is rate limited.",
      model: "gpt-test",
      provider: "openai",
      retryable: true,
    });
    expect(error.cause).toBe(cause);
  });
});
