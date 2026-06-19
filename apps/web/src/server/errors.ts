export type AppErrorCode =
  | "INVALID_REQUEST"
  | "PROMPT_TOO_LARGE"
  | "FLOW_NOT_FOUND"
  | "FLOW_REVISION_CONFLICT"
  | "INVALID_FLOW_DOCUMENT"
  | "FLOW_NOT_EXECUTABLE"
  | "MISSING_FLOW_INPUT"
  | "UNSUPPORTED_FLOW_SCHEMA"
  | "AI_GENERATED_INVALID_FLOW"
  | "UNSUPPORTED_CODEGEN_LANGUAGE"
  | "AI_DISABLED"
  | "AI_PROVIDER_ERROR"
  | "AI_GENERATION_TIMEOUT"
  | "FLOW_RUN_TIMEOUT"
  | "CODE_GENERATION_FAILED"
  | "INTERNAL_ERROR";

export type AppErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: AppErrorDetails;

  public constructor(
    code: AppErrorCode,
    message: string,
    options: { details?: AppErrorDetails; cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "AppError";
    this.code = code;
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export class InvalidRequestError extends AppError {
  public constructor(
    message = "The request is invalid.",
    details?: AppErrorDetails,
  ) {
    super("INVALID_REQUEST", message, details === undefined ? {} : { details });
    this.name = "InvalidRequestError";
  }
}

export class PromptTooLargeError extends AppError {
  public constructor(maxLength: number) {
    super("PROMPT_TOO_LARGE", "The prompt is too large.", {
      details: { maxLength },
    });
    this.name = "PromptTooLargeError";
  }
}

export class FlowNotFoundError extends AppError {
  public constructor(flowId: string) {
    super("FLOW_NOT_FOUND", "The flow was not found.", {
      details: { flowId },
    });
    this.name = "FlowNotFoundError";
  }
}

export class FlowRevisionConflictError extends AppError {
  public constructor(currentRevision: number) {
    super(
      "FLOW_REVISION_CONFLICT",
      "The flow was updated by another request.",
      {
        details: { currentRevision },
      },
    );
    this.name = "FlowRevisionConflictError";
  }
}

export class InvalidFlowDocumentError extends AppError {
  public constructor(issues: readonly unknown[]) {
    super("INVALID_FLOW_DOCUMENT", "The flow document is invalid.", {
      details: { issues },
    });
    this.name = "InvalidFlowDocumentError";
  }
}

export class FlowNotExecutableError extends AppError {
  public constructor(issues: readonly unknown[]) {
    super("FLOW_NOT_EXECUTABLE", "The flow cannot be executed.", {
      details: { issues },
    });
    this.name = "FlowNotExecutableError";
  }
}

export class MissingFlowInputError extends AppError {
  public constructor(key: string) {
    super("MISSING_FLOW_INPUT", "A required flow input is missing.", {
      details: { key },
    });
    this.name = "MissingFlowInputError";
  }
}

export class UnsupportedFlowSchemaError extends AppError {
  public constructor(schemaVersion: unknown) {
    super(
      "UNSUPPORTED_FLOW_SCHEMA",
      "The flow schema version is not supported.",
      {
        details: { schemaVersion },
      },
    );
    this.name = "UnsupportedFlowSchemaError";
  }
}

export class AiGeneratedInvalidFlowError extends AppError {
  public constructor(issues: readonly unknown[]) {
    super("AI_GENERATED_INVALID_FLOW", "The generated flow is invalid.", {
      details: { issues },
    });
    this.name = "AiGeneratedInvalidFlowError";
  }
}

export class UnsupportedCodegenLanguageError extends AppError {
  public constructor(language: string) {
    super(
      "UNSUPPORTED_CODEGEN_LANGUAGE",
      "The code generation language is not supported.",
      {
        details: { language },
      },
    );
    this.name = "UnsupportedCodegenLanguageError";
  }
}

export class AiDisabledError extends AppError {
  public constructor() {
    super("AI_DISABLED", "AI features are disabled.");
    this.name = "AiDisabledError";
  }
}

export class AiProviderError extends AppError {
  public constructor(message = "The AI provider failed.", cause?: unknown) {
    super("AI_PROVIDER_ERROR", message, cause === undefined ? {} : { cause });
    this.name = "AiProviderError";
  }
}

export type TimeoutOperation = "ai_generation" | "flow_run";

export class TimeoutError extends AppError {
  public readonly operation: TimeoutOperation;

  public constructor(operation: TimeoutOperation) {
    super(
      operation === "ai_generation"
        ? "AI_GENERATION_TIMEOUT"
        : "FLOW_RUN_TIMEOUT",
      operation === "ai_generation"
        ? "AI flow generation timed out."
        : "Flow execution timed out.",
      { details: { operation } },
    );
    this.name = "TimeoutError";
    this.operation = operation;
  }
}

export class CodeGenerationFailedError extends AppError {
  public constructor(cause?: unknown) {
    super(
      "CODE_GENERATION_FAILED",
      "Code generation failed.",
      cause === undefined ? {} : { cause },
    );
    this.name = "CodeGenerationFailedError";
  }
}
