import type {
  AiProvider,
  AiStructuredGenerationRequest,
  AiTextGenerationRequest,
} from "../ai-provider.js";
import {
  AiProviderError,
  type AiErrorCode,
  type AiProviderErrorOptions,
  type AiStructuredResult,
  type AiTextResult,
} from "../ai-result.js";

export type FakeAiProviderOperation = "structured" | "text";

export type FakeAiProviderFailure =
  | AiProviderError
  | AiErrorCode
  | Omit<AiProviderErrorOptions, "provider" | "model">;

export type FakeAiProviderFailureFactory = (input: {
  readonly operation: FakeAiProviderOperation;
  readonly request:
    | AiStructuredGenerationRequest<unknown>
    | AiTextGenerationRequest;
}) => FakeAiProviderFailure | null | undefined;

export type FakeStructuredValueFactory = <TValue>(
  request: AiStructuredGenerationRequest<TValue>,
) => unknown;

export interface FakeAiProviderOptions {
  readonly model?: string | null;
  readonly textPrefix?: string;
  readonly structuredValue?: unknown | FakeStructuredValueFactory;
  readonly failure?: FakeAiProviderFailure | FakeAiProviderFailureFactory;
}

export class FakeAiProvider implements AiProvider {
  public readonly name = "fake";
  public readonly model: string | null;
  private readonly textPrefix: string;
  private readonly structuredValue: unknown | FakeStructuredValueFactory;
  private readonly failure:
    | FakeAiProviderFailure
    | FakeAiProviderFailureFactory
    | null;

  public constructor(options: FakeAiProviderOptions = {}) {
    this.model = options.model ?? "fake-model";
    this.textPrefix = options.textPrefix ?? "FAKE_AI: ";
    this.structuredValue =
      options.structuredValue ?? createDefaultFlowPlanFixture();
    this.failure = options.failure ?? null;
  }

  public async generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ): Promise<AiStructuredResult<TValue>> {
    this.throwIfAborted(request.signal);
    this.throwConfiguredFailure("structured", request);

    const rawValue =
      typeof this.structuredValue === "function"
        ? this.structuredValue(request)
        : this.structuredValue;
    const parsed = request.schema.safeParse(rawValue);

    if (!parsed.success) {
      throw new AiProviderError({
        code: "AI_INVALID_STRUCTURED_OUTPUT",
        message: "Fake provider structured output did not match the schema.",
        provider: this.name,
        model: this.model,
        cause: parsed.error,
      });
    }

    return {
      value: parsed.data,
      metadata: this.createMetadata(),
    };
  }

  public async generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextResult> {
    this.throwIfAborted(request.signal);
    this.throwConfiguredFailure("text", request);

    return {
      text: `${this.textPrefix}${request.prompt}`,
      metadata: this.createMetadata(),
    };
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) {
      return;
    }

    throw new AiProviderError({
      code: "AI_TIMEOUT",
      message: "The AI request was aborted.",
      provider: this.name,
      model: this.model,
    });
  }

  private throwConfiguredFailure(
    operation: FakeAiProviderOperation,
    request: AiStructuredGenerationRequest<unknown> | AiTextGenerationRequest,
  ): void {
    const failure =
      typeof this.failure === "function"
        ? this.failure({ operation, request })
        : this.failure;

    if (failure === null || failure === undefined) {
      return;
    }

    throw normalizeFailure(failure, this.name, this.model);
  }

  private createMetadata(): {
    readonly provider: string;
    readonly model: string | null;
  } {
    return {
      provider: this.name,
      model: this.model,
    };
  }
}

function normalizeFailure(
  failure: FakeAiProviderFailure,
  provider: string,
  model: string | null,
): AiProviderError {
  if (failure instanceof AiProviderError) {
    return failure;
  }

  if (typeof failure === "string") {
    return new AiProviderError({
      code: failure,
      message: defaultFailureMessage(failure),
      provider,
      model,
    });
  }

  return new AiProviderError({
    ...failure,
    provider,
    model,
  });
}

function defaultFailureMessage(code: AiErrorCode): string {
  switch (code) {
    case "AI_DISABLED":
      return "AI features are disabled.";
    case "AI_TIMEOUT":
      return "The AI request timed out.";
    case "AI_RATE_LIMITED":
      return "The AI provider is rate limited.";
    case "AI_AUTHENTICATION_FAILED":
      return "The AI provider rejected the configured credentials.";
    case "AI_REFUSED":
      return "The AI provider refused the request.";
    case "AI_INCOMPLETE_OUTPUT":
      return "The AI provider returned incomplete output.";
    case "AI_INVALID_STRUCTURED_OUTPUT":
      return "The AI provider returned invalid structured output.";
    case "AI_PROVIDER_UNAVAILABLE":
      return "The AI provider is unavailable.";
    case "AI_UNKNOWN_ERROR":
      return "The AI provider failed.";
  }
}

function createDefaultFlowPlanFixture(): unknown {
  return {
    title: "Fake Text Flow",
    description: "A deterministic fake flow plan.",
    assumptions: ["The fake provider uses a single text input."],
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
        label: "Text Template",
        config: {
          template: "{{input}}",
        },
      },
      {
        ref: "output",
        kind: "core.output.text",
        label: "Text Output",
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
