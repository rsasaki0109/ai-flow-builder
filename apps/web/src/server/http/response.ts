import { randomUUID } from "node:crypto";
import { z } from "zod";

const requestIdSchema = z.uuid();

export interface JsonResponseInit {
  status?: number;
  headers?: HeadersInit;
  requestId?: string;
}

export function successResponse<TData>(
  data: TData,
  init: JsonResponseInit = {},
): Response {
  return jsonResponse({ data }, { ...init, status: init.status ?? 200 });
}

export function emptyResponse(status = 204, requestId?: string): Response {
  const headers = new Headers();
  if (requestId !== undefined) {
    headers.set("x-request-id", requestId);
  }

  return new Response(null, { status, headers });
}

export function jsonResponse<TBody>(
  body: TBody,
  init: JsonResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (init.requestId !== undefined) {
    headers.set("x-request-id", init.requestId);
  }

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function resolveRequestId(headers: Headers | HeadersInit): string {
  const requestHeaders = new Headers(headers);
  const incomingRequestId = requestHeaders.get("x-request-id");

  if (
    incomingRequestId !== null &&
    requestIdSchema.safeParse(incomingRequestId).success
  ) {
    return incomingRequestId;
  }

  return randomUUID();
}
