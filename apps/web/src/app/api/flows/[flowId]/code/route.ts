import { generateCodeRequestSchema } from "@ai-flow-builder/flow-core";
import { getServerContainer } from "../../../../../server/container.js";
import { handleApiRoute } from "../../../../../server/http/handler.js";
import {
  parseJsonRequest,
  parseUuidPathParam,
} from "../../../../../server/http/request.js";
import { successResponse } from "../../../../../server/http/response.js";

export const runtime = "nodejs";

interface GenerateCodeRouteContext {
  params: Promise<{ flowId: string }>;
}

export async function POST(
  request: Request,
  context: GenerateCodeRouteContext,
): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/flows/[flowId]/code",
      operation: "generate_code",
      logger: container.logger,
    },
    async ({ requestId, setLogFields }) => {
      const flowId = await parseFlowId(context);
      setLogFields({ flowId });
      const body = await parseJsonRequest(request, generateCodeRequestSchema);
      const result = await container.generateCodeService.generate({
        flowId,
        language: body.language,
      });

      return successResponse(result, { requestId });
    },
  );
}

async function parseFlowId(context: GenerateCodeRouteContext): Promise<string> {
  const params = await context.params;
  return parseUuidPathParam("flowId", params.flowId);
}
