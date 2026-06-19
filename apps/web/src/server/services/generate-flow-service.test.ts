import {
  DisabledAiProvider,
  generateFlowInstructions,
  repairFlowInstructions,
  type AiProvider,
  type AiStructuredGenerationRequest,
  type AiStructuredResult,
  type AiTextGenerationRequest,
  type AiTextResult,
  type FlowPlan,
  AiProviderError as ProviderAiProviderError,
} from "@ai-flow-builder/ai";
import { describe, expect, it } from "vitest";
import {
  AiDisabledError,
  AiGeneratedInvalidFlowError,
  PromptTooLargeError,
  TimeoutError,
} from "../errors.js";
import {
  GenerateFlowFromTextService,
  MAX_AI_FLOW_GENERATION_PROMPT_LENGTH,
} from "./generate-flow-service.js";

describe("GenerateFlowFromTextService", () => {
  it("returns a validated draft from the first generated plan", async () => {
    const aiProvider = new RecordingAiProvider([validPlan()]);
    const service = createService(aiProvider);

    const result = await service.generate({
      prompt: "summarize text",
    });

    expect(aiProvider.calls).toHaveLength(1);
    expect(aiProvider.calls[0]).toMatchObject({
      instructions: generateFlowInstructions,
      schemaName: "FlowPlan",
    });
    expect(aiProvider.calls[0]?.input).toContain("<user_request>");
    expect(result).toMatchObject({
      draft: {
        name: "Summarizer",
        description: "Summarizes input text.",
      },
      assumptions: ["A single text input is used."],
      unsupportedRequirements: [],
      warnings: [],
      meta: {
        provider: "recording",
        model: "recording-model",
        promptVersion: "generate-flow-v1",
        attempts: 1,
      },
    });
    expect(result.draft.graph.nodes.map((node) => node.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ]);
    expect(result.draft.graph.edges).toHaveLength(2);
  });

  it("repairs once when the first executable validation fails", async () => {
    const aiProvider = new RecordingAiProvider([
      planWithoutOutput(),
      validPlan(),
    ]);
    const service = createService(aiProvider);

    const result = await service.generate({
      prompt: "summarize text",
    });

    expect(aiProvider.calls).toHaveLength(2);
    expect(aiProvider.calls[1]).toMatchObject({
      instructions: repairFlowInstructions,
      schemaName: "FlowPlan",
    });
    expect(aiProvider.calls[1]?.input).toContain("OUTPUT_NODE_REQUIRED");
    expect(aiProvider.calls[1]?.input).toContain("<repair_context_json>");
    expect(result.meta).toEqual({
      provider: "recording",
      model: "recording-model",
      promptVersion: "generate-flow-v1",
      repairPromptVersion: "repair-flow-v1",
      attempts: 2,
    });
  });

  it("fails with AI_GENERATED_INVALID_FLOW when repair is still invalid", async () => {
    const aiProvider = new RecordingAiProvider([
      planWithoutOutput(),
      planWithoutOutput(),
    ]);
    const service = createService(aiProvider);

    await expect(
      service.generate({
        prompt: "summarize text",
      }),
    ).rejects.toBeInstanceOf(AiGeneratedInvalidFlowError);
    expect(aiProvider.calls).toHaveLength(2);
  });

  it("maps disabled provider to AI_DISABLED", async () => {
    const service = createService(new DisabledAiProvider());

    await expect(
      service.generate({
        prompt: "summarize text",
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("maps provider failures to safe application provider errors", async () => {
    const aiProvider = new RecordingAiProvider([
      new ProviderAiProviderError({
        code: "AI_RATE_LIMITED",
        message: "raw provider rate limit detail",
        provider: "recording",
        model: "recording-model",
        retryable: true,
      }),
    ]);
    const service = createService(aiProvider);

    await expect(
      service.generate({
        prompt: "summarize text",
      }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      message: "The AI provider is rate limited.",
    });
  });

  it("maps AI generation timeouts", async () => {
    const aiProvider = new RecordingAiProvider([
      async (request) =>
        new Promise<FlowPlan>((_, reject) => {
          request.signal.addEventListener(
            "abort",
            () =>
              reject(
                new ProviderAiProviderError({
                  code: "AI_TIMEOUT",
                  message: "provider timed out",
                }),
              ),
            { once: true },
          );
        }),
    ]);
    const service = createService(aiProvider, { timeoutMs: 1 });

    await expect(
      service.generate({
        prompt: "summarize text",
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("validates prompt size and blank prompts before calling the provider", async () => {
    const aiProvider = new RecordingAiProvider([validPlan()]);
    const service = createService(aiProvider);

    await expect(service.generate({ prompt: "   " })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    await expect(
      service.generate({
        prompt: "x".repeat(MAX_AI_FLOW_GENERATION_PROMPT_LENGTH + 1),
      }),
    ).rejects.toBeInstanceOf(PromptTooLargeError);
    expect(aiProvider.calls).toHaveLength(0);
  });
});

type StructuredOutput =
  | FlowPlan
  | ProviderAiProviderError
  | ((request: AiStructuredGenerationRequest<FlowPlan>) => Promise<FlowPlan>);

interface RecordedStructuredCall {
  readonly instructions: string;
  readonly input: string;
  readonly schemaName: string;
}

class RecordingAiProvider implements AiProvider {
  public readonly name = "recording";
  public readonly model = "recording-model";
  public readonly calls: RecordedStructuredCall[] = [];
  private readonly outputs: StructuredOutput[];

  public constructor(outputs: readonly StructuredOutput[]) {
    this.outputs = [...outputs];
  }

  public async generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ): Promise<AiStructuredResult<TValue>> {
    this.calls.push({
      instructions: request.instructions,
      input: request.input,
      schemaName: request.schemaName,
    });

    const output = this.outputs.shift();

    if (output === undefined) {
      throw new Error("No structured output configured.");
    }

    if (output instanceof ProviderAiProviderError) {
      throw output;
    }

    const rawValue =
      typeof output === "function"
        ? await output(request as AiStructuredGenerationRequest<FlowPlan>)
        : output;

    return {
      value: request.schema.parse(rawValue),
      metadata: {
        provider: this.name,
        model: this.model,
      },
    };
  }

  public async generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextResult> {
    void request;
    throw new Error("Text generation is not used by this service.");
  }
}

function createService(
  aiProvider: AiProvider,
  options: { readonly timeoutMs?: number } = {},
): GenerateFlowFromTextService {
  return new GenerateFlowFromTextService({
    aiProvider,
    timeoutMs: options.timeoutMs ?? 1_000,
    idFactory: createIdFactory(),
  });
}

function validPlan(): FlowPlan {
  return {
    title: "Summarizer",
    description: "Summarizes input text.",
    assumptions: ["A single text input is used."],
    unsupportedRequirements: [],
    nodes: [
      {
        ref: "input",
        kind: "core.input.text",
        label: "Text Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
      {
        ref: "template",
        kind: "core.text.template",
        label: "Summary Prompt",
        config: {
          template: "Summarize the following:\n{{input}}",
        },
      },
      {
        ref: "output",
        kind: "core.output.text",
        label: "Summary Output",
        config: {
          key: "result",
          label: "Result",
        },
      },
    ],
    edges: [
      {
        sourceRef: "input",
        sourcePort: "value",
        targetRef: "template",
        targetPort: "input",
      },
      {
        sourceRef: "template",
        sourcePort: "text",
        targetRef: "output",
        targetPort: "value",
      },
    ],
  };
}

function planWithoutOutput(): FlowPlan {
  return {
    title: "Broken Plan",
    description: "No output node.",
    assumptions: [],
    unsupportedRequirements: [],
    nodes: [
      {
        ref: "input",
        kind: "core.input.text",
        label: "Text Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
      {
        ref: "template",
        kind: "core.text.template",
        label: "Template",
        config: {
          template: "{{input}}",
        },
      },
    ],
    edges: [
      {
        sourceRef: "input",
        sourcePort: "value",
        targetRef: "template",
        targetPort: "input",
      },
    ],
  };
}

function createIdFactory(): () => string {
  let index = 1;

  return () => {
    const id = `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
    index += 1;

    return id;
  };
}
