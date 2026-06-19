import {
  createGenerateFlowUserInput,
  createRepairFlowUserInput,
  DisabledAiProvider,
  FakeAiProvider,
  FLOW_PLAN_SCHEMA_NAME,
  flowPlanSchema,
  GENERATE_FLOW_PROMPT_VERSION,
  generateFlowInstructions,
  isAiProviderError,
  normalizeFlowPlan,
  OpenAiProvider,
  REPAIR_FLOW_PROMPT_VERSION,
  repairFlowInstructions,
  FlowPlanNormalizationError,
  type AiProvider,
  type FlowPlan,
  type NormalizedFlowPlan,
} from "@ai-flow-builder/ai";
import {
  validateExecutable,
  type FlowGraph,
  type ValidationIssue,
} from "@ai-flow-builder/flow-core";
import type { AppConfig } from "../config.js";
import {
  AiDisabledError,
  AiGeneratedInvalidFlowError,
  AiProviderError,
  AppError,
  InvalidRequestError,
  PromptTooLargeError,
  TimeoutError,
} from "../errors.js";

export const MAX_AI_FLOW_GENERATION_PROMPT_LENGTH = 4_000;

export interface GenerateFlowFromTextInput {
  readonly prompt: string;
  readonly signal?: AbortSignal;
}

export interface FlowDraft {
  readonly name: string;
  readonly description: string;
  readonly graph: FlowGraph;
}

export interface GenerateFlowFromTextResult {
  readonly draft: FlowDraft;
  readonly assumptions: readonly string[];
  readonly unsupportedRequirements: readonly string[];
  readonly warnings: readonly ValidationIssue[];
  readonly meta: {
    readonly provider: string;
    readonly model: string | null;
    readonly promptVersion: typeof GENERATE_FLOW_PROMPT_VERSION;
    readonly repairPromptVersion?: typeof REPAIR_FLOW_PROMPT_VERSION;
    readonly attempts: 1 | 2;
  };
}

export interface GenerateFlowFromTextServiceOptions {
  readonly aiProvider: AiProvider;
  readonly timeoutMs: number;
  readonly idFactory?: () => string;
}

type EvaluatedFlowPlan =
  | {
      readonly status: "valid";
      readonly normalized: NormalizedFlowPlan;
      readonly warnings: readonly ValidationIssue[];
    }
  | {
      readonly status: "invalid";
      readonly issues: readonly ValidationIssue[];
    };

export class GenerateFlowFromTextService {
  private readonly aiProvider: AiProvider;
  private readonly timeoutMs: number;
  private readonly idFactory: (() => string) | undefined;

  public constructor(options: GenerateFlowFromTextServiceOptions) {
    this.aiProvider = options.aiProvider;
    this.timeoutMs = options.timeoutMs;
    this.idFactory = options.idFactory;
  }

  public async generate(
    input: GenerateFlowFromTextInput,
  ): Promise<GenerateFlowFromTextResult> {
    const prompt = validatePrompt(input.prompt);

    if (this.aiProvider.name === "disabled") {
      throw new AiDisabledError();
    }

    const timeout = createTimeoutAbortController(this.timeoutMs);
    const combinedSignal = combineAbortSignals([
      ...(input.signal === undefined ? [] : [input.signal]),
      timeout.signal,
    ]);

    try {
      const initialPlan = await this.generateInitialPlan(
        prompt,
        combinedSignal.signal,
      );
      const initialEvaluation = this.evaluatePlan(initialPlan);

      if (initialEvaluation.status === "valid") {
        return this.createResult(initialEvaluation, 1);
      }

      const repairedPlan = await this.repairPlan({
        prompt,
        invalidFlowPlan: initialPlan,
        validationIssues: initialEvaluation.issues,
        signal: combinedSignal.signal,
      });
      const repairedEvaluation = this.evaluatePlan(repairedPlan);

      if (repairedEvaluation.status === "valid") {
        return this.createResult(repairedEvaluation, 2);
      }

      throw new AiGeneratedInvalidFlowError(repairedEvaluation.issues);
    } catch (error) {
      throw this.mapError(error, timeout.timedOut);
    } finally {
      timeout.dispose();
      combinedSignal.dispose();
    }
  }

  private async generateInitialPlan(
    prompt: string,
    signal: AbortSignal,
  ): Promise<FlowPlan> {
    const result = await this.aiProvider.generateStructured({
      instructions: generateFlowInstructions,
      input: createGenerateFlowUserInput(prompt),
      schemaName: FLOW_PLAN_SCHEMA_NAME,
      schema: flowPlanSchema,
      signal,
    });

    return result.value;
  }

  private async repairPlan(input: {
    readonly prompt: string;
    readonly invalidFlowPlan: FlowPlan;
    readonly validationIssues: readonly ValidationIssue[];
    readonly signal: AbortSignal;
  }): Promise<FlowPlan> {
    const result = await this.aiProvider.generateStructured({
      instructions: repairFlowInstructions,
      input: createRepairFlowUserInput({
        originalPrompt: input.prompt,
        invalidFlowPlan: input.invalidFlowPlan,
        validationIssues: input.validationIssues,
      }),
      schemaName: FLOW_PLAN_SCHEMA_NAME,
      schema: flowPlanSchema,
      signal: input.signal,
    });

    return result.value;
  }

