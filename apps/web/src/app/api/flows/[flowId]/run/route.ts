import { z } from "zod";
import { getServerContainer } from "../../../../../server/container.js";
import { handleApiRoute } from "../../../../../server/http/handler.js";
import {
  parseJsonRequest,
  parseUuidPathParam,
} from "../../../../../server/http/request.js";
import { successResponse } from "../../../../../server/http/response.js";

export const runtime = "nodejs";

interface RunFlowRouteContext {
  params: Promise<{ flowId: string }>;
}

const MAX_RUNTIME_INPUT_LENGTH = 50_000;

const runFlowRequestSchema = z
  .object({
    inputs: z.record(
      z.string().min(1),
      z.string().max(MAX_RUNTIME_INPUT_LENGTH),
    ),
  })
  .strict();

export async function POST(
  request: Request,
  context: RunFlowRouteContext,
): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/flows/[flowId]/run",
      operation: "run_flow",
      logger: container.logger,
    },
    async ({ requestId, setLogFields }) => {
      const flowId = await parseFlowId(context);
      setLogFields({ flowId });
      const body = await parseJsonRequest(request, runFlowRequestSchema);
      const result = await container.runFlowService.run({
        flowId,
        inputs: body.inputs,
        signal: request.signal,
      });

      return successResponse(result, { requestId });
    },
  );
}

async function parseFlowId(context: RunFlowRouteContext): Promise<string> {
  const params = await context.params;
  return parseUuidPathParam("flowId", params.flowId);
}
