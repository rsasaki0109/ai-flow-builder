import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorResponseSchema, successResponseSchema } from "./api-contracts.js";

describe("API response schemas", () => {
  it("wraps successful responses in a data envelope", () => {
    const schema = successResponseSchema(
      z.object({ status: z.literal("ok") }).strict(),
    );

    expect(schema.parse({ data: { status: "ok" } })).toEqual({
      data: { status: "ok" },
    });
    expect(
      schema.safeParse({ data: { status: "ok" }, extra: true }).success,
    ).toBe(false);
  });

  it("parses the standard error envelope", () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request.",
          requestId: "44444444-4444-4444-8444-444444444444",
          details: { field: "name" },
        },
      }),
    ).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid request.",
        requestId: "44444444-4444-4444-8444-444444444444",
        details: { field: "name" },
      },
    });
  });
});