  private evaluatePlan(plan: FlowPlan): EvaluatedFlowPlan {
    let normalized: NormalizedFlowPlan;

    try {
      normalized = normalizeFlowPlan(plan, {
        ...(this.idFactory === undefined ? {} : { idFactory: this.idFactory }),
      });
    } catch (error) {
      if (error instanceof FlowPlanNormalizationError) {
        return {
          status: "invalid",
          issues: error.issues.map((issue) => ({
            severity: "error",
            code: issue.code,
            message: issue.message,
            ...(issue.path === undefined ? {} : { path: issue.path }),
          })),
        };
      }

      throw error;
    }

    const executableValidation = validateExecutable(normalized.graph);

    if (!executableValidation.valid) {
      return {
        status: "invalid",
        issues: executableValidation.issues,
      };
    }

    return {
      status: "valid",
      normalized,
      warnings: executableValidation.issues.filter(
        (issue) => issue.severity === "warning",
      ),
    };
  }

  private createResult(
    evaluation: Extract<EvaluatedFlowPlan, { readonly status: "valid" }>,
    attempts: 1 | 2,
  ): GenerateFlowFromTextResult {
    return {
      draft: {
        name: evaluation.normalized.name,
        description: evaluation.normalized.description,
        graph: evaluation.normalized.graph,
      },
      assumptions: evaluation.normalized.assumptions,
      unsupportedRequirements: evaluation.normalized.unsupportedRequirements,
      warnings: evaluation.warnings,
      meta: {
        provider: this.aiProvider.name,
        model: this.aiProvider.model,
        promptVersion: GENERATE_FLOW_PROMPT_VERSION,
        ...(attempts === 1
          ? {}
          : { repairPromptVersion: REPAIR_FLOW_PROMPT_VERSION }),
        attempts,
      },
    };
  }

  private mapError(error: unknown, timedOut: boolean): Error {
    if (timedOut) {
      return new TimeoutError("ai_generation");
    }

    if (error instanceof AppError) {
      return error;
    }

    if (isAiProviderError(error)) {
      switch (error.code) {
        case "AI_DISABLED":
          return new AiDisabledError();
        case "AI_TIMEOUT":
          return new TimeoutError("ai_generation");
        case "AI_RATE_LIMITED":
        case "AI_AUTHENTICATION_FAILED":
        case "AI_REFUSED":
        case "AI_INCOMPLETE_OUTPUT":
        case "AI_INVALID_STRUCTURED_OUTPUT":
        case "AI_PROVIDER_UNAVAILABLE":
        case "AI_UNKNOWN_ERROR":
          return new AiProviderError(safeProviderMessage(error.code), error);
      }
    }

    return new AiProviderError("AI flow generation failed.", error);
  }
}

export function createAiProvider(config: AppConfig): AiProvider {
  switch (config.aiProvider) {
    case "disabled":
      return new DisabledAiProvider();
    case "fake":
      return new FakeAiProvider();
    case "openai":
      if (
        config.openAiApiKey === undefined ||
        config.openAiModel === undefined
      ) {
        throw new AiProviderError("OpenAI provider configuration is invalid.");
      }

      return new OpenAiProvider({
        apiKey: config.openAiApiKey,
        model: config.openAiModel,
      });
  }
}

function validatePrompt(prompt: string): string {
  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    throw new InvalidRequestError("Prompt is required.", { field: "prompt" });
  }

  if (prompt.length > MAX_AI_FLOW_GENERATION_PROMPT_LENGTH) {
    throw new PromptTooLargeError(MAX_AI_FLOW_GENERATION_PROMPT_LENGTH);
  }

  return trimmed;
}

function safeProviderMessage(code: string): string {
  switch (code) {
    case "AI_RATE_LIMITED":
      return "The AI provider is rate limited.";
    case "AI_AUTHENTICATION_FAILED":
      return "The AI provider rejected the configured credentials.";
    case "AI_REFUSED":
      return "The AI provider refused to generate a flow.";
    case "AI_INCOMPLETE_OUTPUT":
      return "The AI provider returned incomplete output.";
    case "AI_INVALID_STRUCTURED_OUTPUT":
      return "The AI provider returned invalid structured output.";
    case "AI_PROVIDER_UNAVAILABLE":
      return "The AI provider is unavailable.";
    case "AI_UNKNOWN_ERROR":
    default:
      return "The AI provider failed.";
  }
}

function createTimeoutAbortController(timeoutMs: number): {
  readonly signal: AbortSignal;
  readonly timedOut: boolean;
  dispose(): void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    dispose() {
      clearTimeout(timeoutId);
    },
  };
}

function combineAbortSignals(signals: readonly AbortSignal[]): {
  readonly signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose() {
      for (const signal of signals) {
        signal.removeEventListener("abort", abort);
      }
    },
  };
}
