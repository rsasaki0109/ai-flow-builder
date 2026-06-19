import { describe, expect, it } from "vitest";
import { flowResourceSchema } from "./flow-resource.js";

const validFlowResource = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Summarizer",
  description: null,
  graph: {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  revision: 1,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T01:00:00.000Z",
};

describe("flowResourceSchema", () => {
  it("parses a valid flow resource", () => {
    expect(flowResourceSchema.parse(validFlowResource)).toEqual(
      validFlowResource,
    );
  });

  it("rejects unknown fields", () => {
    expect(
      flowResourceSchema.safeParse({
        ...validFlowResource,
        reactFlowNodes: [],
      }).success,
    ).toBe(false);
  });

  it("enforces resource size and identity limits", () => {
    expect(
      flowResourceSchema.safeParse({ ...validFlowResource, name: "" }).success,
    ).toBe(false);
    expect(
      flowResourceSchema.safeParse({
        ...validFlowResource,
        name: "x".repeat(121),
      }).success,
    ).toBe(false);
    expect(
      flowResourceSchema.safeParse({
        ...validFlowResource,
        description: "x".repeat(2_001),
      }).success,
    ).toBe(false);
    expect(
      flowResourceSchema.safeParse({ ...validFlowResource, revision: 0 })
        .success,
    ).toBe(false);
    expect(
      flowResourceSchema.safeParse({ ...validFlowResource, id: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      flowResourceSchema.safeParse({
        ...validFlowResource,
        createdAt: "2026-06-18",
      }).success,
    ).toBe(false);
  });
});
