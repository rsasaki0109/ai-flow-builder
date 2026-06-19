import {
  flowGraphSchema,
  textOutputConfigSchema,
  topologicalSort,
  validateExecutable,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
} from "@ai-flow-builder/flow-core";
import {
  FlowExecutionAbortedError,
  FlowNotExecutableExecutionError,
  MissingNodeOutputError,
  NodeExecutionFailedError,
  NodeOutputTooLargeError,
} from "./execution-errors.js";
import {
  MAX_NODE_OUTPUT_PREVIEW_LENGTH,
  MAX_NODE_OUTPUT_TEXT_LENGTH,
} from "./execution-limits.js";
import { createExecutorRegistry } from "./executor-registry.js";
import { builtInNodeExecutors } from "./executors/index.js";
import type {
  ExecuteFlowInput,
  ExecutionClock,
  NodeRunResult,
  RunResult,
  TextPortValues,
} from "./execution-types.js";

const defaultClock: ExecutionClock = {
  nowMs: () => Date.now(),
  nowIso: () => new Date().toISOString(),
};

export async function executeFlow(input: ExecuteFlowInput): Promise<RunResult> {
  const validation = validateExecutable(input.graph);
  if (!validation.valid) {
    throw new FlowNotExecutableExecutionError(validation.issues);
  }

  const graph = flowGraphSchema.parse(input.graph);
  const registry =
    input.registry ?? createExecutorRegistry(builtInNodeExecutors);
  const clock = input.clock ?? defaultClock;
  const startedAt = clock.nowIso();
  const startedMs = clock.nowMs();
  const activeNodeIds = collectActiveNodeIds(graph);
  const executionOrder = getActiveTopologicalOrder(graph, activeNodeIds);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingEdgesByTarget = collectIncomingEdgesByTarget(
    graph,
    activeNodeIds,
  );
  const nodeOutputs = new Map<string, TextPortValues>();
  const nodeResults: NodeRunResult[] = [];
  const outputs: Record<string, string> = {};

  for (const nodeId of executionOrder) {
    throwIfAborted(input.signal, nodeResults);

    const node = nodesById.get(nodeId);
    if (node === undefined) {
      continue;
    }

    const nodeStartedMs = clock.nowMs();

    try {
      const executor = registry.get(node.kind, node.specVersion);
      const resolvedInputs = resolveNodeInputs({
        incomingEdges: incomingEdgesByTarget.get(node.id) ?? [],
        node,
        nodeOutputs,
        runtimeInputs: input.inputs,
      });
      const result = await executor.execute({
        inputs: resolvedInputs,
        node,
        services: input.services,
        signal: input.signal,
      });

      throwIfAborted(input.signal, nodeResults);
      validateNodeOutputLimits(node.id, result.outputs);
      nodeOutputs.set(node.id, result.outputs);
      collectFinalOutput(node, result.outputs, outputs);

      nodeResults.push({
        durationMs: elapsedMs(clock, nodeStartedMs),
        nodeId: node.id,
        outputPreview: createOutputPreview(result.outputs),
        status: "succeeded",
      });
    } catch (error) {
      if (error instanceof FlowExecutionAbortedError) {
        throw error;
      }

      if (input.signal.aborted) {
        throw new FlowExecutionAbortedError(nodeResults);
      }

      const failedResult: NodeRunResult = {
        durationMs: elapsedMs(clock, nodeStartedMs),
        errorMessage: getErrorMessage(error),
        nodeId: node.id,
        status: "failed",
      };
      const failedNodeResults = [...nodeResults, failedResult];

      throw new NodeExecutionFailedError(node.id, failedNodeResults, error);
    }
  }

  const completedAt = clock.nowIso();
  return {
    completedAt,
    durationMs: elapsedMs(clock, startedMs),
    nodeResults,
    outputs,
    startedAt,
    status: "succeeded",
  };
}

function collectActiveNodeIds(graph: FlowGraph): ReadonlySet<string> {
  const incomingSourceIdsByTarget = new Map<string, string[]>();

  for (const edge of graph.edges) {
    const sourceIds = incomingSourceIdsByTarget.get(edge.target.nodeId) ?? [];
    sourceIds.push(edge.source.nodeId);
    incomingSourceIdsByTarget.set(edge.target.nodeId, sourceIds);
  }

  const outputNodeIds = graph.nodes
    .filter((node) => node.kind === "core.output.text")
    .map((node) => node.id)
    .sort();
  const activeNodeIds = new Set<string>();
  const stack = [...outputNodeIds];

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (nodeId === undefined || activeNodeIds.has(nodeId)) {
      continue;
    }

    activeNodeIds.add(nodeId);

    for (const sourceNodeId of incomingSourceIdsByTarget.get(nodeId) ?? []) {
      if (!activeNodeIds.has(sourceNodeId)) {
        stack.push(sourceNodeId);
      }
    }
  }

  return activeNodeIds;
}

