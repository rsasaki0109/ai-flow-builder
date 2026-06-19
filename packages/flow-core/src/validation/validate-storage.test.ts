import { describe, expect, it } from "vitest";
import type { FlowEdge, FlowGraph, FlowNode } from "../schemas/flow-graph.js";
import {
  isPortDataTypeCompatible,
  validateStorage,
} from "./validate-storage.js";
import { validationIssueCodes } from "./issues.js";

const inputId = "00000000-0000-4000-8000-000000000001";
const input2Id = "00000000-0000-4000-8000-000000000002";
const templateId = "00000000-0000-4000-8000-000000000003";
const outputId = "00000000-0000-4000-8000-000000000004";
const edge1Id = "10000000-0000-4000-8000-000000000001";
const edge2Id = "10000000-0000-4000-8000-000000000002";

const inputNode = (id: string = inputId, key: string = "input"): FlowNode => ({
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

const templateNode = (id: string = templateId): FlowNode => ({
  id,
  kind: "core.text.template",
  specVersion: 1,
  position: { x: 300, y: 0 },
  label: "Text Template",
  config: {
    template: "{{input}}",
  },
});

const outputNode = (id: string = outputId): FlowNode => ({
  id,
  kind: "core.output.text",
  specVersion: 1,
  position: { x: 600, y: 0 },
  label: "Text Output",
  config: {
    key: "result",
    label: "Result",
  },
});

const edge = (
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge => ({
  id,
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

const validGraph = graph(
  [inputNode(), templateNode(), outputNode()],
  [
    edge(edge1Id, inputId, "value", templateId, "input"),
    edge(edge2Id, templateId, "text", outputId, "value"),
  ],
);

describe("validateStorage", () => {
  it("accepts a structurally valid graph", () => {
    expect(validateStorage(validGraph)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("allows storage-valid incomplete graphs", () => {
    expect(validateStorage(graph([outputNode()], [])).valid).toBe(true);
    expect(validateStorage(graph([], [])).valid).toBe(true);
  });

  it.each([
    {
      name: "schema and size limit violations",
      graph: {
        ...validGraph,
        nodes: Array.from({ length: 101 }, (_, index) =>
          inputNode(
            `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
            `input_${index}`,
          ),
        ),
      },
      expectedCode: validationIssueCodes.invalidFlowSchema,
    },
    {
      name: "duplicate node IDs",
      graph: graph([inputNode(), templateNode(inputId)]),
      expectedCode: validationIssueCodes.duplicateNodeId,
    },
    {
      name: "duplicate edge IDs",
      graph: graph(
        [inputNode(), templateNode(), outputNode()],
        [
          edge(edge1Id, inputId, "value", templateId, "input"),
          edge(edge1Id, templateId, "text", outputId, "value"),
        ],
      ),
      expectedCode: validationIssueCodes.duplicateEdgeId,
    },
    {
      name: "invalid node config",
      graph: graph([
        {
          ...inputNode(),
          config: {
            key: "1invalid",
            label: "Input",
            required: true,
          },
        },
      ]),
      expectedCode: validationIssueCodes.invalidNodeConfig,
    },
    {
      name: "missing source node",
      graph: graph(
        [templateNode()],
        [edge(edge1Id, inputId, "value", templateId, "input")],
      ),
      expectedCode: validationIssueCodes.edgeSourceNodeNotFound,
    },
    {
      name: "missing target node",
      graph: graph(
        [inputNode()],
        [edge(edge1Id, inputId, "value", templateId, "input")],
      ),
      expectedCode: validationIssueCodes.edgeTargetNodeNotFound,
    },
    {
      name: "missing source port",
      graph: graph(
        [inputNode(), templateNode()],
        [edge(edge1Id, inputId, "missing", templateId, "input")],
      ),
      expectedCode: validationIssueCodes.edgeSourcePortNotFound,
    },
    {
      name: "missing target port",
      graph: graph(
        [inputNode(), templateNode()],
        [edge(edge1Id, inputId, "value", templateId, "missing")],
      ),
      expectedCode: validationIssueCodes.edgeTargetPortNotFound,
    },
    {
      name: "source port direction mismatch",
      graph: graph(
        [outputNode(), templateNode()],
        [edge(edge1Id, outputId, "value", templateId, "input")],
      ),
      expectedCode: validationIssueCodes.edgeSourcePortDirectionInvalid,
    },
    {
      name: "target port direction mismatch",
      graph: graph(
        [inputNode()],
        [edge(edge1Id, inputId, "value", inputId, "value")],
      ),
      expectedCode: validationIssueCodes.edgeTargetPortDirectionInvalid,
    },
    {
      name: "duplicate target input",
      graph: graph(
        [inputNode(), inputNode(input2Id, "input_2"), templateNode()],
        [
          edge(edge1Id, inputId, "value", templateId, "input"),
          edge(edge2Id, input2Id, "value", templateId, "input"),
        ],
      ),
      expectedCode: validationIssueCodes.duplicateTargetInput,
    },
    {
      name: "self-loop edge",
      graph: graph(
        [templateNode()],
        [edge(edge1Id, templateId, "text", templateId, "input")],
      ),
      expectedCode: validationIssueCodes.selfLoopEdge,
    },
  ])("reports $name", ({ graph: invalidGraph, expectedCode }) => {
    const result = validateStorage(invalidGraph);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
  });

  it("checks port data type compatibility", () => {
    expect(isPortDataTypeCompatible("text", "text")).toBe(true);
    expect(isPortDataTypeCompatible("text", "any")).toBe(true);
    expect(isPortDataTypeCompatible("any", "text")).toBe(true);
    expect(isPortDataTypeCompatible("text", "number")).toBe(false);
  });
});
