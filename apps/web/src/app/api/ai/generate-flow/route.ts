import { z } from "zod";
import { getServerContainer } from "../../../../server/container.js";
import { handleApiRoute } from "../../../../server/http/handler.js";
import { parseJsonRequest } from "../../../../server/http/request.js";
import { successResponse } from "../../../../server/http/response.js";

export const runtime = "nodejs";

const generateFlowRequestSchema = z
  .object({
    prompt: z.string(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/ai/generate-flow",
      operation: "generate_flow_from_text",
      logger: container.logger,
    },
    async ({ requestId, setLogFields }) => {
      setLogFields({
        provider: container.aiProvider.name,
        model: container.aiProvider.model,
      });
      const body = await parseJsonRequest(request, generateFlowRequestSchema);
      const result = await container.generateFlowService.generate({
        prompt: body.prompt,
        signal: request.signal,
      });

      return successResponse(result, { requestId });
    },
  );
}
