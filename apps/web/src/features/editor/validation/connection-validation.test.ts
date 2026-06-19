import type { FlowGraph, FlowNode } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import { validateConnection } from "./connection-validation.js";

describe("validateConnection", () => {
  it("accepts a valid text output to text input connection", () => {
    const graph = createGraph([
      createTextInputNode("10000000-0000-4000-8000-000000000101"),
      createTextOutputNode("10000000-0000-4000-8000-000000000102"),
    ]);

    const result = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
    });

    expect(result).toEqual({
      status: "valid",
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
    });
  });

  it("rejects self edges", () => {
    const graph = createGraph([
      createTextInputNode("10000000-0000-4000-8000-000000000101"),
    ]);

    const result = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "value",
      },
    });

    expect(result).toMatchObject({
      code: "CONNECTION_SELF_LOOP",
      status: "invalid",
    });
  });

  it("rejects duplicate target input connections", () => {
    const graph = {
      ...createGraph([
        createTextInputNode("10000000-0000-4000-8000-000000000101"),
        createTextInputNode("10000000-0000-4000-8000-000000000102"),
        createTemplateNode("10000000-0000-4000-8000-000000000103"),
      ]),
      edges: [
        {
          id: "10000000-0000-4000-8000-000000000301",
          source: {
            nodeId: "10000000-0000-4000-8000-000000000101",
            portId: "value",
          },
          target: {
            nodeId: "10000000-0000-4000-8000-000000000103",
            portId: "input",
          },
        },
      ],
    };

    const result = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000103",
        portId: "input",
      },
    });

    expect(result).toMatchObject({
      code: "CONNECTION_DUPLICATE_TARGET",
      status: "invalid",
    });
  });

  it("rejects connections that would create a cycle", () => {
    const graph = {
      ...createGraph([
        createTemplateNode("10000000-0000-4000-8000-000000000101"),
        createTemplateNode("10000000-0000-4000-8000-000000000102"),
      ]),
      edges: [
        {
          id: "10000000-0000-4000-8000-000000000301",
          source: {
            nodeId: "10000000-0000-4000-8000-000000000101",
            portId: "text",
          },
          target: {
            nodeId: "10000000-0000-4000-8000-000000000102",
            portId: "input",
          },
        },
      ],
    };

    const result = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "text",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "input",
      },
    });

    expect(result).toMatchObject({
      code: "CONNECTION_CREATES_CYCLE",
      status: "invalid",
    });
  });

  it("rejects unknown ports", () => {
    const graph = createGraph([
      createTextInputNode("10000000-0000-4000-8000-000000000101"),
      createTextOutputNode("10000000-0000-4000-8000-000000000102"),
    ]);

    const result = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "missing",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
    });

    expect(result).toMatchObject({
      code: "CONNECTION_SOURCE_PORT_NOT_FOUND",
      status: "invalid",
    });
  });

  it("rejects connections from input ports or into output ports", () => {
    const graph = createGraph([
      createTemplateNode("10000000-0000-4000-8000-000000000101"),
      createTextInputNode("10000000-0000-4000-8000-000000000102"),
    ]);

    const sourceDirectionResult = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "input",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
    });
    const targetDirectionResult = validateConnection(graph, {
      source: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "text",
      },
    });

    expect(sourceDirectionResult).toMatchObject({
      code: "CONNECTION_SOURCE_PORT_DIRECTION_INVALID",
      status: "invalid",
    });
    expect(targetDirectionResult).toMatchObject({
      code: "CONNECTION_TARGET_PORT_DIRECTION_INVALID",
      status: "invalid",
    });
  });
});

function createGraph(nodes: readonly FlowNode[]): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [...nodes],
    edges: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

function createTextInputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.input.text",
    specVersion: 1,
    position: { x: 0, y: 0 },
    label: "Text Input",
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
  };
}

function createTemplateNode(id: string): FlowNode {
  return {
    id,
    kind: "core.text.template",
    specVersion: 1,
    position: { x: 300, y: 0 },
    label: "Text Template",
    config: {
      template: "{{input}}",
    },
  };
}

function createTextOutputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.output.text",
    specVersion: 1,
    position: { x: 600, y: 0 },
    label: "Text Output",
    config: {
      key: "result",
      label: "Result",
    },
  };
}
