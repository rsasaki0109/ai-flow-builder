import {
  MAX_FLOW_DESCRIPTION_LENGTH,
  MAX_FLOW_NAME_LENGTH,
} from "@ai-flow-builder/flow-core";
import { z } from "zod";
import { getServerContainer } from "../../../../server/container.js";
import { errorResponse } from "../../../../server/http/error-mapper.js";
import {
  parseJsonRequest,
  parseUuidPathParam,
} from "../../../../server/http/request.js";
import {
  emptyResponse,
  resolveRequestId,
  successResponse,
} from "../../../../server/http/response.js";

export const runtime = "nodejs";

interface FlowRouteContext {
  params: Promise<{ flowId: string }>;
}

const updateFlowRequestSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    name: z.string().min(1).max(MAX_FLOW_NAME_LENGTH),
    description: z.string().max(MAX_FLOW_DESCRIPTION_LENGTH).nullable(),
    graph: z.unknown(),
  })
  .strict();

export async function GET(
  request: Request,
  context: FlowRouteContext,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers);

  try {
    const flowId = await parseFlowId(context);
    const flow = await getServerContainer().flowService.get(flowId);

    return successResponse(flow, { requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PUT(
  request: Request,
  context: FlowRouteContext,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers);

  try {
    const flowId = await parseFlowId(context);
    const body = await parseJsonRequest(request, updateFlowRequestSchema);
    const flow = await getServerContainer().flowService.update({
      id: flowId,
      expectedRevision: body.expectedRevision,
      name: body.name,
      description: body.description,
      graph: body.graph,
    });

    return successResponse(flow, { requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(
  request: Request,
  context: FlowRouteContext,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers);

  try {
    const flowId = await parseFlowId(context);
    await getServerContainer().flowService.delete(flowId);

    return emptyResponse(204, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

async function parseFlowId(context: FlowRouteContext): Promise<string> {
  const params = await context.params;
  return parseUuidPathParam("flowId", params.flowId);
}
