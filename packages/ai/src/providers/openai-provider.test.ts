import { RateLimitError } from "openai/core/error.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiProviderError } from "../ai-result.js";
import {
  OpenAiProvider,
  type OpenAiResponsesClient,
  type ParsedOpenAiResponse,
} from "./openai-provider.js";

describe("OpenAiProvider", () => {
  it("generates text through the Responses API without exposing SDK types", async () => {
    const client = createClient({
      create: async (body, options) => {
        expect(body).toEqual({
          model: "gpt-test",
          instructions: "Be concise.",
          input: "Summarize this.",
        });
        expect(options.signal.aborted).toBe(false);

        return {
          output_text: "Summary",
          usage: {
            input_tokens: 5,
            output_tokens: 2,
            total_tokens: 7,
          },
        };
      },
    });
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client,
    });

    await expect(
      provider.generateText({
        prompt: "Summarize this.",
        systemPrompt: "Be concise.",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      text: "Summary",
      metadata: {
        provider: "openai",
        model: "gpt-test",
        usage: {
          inputTokens: 5,
          outputTokens: 2,
          totalTokens: 7,
        },
      },
    });
  });

  it("generates structured output through responses.parse and validates with the caller schema", async () => {
    const schema = z.object({ value: z.string() }).strict();
    const client = createClient({
      parse: async (body, options) => {
        expect(body.model).toBe("gpt-test");
        expect(body.instructions).toBe("Return JSON.");
        expect(body.input).toBe("source");
        expect(body.text.format).toBeTruthy();
        expect(options.signal.aborted).toBe(false);

        return parsedResponse({ value: "parsed" });
      },
    });
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client,
    });

    await expect(
      provider.generateStructured({
        instructions: "Return JSON.",
        input: "source",
        schemaName: "TestSchema",
        schema,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      value: { value: "parsed" },
      metadata: {
        provider: "openai",
        model: "gpt-test",
      },
    });
  });

  it("maps explicit refusals from parsed responses", async () => {
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client: createClient({
        parse: async () => refusalResponse(),
      }),
    });

    await expect(
      provider.generateStructured({
        instructions: "Return JSON.",
        input: "source",
        schemaName: "TestSchema",
        schema: z.object({ value: z.string() }).strict(),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_REFUSED",
      provider: "openai",
      model: "gpt-test",
    });
  });

  it("maps absent parsed output to AI_INVALID_STRUCTURED_OUTPUT", async () => {
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client: createClient({
        parse: async () => parsedResponse(null),
      }),
    });

    await expect(
      provider.generateStructured({
        instructions: "Return JSON.",
        input: "source",
        schemaName: "TestSchema",
        schema: z.object({ value: z.string() }).strict(),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_INVALID_STRUCTURED_OUTPUT",
    });
  });

  it("maps provider rate limits to retryable typed errors", async () => {
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client: createClient({
        create: async () => {
          throw new RateLimitError(
            429,
            { error: { message: "rate limit" } },
            "rate limit",
            new Headers(),
          );
        },
      }),
    });

    await expect(
      provider.generateText({
        prompt: "hello",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      retryable: true,
    });
  });

  it("maps empty text responses to AI_INCOMPLETE_OUTPUT", async () => {
    const provider = new OpenAiProvider({
      apiKey: "test-key",
      model: "gpt-test",
      client: createClient({
        create: async () => ({
          output_text: "",
        }),
      }),
    });

    await expect(
      provider.generateText({
        prompt: "hello",
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
    await expect(
      provider.generateText({
        prompt: "hello",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      code: "AI_INCOMPLETE_OUTPUT",
    });
  });
});

function createClient(overrides: {
  readonly parse?: OpenAiResponsesClient["responses"]["parse"];
  readonly create?: OpenAiResponsesClient["responses"]["create"];
}): OpenAiResponsesClient {
  return {
    responses: {
      async parse(body, options) {
        if (overrides.parse === undefined) {
          return parsedResponse(null);
        }

        return overrides.parse(body, options);
      },
      async create(body, options) {
        if (overrides.create === undefined) {
          return { output_text: "unused" };
        }

        return overrides.create(body, options);
      },
    },
  };
}

function parsedResponse(value: unknown | null): ParsedOpenAiResponse {
  return {
    output: [],
    output_parsed: value,
  };
}

function refusalResponse(): ParsedOpenAiResponse {
  return {
    output_parsed: null,
    output: [
      {
        type: "message",
        content: [
          {
            type: "refusal",
            refusal: "Cannot comply.",
          },
        ],
      },
    ],
  } as ParsedOpenAiResponse;
}
