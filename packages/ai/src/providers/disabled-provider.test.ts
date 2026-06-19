import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiProviderError } from "../ai-result.js";
import { DisabledAiProvider } from "./disabled-provider.js";

describe("DisabledAiProvider", () => {
  it("throws AI_DISABLED for text generation", async () => {
    const provider = new DisabledAiProvider();

    await expect(
      provider.generateText({
        prompt: "hello",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_DISABLED",
      message: "AI features are disabled.",
      model: null,
      provider: "disabled",
    });
  });

  it("throws AI_DISABLED for structured generation", async () => {
    const provider = new DisabledAiProvider();

    await expect(
      provider.generateStructured({
        instructions: "Return data.",
        input: "hello",
        schemaName: "Test",
        schema: z.object({ value: z.string() }),
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});
