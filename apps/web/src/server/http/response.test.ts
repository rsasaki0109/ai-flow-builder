import { describe, expect, it } from "vitest";
import {
  emptyResponse,
  resolveRequestId,
  successResponse,
} from "./response.js";

interface SuccessBody<TData> {
  data: TData;
}

describe("HTTP response helpers", () => {
  it("wraps successful JSON responses in a data envelope", async () => {
    const requestId = "10000000-0000-4000-8000-000000000001";
    const response = successResponse({ ok: true }, { status: 201, requestId });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect((await response.json()) as SuccessBody<{ ok: boolean }>).toEqual({
      data: { ok: true },
    });
  });

  it("returns empty responses without JSON content headers", () => {
    const requestId = "10000000-0000-4000-8000-000000000002";
    const response = emptyResponse(204, requestId);

    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get("x-request-id")).toBe(requestId);
  });

  it("uses valid incoming request IDs", () => {
    const requestId = "10000000-0000-4000-8000-000000000003";
    expect(resolveRequestId({ "x-request-id": requestId })).toBe(requestId);
  });

  it("generates a new request ID when the incoming value is invalid", () => {
    const requestId = resolveRequestId({ "x-request-id": "not-a-uuid" });

    expect(requestId).not.toBe("not-a-uuid");
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
