import { describe, expect, it } from "vitest";
import { z } from "zod";
import type {
  AiProvider,
  AiStructuredGenerationRequest,
  AiTextGenerationRequest,
} from "./ai-provider.js";
import { assertAiProviderContract } from "./testing/ai-provider-contract.js";

describe("assertAiProviderContract", () => {
  it("validates the shared provider contract against a provider implementation", async () => {
    const provider = new EchoProvider();

    await assertAiProviderContract({
      createProvider: () => provider,
      expectedName: "echo",
      expectedModel: "echo-model",
      text: {
        prompt: "hello",
        systemPrompt: "Be direct.",
        expectedText: "TEXT: hello",
      },
      structured: {
        instructions: "Return a plan.",
        input: "summarize",
        schemaName: "EchoObject",
        schema: z.object({ value: z.string() }).strict(),
        expectedValue: { value: "STRUCTURED: summarize" },
      },
    });

    expect(provider.textRequests).toHaveLength(1);
    expect(provider.textRequests[0]).toMatchObject({
      prompt: "hello",
      systemPrompt: "Be direct.",
    });
    expect(provider.structuredRequests).toHaveLength(1);
    expect(provider.structuredRequests[0]).toMatchObject({
      instructions: "Return a plan.",
      input: "summarize",
      schemaName: "EchoObject",
    });
  });
});

class EchoProvider implements AiProvider {
  public readonly name = "echo";
  public readonly model = "echo-model";
  public readonly textRequests: AiTextGenerationRequest[] = [];
  public readonly structuredRequests: AiStructuredGenerationRequest<unknown>[] =
    [];

  public async generateText(request: AiTextGenerationRequest) {
    this.textRequests.push(request);

    return {
      text: `TEXT: ${request.prompt}`,
      metadata: {
        provider: this.name,
        model: this.model,
      },
    };
  }

  public async generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ) {
    this.structuredRequests.push(request);

    return {
      value: request.schema.parse({
        value: `STRUCTURED: ${request.input}`,
      }),
      metadata: {
        provider: this.name,
        model: this.model,
      },
    };
  }
}
