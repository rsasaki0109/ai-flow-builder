import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiProviderError } from "../ai-result.js";
import { flowPlanSchema } from "../flow-plan-schema.js";
import { assertAiProviderContract } from "../testing/ai-provider-contract.js";
import { FakeAiProvider } from "./fake-provider.js";

const signal = new AbortController().signal;

describe("FakeAiProvider", () => {
  it("passes the shared provider contract with injected structured output", async () => {
    await assertAiProviderContract({
      createProvider: () =>
        new FakeAiProvider({
          structuredValue: { value: "STRUCTURED: summarize" },
        }),
      expectedName: "fake",
      expectedModel: "fake-model",
      text: {
        prompt: "hello",
        expectedText: "FAKE_AI: hello",
      },
      structured: {
        instructions: "Return data.",
        input: "summarize",
        schemaName: "Echo",
        schema: z.object({ value: z.string() }).strict(),
        expectedValue: { value: "STRUCTURED: summarize" },
      },
    });
  });

  it("returns deterministic text with configurable prefix and model", async () => {
    const provider = new FakeAiProvider({
      model: "fake-test-model",
      textPrefix: "TEST: ",
    });

    await expect(
      provider.generateText({
        prompt: "Generate summary.",
        signal,
      }),
    ).resolves.toEqual({
      text: "TEST: Generate summary.",
      metadata: {
        provider: "fake",
        model: "fake-test-model",
      },
    });
  });

  it("returns the default deterministic flow-plan-like structured fixture", async () => {
    const provider = new FakeAiProvider();

    const result = await provider.generateStructured({
      instructions: "Create a flow.",
      input: "echo input",
      schemaName: "FlowPlan",
      schema: flowPlanSchema,
      signal,
    });

    expect(result.value).toMatchObject({
      title: "Fake Text Flow",
      nodes: [
        { ref: "input", kind: "core.input.text" },
        { ref: "template", kind: "core.text.template" },
        { ref: "output", kind: "core.output.text" },
      ],
    });
  });

  it("supports operation-specific injected failures", async () => {
    const provider = new FakeAiProvider({
      failure: ({ operation }) =>
        operation === "text"
          ? {
              code: "AI_RATE_LIMITED",
              message: "Injected rate limit.",
              retryable: true,
            }
          : null,
    });

    await expect(
      provider.generateText({
        prompt: "hello",
        signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      message: "Injected rate limit.",
      retryable: true,
    });

    await expect(
      provider.generateStructured({
        instructions: "Return data.",
        input: "hello",
        schemaName: "Data",
        schema: z.object({ title: z.string() }).passthrough(),
        signal,
      }),
    ).resolves.toMatchObject({
      metadata: {
        provider: "fake",
      },
    });
  });

  it("maps aborted signals to AI_TIMEOUT", async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new FakeAiProvider();

    await expect(
      provider.generateText({
        prompt: "hello",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_TIMEOUT",
    });
  });

  it("throws AI_INVALID_STRUCTURED_OUTPUT when the fixture fails schema validation", async () => {
    const provider = new FakeAiProvider({
      structuredValue: { invalid: true },
    });

    await expect(
      provider.generateStructured({
        instructions: "Return data.",
        input: "hello",
        schemaName: "Data",
        schema: z.object({ value: z.string() }).strict(),
        signal,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
    await expect(
      provider.generateStructured({
        instructions: "Return data.",
        input: "hello",
        schemaName: "Data",
        schema: z.object({ value: z.string() }).strict(),
        signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_INVALID_STRUCTURED_OUTPUT",
    });
  });
});