function getActiveTopologicalOrder(
  graph: FlowGraph,
  activeNodeIds: ReadonlySet<string>,
): readonly string[] {
  const sorted = topologicalSort(graph);

  if (sorted.status === "cycle") {
    throw new FlowNotExecutableExecutionError(
      sorted.cycleNodeIds.map((nodeId) => ({
        code: "GRAPH_HAS_CYCLE",
        message: `Node "${nodeId}" is part of a cycle.`,
        nodeId,
        severity: "error",
      })),
    );
  }

  return sorted.nodeIds.filter((nodeId) => activeNodeIds.has(nodeId));
}

function collectIncomingEdgesByTarget(
  graph: FlowGraph,
  activeNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly FlowEdge[]> {
  const incomingEdgesByTarget = new Map<string, FlowEdge[]>();

  for (const edge of graph.edges) {
    if (
      !activeNodeIds.has(edge.source.nodeId) ||
      !activeNodeIds.has(edge.target.nodeId)
    ) {
      continue;
    }

    const incomingEdges = incomingEdgesByTarget.get(edge.target.nodeId) ?? [];
    incomingEdges.push(edge);
    incomingEdgesByTarget.set(edge.target.nodeId, incomingEdges);
  }

  for (const incomingEdges of incomingEdgesByTarget.values()) {
    incomingEdges.sort((left, right) =>
      left.target.portId.localeCompare(right.target.portId),
    );
  }

  return incomingEdgesByTarget;
}

function resolveNodeInputs(input: {
  readonly incomingEdges: readonly FlowEdge[];
  readonly node: FlowNode;
  readonly nodeOutputs: ReadonlyMap<string, TextPortValues>;
  readonly runtimeInputs: Record<string, string>;
}): TextPortValues {
  if (input.node.kind === "core.input.text") {
    return input.runtimeInputs;
  }

  const resolvedInputs: TextPortValues = {};

  for (const edge of input.incomingEdges) {
    const sourceOutputs = input.nodeOutputs.get(edge.source.nodeId);
    const sourceValue = sourceOutputs?.[edge.source.portId];

    if (sourceValue === undefined) {
      throw new MissingNodeOutputError(edge.source.nodeId, edge.source.portId);
    }

    resolvedInputs[edge.target.portId] = sourceValue;
  }

  return resolvedInputs;
}

function validateNodeOutputLimits(
  nodeId: string,
  outputs: TextPortValues,
): void {
  for (const [outputKey, value] of Object.entries(outputs)) {
    if (value.length > MAX_NODE_OUTPUT_TEXT_LENGTH) {
      throw new NodeOutputTooLargeError(
        nodeId,
        outputKey,
        value.length,
        MAX_NODE_OUTPUT_TEXT_LENGTH,
      );
    }
  }
}

function collectFinalOutput(
  node: FlowNode,
  nodeOutput: TextPortValues,
  outputs: Record<string, string>,
): void {
  if (node.kind !== "core.output.text") {
    return;
  }

  const config = textOutputConfigSchema.parse(node.config);
  const value = nodeOutput[config.key];

  if (value === undefined) {
    throw new MissingNodeOutputError(node.id, config.key);
  }

  outputs[config.key] = value;
}

function createOutputPreview(outputs: TextPortValues): string {
  const entries = Object.entries(outputs).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const preview =
    entries.length === 1
      ? (entries[0]?.[1] ?? "")
      : entries.map(([key, value]) => `${key}: ${value}`).join("\n");

  return truncate(preview, MAX_NODE_OUTPUT_PREVIEW_LENGTH);
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return value.slice(0, limit);
}

function throwIfAborted(
  signal: AbortSignal,
  nodeResults: readonly NodeRunResult[],
): void {
  if (signal.aborted) {
    throw new FlowExecutionAbortedError(nodeResults);
  }
}

function elapsedMs(clock: ExecutionClock, startedMs: number): number {
  return Math.max(0, clock.nowMs() - startedMs);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Node execution failed.";
}
