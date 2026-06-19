import OpenAI from "openai";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  ContentFilterFinishReasonError,
  LengthFinishReasonError,
  RateLimitError,
} from "openai/core/error.js";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ParsedResponse,
  ResponseFormatTextConfig,
} from "openai/resources/responses/responses.js";
import type {
  AiProvider,
  AiStructuredGenerationRequest,
  AiTextGenerationRequest,
} from "../ai-provider.js";
import {
  AiProviderError,
  type AiErrorCode,
  type AiResultMetadata,
  type AiStructuredResult,
  type AiTextResult,
  type AiUsage,
} from "../ai-result.js";

export interface OpenAiProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly client?: OpenAiResponsesClient;
}

export interface OpenAiResponsesClient {
  readonly responses: {
    parse(
      body: OpenAiStructuredResponseRequest,
      options: {
        readonly signal: AbortSignal;
      },
    ): Promise<ParsedOpenAiResponse>;
    create(
      body: {
        readonly model: string;
        readonly instructions?: string;
        readonly input: string;
      },
      options: {
        readonly signal: AbortSignal;
      },
    ): Promise<OpenAiTextResponse>;
  };
}

export interface OpenAiStructuredResponseRequest {
  readonly model: string;
  readonly instructions: string;
  readonly input: string;
  readonly text: {
    readonly format: ResponseFormatTextConfig;
  };
}

export interface ParsedOpenAiResponse {
  readonly output: ParsedResponse<unknown>["output"];
  readonly output_parsed: unknown | null;
  readonly usage?: OpenAiTextResponse["usage"];
}

export interface OpenAiTextResponse {
  readonly output_text?: string;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly total_tokens?: number;
  } | null;
}

export class OpenAiProvider implements AiProvider {
  public readonly name = "openai";
  public readonly model: string;
  private readonly client: OpenAiResponsesClient;

  public constructor(options: OpenAiProviderOptions) {
    this.model = options.model;
    this.client =
      options.client ??
      createOpenAiResponsesClient(
        new OpenAI({
          apiKey: options.apiKey,
        }),
      );
  }

  public async generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ): Promise<AiStructuredResult<TValue>> {
    try {
      const response = await this.client.responses.parse(
        {
          model: this.model,
          instructions: request.instructions,
          input: request.input,
          text: {
            format: zodTextFormat(request.schema, request.schemaName),
          },
        },
        { signal: request.signal },
      );

      if (hasRefusal(response)) {
        throw this.createError({
          code: "AI_REFUSED",
          message: "The AI provider refused the request.",
        });
      }

      if (response.output_parsed === null) {
        throw this.createError({
          code: "AI_INVALID_STRUCTURED_OUTPUT",
          message: "The AI provider did not return parsed structured output.",
        });
      }

      return {
        value: request.schema.parse(response.output_parsed),
        metadata: this.createMetadata(response.usage),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextResult> {
    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          input: request.prompt,
          ...(request.systemPrompt === undefined
            ? {}
            : { instructions: request.systemPrompt }),
        },
        { signal: request.signal },
      );
      const text = response.output_text;

      if (text === undefined || text.length === 0) {
        throw this.createError({
          code: "AI_INCOMPLETE_OUTPUT",
          message: "The AI provider did not return text output.",
        });
      }

      return {
        text,
        metadata: this.createMetadata(response.usage),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private createMetadata(usage: OpenAiTextResponse["usage"]): AiResultMetadata {
    return {
      provider: this.name,
      model: this.model,
      ...(usage === undefined || usage === null
        ? {}
        : { usage: toAiUsage(usage) }),
    };
  }

  private createError(input: {
    readonly code: AiErrorCode;
    readonly message: string;
    readonly retryable?: boolean;
    readonly cause?: unknown;
  }): AiProviderError {
    return new AiProviderError({
      code: input.code,
      message: input.message,
      provider: this.name,
      model: this.model,
      ...(input.retryable === undefined ? {} : { retryable: input.retryable }),
      ...(input.cause === undefined ? {} : { cause: input.cause }),
    });
  }

  private mapError(error: unknown): AiProviderError {
    if (error instanceof AiProviderError) {
      return error;
    }

    if (error instanceof APIUserAbortError) {
      return this.createError({
        code: "AI_TIMEOUT",
        message: "The AI request was aborted.",
        cause: error,
      });
    }

    if (error instanceof APIConnectionTimeoutError) {
      return this.createError({
        code: "AI_TIMEOUT",
        message: "The AI provider request timed out.",
        retryable: true,
        cause: error,
      });
    }

    if (error instanceof AuthenticationError) {
      return this.createError({
        code: "AI_AUTHENTICATION_FAILED",
        message: "The AI provider rejected the configured credentials.",
        cause: error,
      });
    }

    if (error instanceof RateLimitError) {
      return this.createError({
        code: "AI_RATE_LIMITED",
        message: "The AI provider is rate limited.",
        retryable: true,
        cause: error,
      });
    }

    if (error instanceof LengthFinishReasonError) {
      return this.createError({
        code: "AI_INCOMPLETE_OUTPUT",
        message: "The AI provider returned incomplete output.",
        cause: error,
      });
    }

    if (error instanceof ContentFilterFinishReasonError) {
      return this.createError({
        code: "AI_REFUSED",
        message: "The AI provider refused the request.",
        cause: error,
      });
    }

    if (error instanceof APIConnectionError) {
      return this.createError({
        code: "AI_PROVIDER_UNAVAILABLE",
        message: "The AI provider is unavailable.",
        retryable: true,
        cause: error,
      });
    }

    if (error instanceof APIError) {
      if (error.status !== undefined && error.status >= 500) {
        return this.createError({
          code: "AI_PROVIDER_UNAVAILABLE",
          message: "The AI provider is unavailable.",
          retryable: true,
          cause: error,
        });
      }

      return this.createError({
        code: "AI_UNKNOWN_ERROR",
        message: "The AI provider failed.",
        cause: error,
      });
    }

    return this.createError({
      code: "AI_UNKNOWN_ERROR",
      message: "The AI provider failed.",
      cause: error,
    });
  }
}

function toAiUsage(usage: NonNullable<OpenAiTextResponse["usage"]>): AiUsage {
  return {
    ...(usage.input_tokens === undefined
      ? {}
      : { inputTokens: usage.input_tokens }),
    ...(usage.output_tokens === undefined
      ? {}
      : { outputTokens: usage.output_tokens }),
    ...(usage.total_tokens === undefined
      ? {}
      : { totalTokens: usage.total_tokens }),
  };
}

function createOpenAiResponsesClient(sdk: OpenAI): OpenAiResponsesClient {
  return {
    responses: {
      async parse(body, options) {
        return sdk.responses.parse(body, options);
      },
      async create(body, options) {
        return sdk.responses.create(body, options);
      },
    },
  };
}

function hasRefusal(response: ParsedOpenAiResponse): boolean {
  return response.output.some((item) => {
    if (item.type !== "message") {
      return false;
    }

    return item.content.some((content) => content.type === "refusal");
  });
}
