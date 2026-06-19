import { performance } from "node:perf_hooks";
import type { AppLogger, HttpRequestLogFields } from "../logger.js";
import { logHttpRequest } from "../logger.js";
import { mapErrorToHttp } from "./error-mapper.js";
import { jsonResponse, resolveRequestId } from "./response.js";

export interface ApiRouteMetadata {
  readonly route: string;
  readonly operation: string;
  readonly logger: AppLogger;
}

export interface ApiRouteContext {
  readonly requestId: string;
  setLogFields(fields: ApiRouteLogFields): void;
}

export type ApiRouteLogFields = Partial<
  Pick<HttpRequestLogFields, "flowId" | "provider" | "model">
>;

export type ApiRouteHandler = (
  context: ApiRouteContext,
) => Promise<Response> | Response;

export async function handleApiRoute(
  request: Request,
  metadata: ApiRouteMetadata,
  handler: ApiRouteHandler,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers);
  const startedAt = performance.now();
  const logFields: MutableApiRouteLogFields = {};

  const setLogFields = (fields: ApiRouteLogFields): void => {
    if (fields.flowId !== undefined) {
      logFields.flowId = fields.flowId;
    }

    if (fields.provider !== undefined) {
      logFields.provider = fields.provider;
    }

    if (fields.model !== undefined) {
      logFields.model = fields.model;
    }
  };

  try {
    const response = await handler({ requestId, setLogFields });
    logHttpRequest(metadata.logger, {
      requestId,
      route: metadata.route,
      operation: metadata.operation,
      durationMs: performance.now() - startedAt,
      success: response.status < 400,
      status: response.status,
      ...logFields,
    });

    return response;
  } catch (error) {
    const mapped = mapErrorToHttp(error, requestId);
    logHttpRequest(metadata.logger, {
      requestId,
      route: metadata.route,
      operation: metadata.operation,
      durationMs: performance.now() - startedAt,
      success: false,
      status: mapped.status,
      errorCode: mapped.body.error.code,
      ...logFields,
    });

    return jsonResponse(mapped.body, {
      status: mapped.status,
      requestId,
    });
  }
}

type MutableApiRouteLogFields = {
  flowId?: string;
  provider?: string;
  model?: string | null;
};
