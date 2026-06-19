import { getServerContainer } from "../../../server/container.js";
import { handleApiRoute } from "../../../server/http/handler.js";
import { successResponse } from "../../../server/http/response.js";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/health",
      operation: "health",
      logger: container.logger,
    },
    ({ requestId, setLogFields }) => {
      const { config } = container;
      setLogFields({ provider: config.aiProvider });

      return successResponse(
        {
          status: "ok",
          version: "0.1.0",
          database: "ok",
          aiProvider: config.aiProvider,
        },
        { requestId },
      );
    },
  );
}
