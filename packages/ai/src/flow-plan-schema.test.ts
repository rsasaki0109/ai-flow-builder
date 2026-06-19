import { describe, expect, it } from "vitest";
import {
  FLOW_PLAN_SCHEMA_NAME,
  flowPlanRefSchema,
  flowPlanSchema,
  MAX_FLOW_PLAN_EDGES,
  MAX_FLOW_PLAN_NODES,
} from "./flow-plan-schema.js";

describe("flowPlanSchema", () => {
  it("parses a valid MVP flow plan with all supported node kinds", () => {
    expect(flowPlanSchema.parse(validFlowPlan())).toMatchObject({
      title: "AI Summary Flow",
      nodes: [
        { ref: "input", kind: "core.input.text" },
        { ref: "template", kind: "core.text.template" },
        { ref: "ai", kind: "ai.text.generate" },
        { ref: "output", kind: "core.output.text" },
      ],
    });
    expect(FLOW_PLAN_SCHEMA_NAME).toBe("FlowPlan");
  });

  it("rejects unknown node kinds and schema-external node fields", () => {
    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        nodes: [
          {
            ref: "custom",
            kind: "core.http.request",
            label: "HTTP",
            config: {},
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        nodes: [
          {
            ref: "input",
            kind: "core.input.text",
            label: "Input",
            config: { key: "input", label: "Input", required: true },
            position: { x: 0, y: 0 },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("uses config-specific strict schemas", () => {
    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        nodes: [
          {
            ref: "input",
            kind: "core.input.text",
            label: "Input",
            config: {
              key: "1-invalid",
              label: "Input",
              required: true,
            },
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        nodes: [
          {
            ref: "template",
            kind: "core.text.template",
            label: "Template",
            config: {
              template: "{{input}}",
              extra: true,
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate refs", () => {
    const plan = validFlowPlan();

    expect(
      flowPlanSchema.safeParse({
        ...plan,
        nodes: [
          plan.nodes[0],
          {
            ref: "input",
            kind: "core.output.text",
            label: "Output",
            config: {
              key: "result",
              label: "Result",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("limits generated plans to the MVP AI generation bounds", () => {
    const node = {
      ref: "output",
      kind: "core.output.text",
      label: "Output",
      config: {
        key: "result",
        label: "Result",
      },
    };
    const tooManyNodes = Array.from(
      { length: MAX_FLOW_PLAN_NODES + 1 },
      (_, index) => ({
        ...node,
        ref: `output${index}`,
        config: {
          key: `result${index}`,
          label: `Result ${index}`,
        },
      }),
    );
    const tooManyEdges = Array.from(
      { length: MAX_FLOW_PLAN_EDGES + 1 },
      (_, index) => ({
        sourceRef: "input",
        sourcePort: "value",
        targetRef: "output",
        targetPort: `value${index}`,
      }),
    );

    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        nodes: tooManyNodes,
      }).success,
    ).toBe(false);
    expect(
      flowPlanSchema.safeParse({
        ...validFlowPlan(),
        edges: tooManyEdges,
      }).success,
    ).toBe(false);
  });

  it("accepts only short alphanumeric refs with underscores or hyphens", () => {
    expect(flowPlanRefSchema.safeParse("input_1").success).toBe(true);
    expect(flowPlanRefSchema.safeParse("input-1").success).toBe(true);

    for (const ref of ["", "1input", "input space", "x".repeat(41)]) {
      expect(flowPlanRefSchema.safeParse(ref).success).toBe(false);
    }
  });
});

function validFlowPlan() {
  return {
    title: "AI Summary Flow",
    description: "Summarizes input text with the configured AI provider.",
    assumptions: ["A single text input is enough."],
    unsupportedRequirements: [],
    nodes: [
      {
        ref: "input",
        kind: "core.input.text",
        label: "Text Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
      {
        ref: "template",
        kind: "core.text.template",
        label: "Summary Prompt",
        config: {
          template: "Summarize the following:\n{{input}}",
        },
      },
      {
        ref: "ai",
        kind: "ai.text.generate",
        label: "AI Summary",
        config: {
          systemPrompt: "You summarize text clearly.",
        },
      },
      {
        ref: "output",
        kind: "core.output.text",
        label: "Summary Output",
        config: {
          key: "summary",
          label: "Summary",
        },
      },
    ],
    edges: [
      {
        sourceRef: "input",
        sourcePort: "value",
        targetRef: "template",
        targetPort: "input",
      },
      {
        sourceRef: "template",
        sourcePort: "text",
        targetRef: "ai",
        targetPort: "prompt",
      },
      {
        sourceRef: "ai",
        sourcePort: "text",
        targetRef: "output",
        targetPort: "value",
      },
    ],
  };
}
