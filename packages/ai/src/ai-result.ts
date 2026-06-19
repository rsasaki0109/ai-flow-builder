export const aiErrorCodes = [
  "AI_DISABLED",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_AUTHENTICATION_FAILED",
  "AI_REFUSED",
  "AI_INCOMPLETE_OUTPUT",
  "AI_INVALID_STRUCTURED_OUTPUT",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_UNKNOWN_ERROR",
] as const;

export type AiErrorCode = (typeof aiErrorCodes)[number];

export interface AiUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface AiResultMetadata {
  readonly provider: string;
  readonly model: string | null;
  readonly usage?: AiUsage;
}

export interface AiStructuredResult<TValue> {
  readonly value: TValue;
  readonly metadata: AiResultMetadata;
}

export interface AiTextResult {
  readonly text: string;
  readonly metadata: AiResultMetadata;
}

export interface AiProviderErrorOptions {
  readonly code: AiErrorCode;
  readonly message: string;
  readonly retryable?: boolean;
  readonly provider?: string;
  readonly model?: string | null;
  readonly cause?: unknown;
}

export class AiProviderError extends Error {
  public override readonly name = "AiProviderError";
  public readonly code: AiErrorCode;
  public readonly retryable: boolean;
  public readonly provider?: string;
  public readonly model?: string | null;

  public constructor(options: AiProviderErrorOptions) {
    super(
      options.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.code = options.code;
    this.retryable = options.retryable ?? false;

    if (options.provider !== undefined) {
      this.provider = options.provider;
    }

    if (options.model !== undefined) {
      this.model = options.model;
    }
  }
}

export function isAiProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError;
}
