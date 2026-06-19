import {
  MAX_FLOW_DESCRIPTION_LENGTH,
  MAX_FLOW_NAME_LENGTH,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { z } from "zod";
import { getServerContainer } from "../../../server/container.js";
import { handleApiRoute } from "../../../server/http/handler.js";
import {
  parseJsonRequest,
  parseSearchParams,
} from "../../../server/http/request.js";
import { successResponse } from "../../../server/http/response.js";
import type { CreateFlowInput } from "../../../server/services/flow-service.js";

export const runtime = "nodejs";

const listFlowsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

const createFlowRequestSchema = z
  .object({
    name: z.string().min(1).max(MAX_FLOW_NAME_LENGTH),
    description: z
      .string()
      .max(MAX_FLOW_DESCRIPTION_LENGTH)
      .nullable()
      .optional(),
    graph: z.unknown().optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/flows",
      operation: "list_flows",
      logger: container.logger,
    },
    async ({ requestId }) => {
      const query = parseSearchParams(
        new URL(request.url).searchParams,
        listFlowsQuerySchema,
      );
      const flows = await container.flowService.list({
        limit: query.limit,
      });

      return successResponse(
        {
          items: flows.map(flowResourceToListItem),
        },
        { requestId },
      );
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const container = getServerContainer();

  return handleApiRoute(
    request,
    {
      route: "/api/flows",
      operation: "create_flow",
      logger: container.logger,
    },
    async ({ requestId }) => {
      const body = await parseJsonRequest(request, createFlowRequestSchema);
      const createInput: CreateFlowInput = {
        name: body.name,
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
        ...(body.graph === undefined ? {} : { graph: body.graph }),
      };
      const flow = await container.flowService.create(createInput);

      return successResponse(flow, { status: 201, requestId });
    },
  );
}

function flowResourceToListItem(flow: FlowResource) {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    revision: flow.revision,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}
