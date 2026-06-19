import { describe, expect, it } from "vitest";
import type { FlowEdge, FlowGraph, FlowNode } from "../schemas/flow-graph.js";
import { validateStorage } from "./validate-storage.js";
import { validateExecutable } from "./validate-executable.js";
import { validationIssueCodes } from "./issues.js";

const input1Id = "20000000-0000-4000-8000-000000000001";
const input2Id = "20000000-0000-4000-8000-000000000002";
const template1Id = "20000000-0000-4000-8000-000000000003";
const template2Id = "20000000-0000-4000-8000-000000000004";
const output1Id = "20000000-0000-4000-8000-000000000005";
const output2Id = "20000000-0000-4000-8000-000000000006";

const edgeId = (suffix: number) =>
  `30000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

const inputNode = (id: string = input1Id, key: string = "input"): FlowNode => ({
  id,
  kind: "core.input.text",
  specVersion: 1,
  position: { x: 0, y: 0 },
  label: "Text Input",
  config: {
    key,
    label: "Input",
    required: true,
  },
});

const templateNode = (
  id: string = template1Id,
  template: string = "{{input}}",
): FlowNode => ({
  id,
  kind: "core.text.template",
  specVersion: 1,
  position: { x: 300, y: 0 },
  label: "Text Template",
  config: { template },
});

const outputNode = (
  id: string = output1Id,
  key: string = "result",
): FlowNode => ({
  id,
  kind: "core.output.text",
  specVersion: 1,
  position: { x: 600, y: 0 },
  label: "Text Output",
  config: {
    key,
    label: "Result",
  },
});

const edge = (
  suffix: number,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge => ({
  id: edgeId(suffix),
  source: {
    nodeId: sourceNodeId,
    portId: sourcePortId,
  },
  target: {
    nodeId: targetNodeId,
    portId: targetPortId,
  },
});

const graph = (nodes: FlowNode[], edges: FlowEdge[] = []): FlowGraph => ({
  schemaVersion: 1,
  nodes,
  edges,
  viewport: { x: 0, y: 0, zoom: 1 },
});

const validExecutableGraph = graph(
  [inputNode(), templateNode(), outputNode()],
  [
    edge(1, input1Id, "value", template1Id, "input"),
    edge(2, template1Id, "text", output1Id, "value"),
  ],
);

describe("validateExecutable", () => {
  it("accepts an executable graph", () => {
    expect(validateExecutable(validExecutableGraph)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it.each([
    {
      name: "missing required input port",
      graph: graph([outputNode()]),
      expectedCode: validationIssueCodes.requiredInputNotConnected,
    },
    {
      name: "missing output node",
      graph: graph([inputNode()]),
      expectedCode: validationIssueCodes.outputNodeRequired,
    },
    {
      name: "cycle",
      graph: graph(
        [templateNode(template1Id), templateNode(template2Id), outputNode()],
        [
          edge(1, template1Id, "text", template2Id, "input"),
          edge(2, template2Id, "text", template1Id, "input"),
          edge(3, template2Id, "text", output1Id, "value"),
        ],
      ),
      expectedCode: validationIssueCodes.graphHasCycle,
    },
    {
      name: "duplicate Text Input key",
      graph: graph(
        [
          inputNode(input1Id, "input"),
          inputNode(input2Id, "input"),
          outputNode(output1Id, "result_1"),
          outputNode(output2Id, "result_2"),
        ],
        [
          edge(1, input1Id, "value", output1Id, "value"),
          edge(2, input2Id, "value", output2Id, "value"),
        ],
      ),
      expectedCode: validationIssueCodes.duplicateTextInputKey,
    },
    {
      name: "duplicate Text Output key",
      graph: graph(
        [
          inputNode(input1Id, "input_1"),
          inputNode(input2Id, "input_2"),
          outputNode(output1Id, "result"),
          outputNode(output2Id, "result"),
        ],
        [
          edge(1, input1Id, "value", output1Id, "value"),
          edge(2, input2Id, "value", output2Id, "value"),
        ],
      ),
      expectedCode: validationIssueCodes.duplicateTextOutputKey,
    },
    {
      name: "unknown template placeholder",
      graph: graph(
        [
          inputNode(),
          templateNode(template1Id, "Hello {{name}}"),
          outputNode(),
        ],
        [
          edge(1, input1Id, "value", template1Id, "input"),
          edge(2, template1Id, "text", output1Id, "value"),
        ],
      ),
      expectedCode: validationIssueCodes.unknownTemplatePlaceholder,
    },
  ])("rejects $name", ({ graph: invalidGraph, expectedCode }) => {
    expect(validateStorage(invalidGraph).valid).toBe(true);

    const result = validateExecutable(invalidGraph);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
  });

  it("preserves storage validation errors without running executable-only checks", () => {
    const result = validateExecutable({
      ...validExecutableGraph,
      viewport: { x: 0, y: 0, zoom: 9 },
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      validationIssueCodes.invalidFlowSchema,
    ]);
  });

  it("warns about nodes that do not reach outputs without failing validation", () => {
    const result = validateExecutable(
      graph(
        [
          inputNode(input1Id, "input"),
          inputNode(input2Id, "unused_input"),
          outputNode(),
        ],
        [edge(1, input1Id, "value", output1Id, "value")],
      ),
    );

    expect(result.valid).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      validationIssueCodes.nodeNotReachingOutput,
      validationIssueCodes.unusedInputNode,
    ]);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
  });
});
