import type { ErrorResponse } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  AiDisabledError,
  AiGeneratedInvalidFlowError,
  AiProviderError,
  AppError,
  CodeGenerationFailedError,
  FlowNotExecutableError,
  FlowNotFoundError,
  FlowRevisionConflictError,
  InvalidFlowDocumentError,
  InvalidRequestError,
  MissingFlowInputError,
  PromptTooLargeError,
  TimeoutError,
  UnsupportedCodegenLanguageError,
  UnsupportedFlowSchemaError,
} from "../errors.js";
import { errorResponse, mapErrorToHttp } from "./error-mapper.js";

const REQUEST_ID = "10000000-0000-4000-8000-000000000001";

interface ErrorCase {
  name: string;
  error: Error;
  status: number;
  code: string;
  details?: Record<string, unknown>;
}

const issue = {
  severity: "error",
  code: "TEST",
  message: "Test issue",
};

describe("mapErrorToHttp", () => {
  it.each<ErrorCase>([
    {
      name: "InvalidRequestError",
      error: new InvalidRequestError("Bad request", { field: "name" }),
      status: 400,
      code: "INVALID_REQUEST",
      details: { field: "name" },
    },
    {
      name: "PromptTooLargeError",
      error: new PromptTooLargeError(4_000),
      status: 413,
      code: "PROMPT_TOO_LARGE",
      details: { maxLength: 4_000 },
    },
    {
      name: "FlowNotFoundError",
      error: new FlowNotFoundError("10000000-0000-4000-8000-000000000010"),
      status: 404,
      code: "FLOW_NOT_FOUND",
      details: { flowId: "10000000-0000-4000-8000-000000000010" },
    },
    {
      name: "FlowRevisionConflictError",
      error: new FlowRevisionConflictError(5),
      status: 409,
      code: "FLOW_REVISION_CONFLICT",
      details: { currentRevision: 5 },
    },
    {
      name: "InvalidFlowDocumentError",
      error: new InvalidFlowDocumentError([issue]),
      status: 422,
      code: "INVALID_FLOW_DOCUMENT",
      details: { issues: [issue] },
    },
    {
      name: "FlowNotExecutableError",
      error: new FlowNotExecutableError([issue]),
      status: 422,
      code: "FLOW_NOT_EXECUTABLE",
      details: { issues: [issue] },
    },
    {
      name: "MissingFlowInputError",
      error: new MissingFlowInputError("input"),
      status: 422,
      code: "MISSING_FLOW_INPUT",
      details: { key: "input" },
    },
    {
      name: "UnsupportedFlowSchemaError",
      error: new UnsupportedFlowSchemaError(2),
      status: 422,
      code: "UNSUPPORTED_FLOW_SCHEMA",
      details: { schemaVersion: 2 },
    },
    {
      name: "AiGeneratedInvalidFlowError",
      error: new AiGeneratedInvalidFlowError([issue]),
      status: 422,
      code: "AI_GENERATED_INVALID_FLOW",
      details: { issues: [issue] },
    },
    {
      name: "UnsupportedCodegenLanguageError",
      error: new UnsupportedCodegenLanguageError("python"),
      status: 400,
      code: "UNSUPPORTED_CODEGEN_LANGUAGE",
      details: { language: "python" },
    },
    {
      name: "AiDisabledError",
      error: new AiDisabledError(),
      status: 503,
      code: "AI_DISABLED",
    },
    {
      name: "AiProviderError",
      error: new AiProviderError(),
      status: 502,
      code: "AI_PROVIDER_ERROR",
    },
    {
      name: "TimeoutError ai_generation",
      error: new TimeoutError("ai_generation"),
      status: 504,
      code: "AI_GENERATION_TIMEOUT",
      details: { operation: "ai_generation" },
    },
    {
      name: "TimeoutError flow_run",
      error: new TimeoutError("flow_run"),
      status: 504,
      code: "FLOW_RUN_TIMEOUT",
      details: { operation: "flow_run" },
    },
    {
      name: "CodeGenerationFailedError",
      error: new CodeGenerationFailedError(),
      status: 500,
      code: "CODE_GENERATION_FAILED",
    },
  ])("maps $name", ({ error, status, code, details }) => {
    const mapped = mapErrorToHttp(error, REQUEST_ID);

    expect(mapped.status).toBe(status);
    expect(mapped.body.error).toEqual({
      code,
      message: error.message,
      requestId: REQUEST_ID,
      ...(details === undefined ? {} : { details }),
    });
  });

  it("maps unknown errors to an internal error without leaking the original message", () => {
    const mapped = mapErrorToHttp(
      new Error("database password leaked"),
      REQUEST_ID,
    );

    expect(mapped).toEqual({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
          requestId: REQUEST_ID,
        },
      },
    });
  });

  it("maps generic AppError instances", () => {
    const mapped = mapErrorToHttp(
      new AppError("INTERNAL_ERROR", "Internal application failure."),
      REQUEST_ID,
    );

    expect(mapped.status).toBe(500);
    expect(mapped.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("errorResponse", () => {
  it("returns an error envelope response with request ID header", async () => {
    const response = errorResponse(new AiDisabledError(), REQUEST_ID);

    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect((await response.json()) as ErrorResponse).toEqual({
      error: {
        code: "AI_DISABLED",
        message: "AI features are disabled.",
        requestId: REQUEST_ID,
      },
    });
  });
});
