import { describe, expect, it } from "vitest";
import {
  FlowPlanNormalizationError,
  flowPlanNormalizationIssueCodes,
  normalizeFlowPlan,
} from "./normalize-flow-plan.js";

describe("normalizeFlowPlan", () => {
  it("converts FlowPlan refs to generated FlowGraph IDs and applies deterministic layout", () => {
    const ids = createIdFactory([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ]);

    const result = normalizeFlowPlan(
      {
        title: " Branching Flow ",
        description: "  Creates two prompts.  ",
        assumptions: ["  Single input.  ", ""],
        unsupportedRequirements: ["  "],
        nodes: [
          inputNode(),
          {
            ref: "z_template",
            kind: "core.text.template",
            label: " Z Template ",
            config: { template: "Z: {{input}}" },
          },
          {
            ref: "a_template",
            kind: "core.text.template",
            label: " A Template ",
            config: { template: "A: {{input}}" },
          },
          outputNode(),
        ],
        edges: [
          {
            sourceRef: "input",
            sourcePort: "value",
            targetRef: "z_template",
            targetPort: "input",
          },
          {
            sourceRef: "input",
            sourcePort: "value",
            targetRef: "a_template",
            targetPort: "input",
          },
          {
            sourceRef: "a_template",
            sourcePort: "text",
            targetRef: "output",
            targetPort: "value",
          },
        ],
      },
      { idFactory: ids },
    );

    expect(result.name).toBe("Branching Flow");
    expect(result.description).toBe("Creates two prompts.");
    expect(result.assumptions).toEqual(["Single input."]);
    expect(result.unsupportedRequirements).toEqual([]);
    expect([...result.nodeIdByRef.entries()]).toEqual([
      ["input", "00000000-0000-4000-8000-000000000001"],
      ["z_template", "00000000-0000-4000-8000-000000000002"],
      ["a_template", "00000000-0000-4000-8000-000000000003"],
      ["output", "00000000-0000-4000-8000-000000000004"],
    ]);
    expect(
      result.graph.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        label: node.label,
        position: node.position,
      })),
    ).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "core.input.text",
        label: "Text Input",
        position: { x: 0, y: 0 },
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        kind: "core.text.template",
        label: "Z Template",
        position: { x: 300, y: 160 },
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        kind: "core.text.template",
        label: "A Template",
        position: { x: 300, y: 0 },
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        kind: "core.output.text",
        label: "Text Output",
        position: { x: 600, y: 0 },
      },
    ]);
    expect(result.graph.edges).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000005",
        source: {
          nodeId: "00000000-0000-4000-8000-000000000001",
          portId: "value",
        },
        target: {
          nodeId: "00000000-0000-4000-8000-000000000002",
          portId: "input",
        },
      },
      {
        id: "00000000-0000-4000-8000-000000000006",
        source: {
          nodeId: "00000000-0000-4000-8000-000000000001",
          portId: "value",
        },
        target: {
          nodeId: "00000000-0000-4000-8000-000000000003",
          portId: "input",
        },
      },
      {
        id: "00000000-0000-4000-8000-000000000007",
        source: {
          nodeId: "00000000-0000-4000-8000-000000000003",
          portId: "text",
        },
        target: {
          nodeId: "00000000-0000-4000-8000-000000000004",
          portId: "value",
        },
      },
    ]);
    expect(result.graph.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("rejects duplicate refs from the FlowPlan schema", () => {
    expect(() =>
      normalizeFlowPlan({
        ...validPlan(),
        nodes: [inputNode(), { ...outputNode(), ref: "input" }],
      }),
    ).toThrow(FlowPlanNormalizationError);

    try {
      normalizeFlowPlan({
        ...validPlan(),
        nodes: [inputNode(), { ...outputNode(), ref: "input" }],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FlowPlanNormalizationError);
      expect((error as FlowPlanNormalizationError).issues).toMatchObject([
        {
          code: flowPlanNormalizationIssueCodes.invalidFlowPlan,
          path: "nodes.1.ref",
        },
      ]);
    }
  });

  it("rejects unknown node kinds before generating graph IDs", () => {
    expect(() =>
      normalizeFlowPlan({
        ...validPlan(),
        nodes: [
          inputNode(),
          {
            ref: "http",
            kind: "core.http.request",
            label: "HTTP",
            config: {},
          },
        ],
      }),
    ).toThrow(FlowPlanNormalizationError);
  });

  it("rejects missing source and target refs in edges", () => {
    try {
      normalizeFlowPlan({
        ...validPlan(),
        edges: [
          {
            sourceRef: "missing_source",
            sourcePort: "value",
            targetRef: "missing_target",
            targetPort: "value",
          },
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FlowPlanNormalizationError);
      expect((error as FlowPlanNormalizationError).issues).toEqual([
        {
          code: flowPlanNormalizationIssueCodes.edgeSourceRefNotFound,
          message: 'Edge source ref "missing_source" does not exist.',
          path: "edges.0.sourceRef",
        },
        {
          code: flowPlanNormalizationIssueCodes.edgeTargetRefNotFound,
          message: 'Edge target ref "missing_target" does not exist.',
          path: "edges.0.targetRef",
        },
      ]);
      return;
    }

    throw new Error("Expected normalizeFlowPlan to reject missing refs.");
  });

  it("rejects invalid node config during schema parsing", () => {
    try {
      normalizeFlowPlan({
        ...validPlan(),
        nodes: [
          {
            ref: "input",
            kind: "core.input.text",
            label: "Text Input",
            config: {
              key: "invalid-key",
              label: "Input",
              required: true,
            },
          },
          outputNode(),
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FlowPlanNormalizationError);
      expect((error as FlowPlanNormalizationError).issues).toEqual([
        expect.objectContaining({
          code: flowPlanNormalizationIssueCodes.invalidFlowPlan,
          path: "nodes.0.config.key",
        }),
      ]);
      return;
    }

    throw new Error("Expected normalizeFlowPlan to reject invalid config.");
  });
});

function validPlan() {
  return {
    title: "Echo",
    description: "Echoes input text.",
    assumptions: [],
    unsupportedRequirements: [],
    nodes: [inputNode(), outputNode()],
    edges: [
      {
        sourceRef: "input",
        sourcePort: "value",
        targetRef: "output",
        targetPort: "value",
      },
    ],
  };
}

function inputNode() {
  return {
    ref: "input",
    kind: "core.input.text",
    label: "Text Input",
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
  };
}

function outputNode() {
  return {
    ref: "output",
    kind: "core.output.text",
    label: "Text Output",
    config: {
      key: "result",
      label: "Result",
    },
  };
}

function createIdFactory(ids: readonly string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[index];
    index += 1;

    if (id === undefined) {
      return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
    }

    return id;
  };
}
