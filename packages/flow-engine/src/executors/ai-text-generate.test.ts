import type {
  AiTextGenerateConfig,
  FlowNode,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  aiTextGenerateExecutor,
  builtInNodeExecutors,
  createExecutorRegistry,
  deterministicNodeExecutors,
  MAX_NODE_OUTPUT_TEXT_LENGTH,
  MissingNodeInputError,
  NodeOutputTooLargeError,
  type FlowExecutionServices,
  type TextGenerationRequest,
} from "../index.js";

describe("AI node executor registry composition", () => {
  it("includes the AI executor in the built-in registry set", () => {
    const registry = createExecutorRegistry(builtInNodeExecutors);

    expect(registry.get("ai.text.generate", 1)).toBe(aiTextGenerateExecutor);
  });

  it("keeps the deterministic registry set free of AI executors", () => {
    const registry = createExecutorRegistry(deterministicNodeExecutors);

    expect(registry.find("ai.text.generate", 1)).toBeNull();
  });
});

describe("aiTextGenerateExecutor", () => {
  it("calls the injected text generation service and returns generated text", async () => {
    const signal = new AbortController().signal;
    const requests: TextGenerationRequest[] = [];
    const result = await aiTextGenerateExecutor.execute({
      inputs: {
        prompt: "Summarize this text.",
      },
      node: aiTextNode({
        systemPrompt: "You are concise.",
      }),
      services: createServices({
        output: "Generated summary",
        requests,
      }),
      signal,
    });

    expect(result).toEqual({
      outputs: {
        text: "Generated summary",
      },
    });
    expect(singleRequest(requests)).toEqual({
      prompt: "Summarize this text.",
      signal,
      systemPrompt: "You are concise.",
    });
  });

  it("omits systemPrompt when the node config does not define one", async () => {
    const signal = new AbortController().signal;
    const requests: TextGenerationRequest[] = [];

    await aiTextGenerateExecutor.execute({
      inputs: {
        prompt: "Write a title.",
      },
      node: aiTextNode({}),
      services: createServices({
        output: "A title",
        requests,
      }),
      signal,
    });

    const request = singleRequest(requests);
    expect(request.prompt).toBe("Write a title.");
    expect(request.signal).toBe(signal);
    expect("systemPrompt" in request).toBe(false);
  });

  it("throws a typed error when the prompt input is missing", async () => {
    await expect(
      aiTextGenerateExecutor.execute({
        inputs: {},
        node: aiTextNode({}),
        services: createServices({
          output: "unused",
          requests: [],
        }),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(MissingNodeInputError);
  });

  it("throws a typed error when generated output exceeds the node output limit", async () => {
    await expect(
      aiTextGenerateExecutor.execute({
        inputs: {
          prompt: "Generate a long answer.",
        },
        node: aiTextNode({}),
        services: createServices({
          output: "x".repeat(MAX_NODE_OUTPUT_TEXT_LENGTH + 1),
          requests: [],
        }),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(NodeOutputTooLargeError);
  });
});

function aiTextNode(
  config: AiTextGenerateConfig,
): FlowNode & { readonly config: AiTextGenerateConfig } {
  return {
    config,
    id: "10000000-0000-4000-8000-000000000004",
    kind: "ai.text.generate",
    label: "AI Generate",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function createServices(input: {
  readonly output: string;
  readonly requests: TextGenerationRequest[];
}): FlowExecutionServices {
  return {
    textGeneration: {
      async generateText(request) {
        input.requests.push(request);

        return {
          text: input.output,
        };
      },
    },
  };
}

function singleRequest(
  requests: readonly TextGenerationRequest[],
): TextGenerationRequest {
  const request = requests[0];

  if (request === undefined) {
    throw new Error("Expected exactly one text generation request.");
  }

  expect(requests).toHaveLength(1);
  return request;
}
