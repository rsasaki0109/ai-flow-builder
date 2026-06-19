import type { FlowEdge, FlowGraph, FlowNode } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  createExecutorRegistry,
  executeFlow,
  FlowExecutionAbortedError,
  MAX_NODE_OUTPUT_TEXT_LENGTH,
  NodeExecutionFailedError,
  NodeOutputTooLargeError,
  type ExecutionClock,
  type FlowExecutionServices,
  type NodeExecutor,
} from "./index.js";

const inputId = "10000000-0000-4000-8000-000000000001";
const templateAId = "10000000-0000-4000-8000-000000000002";
const templateBId = "10000000-0000-4000-8000-000000000003";
const outputAId = "10000000-0000-4000-8000-000000000004";
const outputBId = "10000000-0000-4000-8000-000000000005";
const unusedInputId = "10000000-0000-4000-8000-000000000006";

describe("executeFlow", () => {
  it("executes a linear deterministic flow and returns trace timings", async () => {
    const result = await executeFlow({
      clock: createClock(),
      graph: linearGraph(),
      inputs: {
        input: "source text",
      },
      services: createServices(),
      signal: new AbortController().signal,
    });

    expect(result.status).toBe("succeeded");
    expect(result.startedAt).toBe("2026-06-19T00:00:00.000Z");
    expect(result.completedAt).toBe("2026-06-19T00:00:01.000Z");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.outputs).toEqual({
      result: "Summarize: source text",
    });
    expect(result.nodeResults.map((nodeResult) => nodeResult.nodeId)).toEqual([
      inputId,
      templateAId,
      outputAId,
    ]);
    expect(result.nodeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: outputAId,
          outputPreview: "Summarize: source text",
          status: "succeeded",
        }),
      ]),
    );
  });

  it("executes active branch nodes in stable topological order", async () => {
    const result = await executeFlow({
      clock: createClock(),
      graph: branchGraph(),
      inputs: {
        input: "topic",
        unused: "ignored",
      },
      services: createServices(),
      signal: new AbortController().signal,
    });

    expect(result.outputs).toEqual({
      first: "First: topic",
      second: "Second: topic",
    });
    expect(result.nodeResults.map((nodeResult) => nodeResult.nodeId)).toEqual([
      inputId,
      templateAId,
      templateBId,
      outputAId,
      outputBId,
    ]);
    expect(
      result.nodeResults.some(
        (nodeResult) => nodeResult.nodeId === unusedInputId,
      ),
    ).toBe(false);
  });

  it("stops downstream execution when a node fails", async () => {
    const calls: string[] = [];
    const registry = createExecutorRegistry([
      recordingInputExecutor(calls, "value"),
      failingTemplateExecutor(calls),
      recordingOutputExecutor(calls),
    ]);

    try {
      await executeFlow({
        clock: createClock(),
        graph: linearGraph(),
        inputs: {
          input: "source text",
        },
        registry,
        services: createServices(),
        signal: new AbortController().signal,
      });
      throw new Error("Expected executeFlow to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(NodeExecutionFailedError);

      if (error instanceof NodeExecutionFailedError) {
        expect(error.nodeId).toBe(templateAId);
        expect(error.nodeResults).toEqual([
          expect.objectContaining({
            nodeId: inputId,
            status: "succeeded",
          }),
          expect.objectContaining({
            errorMessage: "Template failed.",
            nodeId: templateAId,
            status: "failed",
          }),
        ]);
      }
    }

    expect(calls).toEqual([inputId, templateAId]);
  });

  it("does not start execution when the signal is already aborted", async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    controller.abort();

    await expect(
      executeFlow({
        clock: createClock(),
        graph: linearGraph(),
        inputs: {
          input: "source text",
        },
        registry: createExecutorRegistry([
          recordingInputExecutor(calls, "value"),
          recordingTemplateExecutor(calls),
          recordingOutputExecutor(calls),
        ]),
        services: createServices(),
        signal: controller.signal,
      }),
    ).rejects.toThrow(FlowExecutionAbortedError);
    expect(calls).toEqual([]);
  });

  it("classifies executor rejection after signal abort as aborted execution", async () => {
    const calls: string[] = [];
    const controller = new AbortController();

    await expect(
      executeFlow({
        clock: createClock(),
        graph: linearGraph(),
        inputs: {
          input: "source text",
        },
        registry: createExecutorRegistry([
          abortingInputExecutor(calls, controller),
          recordingTemplateExecutor(calls),
          recordingOutputExecutor(calls),
        ]),
        services: createServices(),
        signal: controller.signal,
      }),
    ).rejects.toThrow(FlowExecutionAbortedError);
    expect(calls).toEqual([inputId]);
  });

  it("wraps oversized executor output as a node execution failure", async () => {
    try {
      await executeFlow({
        clock: createClock(),
        graph: linearGraph(),
        inputs: {
          input: "source text",
        },
        registry: createExecutorRegistry([
          recordingInputExecutor(
            [],
            "x".repeat(MAX_NODE_OUTPUT_TEXT_LENGTH + 1),
          ),
          recordingTemplateExecutor([]),
          recordingOutputExecutor([]),
        ]),
        services: createServices(),
        signal: new AbortController().signal,
      });
      throw new Error("Expected executeFlow to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(NodeExecutionFailedError);

      if (error instanceof NodeExecutionFailedError) {
        expect(error.originalError).toBeInstanceOf(NodeOutputTooLargeError);
      }
    }
  });
});

function linearGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-100000000001",
        inputId,
        "value",
        templateAId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-100000000002",
        templateAId,
        "text",
        outputAId,
        "value",
      ),
    ],
    nodes: [
      inputNode(inputId, "input"),
      templateNode(templateAId, "Summarize: {{input}}"),
      outputNode(outputAId, "result"),
    ],
  });
}

function branchGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-200000000001",
        inputId,
        "value",
        templateAId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-200000000002",
        inputId,
        "value",
        templateBId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-200000000003",
        templateAId,
        "text",
        outputAId,
        "value",
      ),
      edge(
        "10000000-0000-4000-8000-200000000004",
        templateBId,
        "text",
        outputBId,
        "value",
      ),
    ],
    nodes: [
      outputBNode(),
      templateNode(templateBId, "Second: {{input}}"),
      inputNode(unusedInputId, "unused"),
      outputNode(outputAId, "first"),
      inputNode(inputId, "input"),
      templateNode(templateAId, "First: {{input}}"),
    ],
  });
}

function graph(input: {
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}): FlowGraph {
  return {
    edges: [...input.edges],
    nodes: [...input.nodes],
    schemaVersion: 1,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

function inputNode(id: string, key: string): FlowNode {
  return {
    config: {
      key,
      label: key,
      required: true,
    },
    id,
    kind: "core.input.text",
    label: "Text Input",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function templateNode(id: string, template: string): FlowNode {
  return {
    config: {
      template,
    },
    id,
    kind: "core.text.template",
    label: "Text Template",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function outputNode(id: string, key: string): FlowNode {
  return {
    config: {
      key,
      label: key,
    },
    id,
    kind: "core.output.text",
    label: "Text Output",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function outputBNode(): FlowNode {
  return outputNode(outputBId, "second");
}

function edge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge {
  return {
    id,
    source: {
      nodeId: sourceNodeId,
      portId: sourcePortId,
    },
    target: {
      nodeId: targetNodeId,
      portId: targetPortId,
    },
  };
}

function recordingInputExecutor(calls: string[], value: string): NodeExecutor {
  return {
    kind: "core.input.text",
    version: 1,
    async execute(context) {
      calls.push(context.node.id);

      return {
        outputs: {
          value,
        },
      };
    },
  };
}

function abortingInputExecutor(
  calls: string[],
  controller: AbortController,
): NodeExecutor {
  return {
    kind: "core.input.text",
    version: 1,
    async execute(context) {
      calls.push(context.node.id);
      controller.abort();
      throw new Error("Operation timed out.");
    },
  };
}

function failingTemplateExecutor(calls: string[]): NodeExecutor {
  return {
    kind: "core.text.template",
    version: 1,
    async execute(context) {
      calls.push(context.node.id);
      throw new Error("Template failed.");
    },
  };
}

function recordingTemplateExecutor(calls: string[]): NodeExecutor {
  return {
    kind: "core.text.template",
    version: 1,
    async execute(context) {
      calls.push(context.node.id);

      return {
        outputs: {
          text: context.inputs.input ?? "",
        },
      };
    },
  };
}

function recordingOutputExecutor(calls: string[]): NodeExecutor {
  return {
    kind: "core.output.text",
    version: 1,
    async execute(context) {
      calls.push(context.node.id);

      return {
        outputs: {
          result: context.inputs.value ?? "",
        },
      };
    },
  };
}

function createServices(): FlowExecutionServices {
  return {
    textGeneration: {
      async generateText(request) {
        return {
          text: `AI: ${request.prompt}`,
        };
      },
    },
  };
}

function createClock(): ExecutionClock {
  let nowMs = 1_000;
  let isoCalls = 0;

  return {
    nowIso() {
      const value =
        isoCalls === 0
          ? "2026-06-19T00:00:00.000Z"
          : "2026-06-19T00:00:01.000Z";
      isoCalls += 1;
      return value;
    },
    nowMs() {
      const value = nowMs;
      nowMs += 5;
      return value;
    },
  };
}
