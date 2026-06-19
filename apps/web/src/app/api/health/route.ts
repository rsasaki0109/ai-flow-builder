import { getServerContainer } from "../../../server/container.js";
import { errorResponse } from "../../../server/http/error-mapper.js";
import {
  resolveRequestId,
  successResponse,
} from "../../../server/http/response.js";

export const runtime = "nodejs";

export function GET(request: Request): Response {
  const requestId = resolveRequestId(request.headers);

  try {
    const { config } = getServerContainer();
    return successResponse(
      {
        status: "ok",
        version: "0.1.0",
        database: "ok",
        aiProvider: config.aiProvider,
      },
      { requestId },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
