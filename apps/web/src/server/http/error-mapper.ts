import type { ErrorResponse } from "@ai-flow-builder/flow-core";
import { AppError, type AppErrorCode } from "../errors.js";
import { jsonResponse } from "./response.js";

export interface MappedError {
  status: number;
  body: ErrorResponse;
}

const httpStatusByCode: Record<AppErrorCode, number> = {
  INVALID_REQUEST: 400,
  PROMPT_TOO_LARGE: 413,
  FLOW_NOT_FOUND: 404,
  FLOW_REVISION_CONFLICT: 409,
  INVALID_FLOW_DOCUMENT: 422,
  FLOW_NOT_EXECUTABLE: 422,
  MISSING_FLOW_INPUT: 422,
  UNSUPPORTED_FLOW_SCHEMA: 422,
  AI_GENERATED_INVALID_FLOW: 422,
  UNSUPPORTED_CODEGEN_LANGUAGE: 400,
  AI_DISABLED: 503,
  AI_PROVIDER_ERROR: 502,
  AI_GENERATION_TIMEOUT: 504,
  FLOW_RUN_TIMEOUT: 504,
  CODE_GENERATION_FAILED: 500,
  INTERNAL_ERROR: 500,
};

export function mapErrorToHttp(error: unknown, requestId: string): MappedError {
  if (error instanceof AppError) {
    return {
      status: httpStatusByCode[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  return {
    status: httpStatusByCode.INTERNAL_ERROR,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
    },
  };
}

export function errorResponse(error: unknown, requestId: string): Response {
  const mapped = mapErrorToHttp(error, requestId);
  return jsonResponse(mapped.body, {
    status: mapped.status,
    requestId,
  });
}
