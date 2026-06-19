import { topologicalSort } from "../graph/topological-sort.js";
import { getNodeSpec } from "../nodes/registry.js";
import {
  textInputConfigSchema,
  textOutputConfigSchema,
  textTemplateConfigSchema,
} from "../nodes/builtins.js";
import { flowGraphSchema, type FlowGraph } from "../schemas/flow-graph.js";
import {
  validationIssueCodes,
  validationResult,
  type ValidationIssue,
  type ValidationResult,
} from "./issues.js";
import { validateStorage } from "./validate-storage.js";

const templatePlaceholderPattern = /{{([^{}]*)}}/g;

export const validateExecutable = (input: unknown): ValidationResult => {
  const storageResult = validateStorage(input);
  if (!storageResult.valid) {
    return storageResult;
  }

  const graph = flowGraphSchema.parse(input);
  const issues: ValidationIssue[] = [...storageResult.issues];

  issues.push(...validateRequiredInputs(graph));
  issues.push(...validateCycles(graph));
  issues.push(...validateUniqueRuntimeKeys(graph));
  issues.push(...validateOutputPresence(graph));
  issues.push(...validateTemplatePlaceholders(graph));
  issues.push(...validateOutputReachability(graph));

  return validationResult(issues);
};

const validateRequiredInputs = (graph: FlowGraph): ValidationIssue[] => {
  const connectedInputKeys = new Set(
    graph.edges.map((edge) => `${edge.target.nodeId}:${edge.target.portId}`),
  );
  const issues: ValidationIssue[] = [];

  for (const [nodeIndex, node] of graph.nodes.entries()) {
    const spec = getNodeSpec(node.kind, node.specVersion);

    for (const inputPort of spec.inputs) {
      if (
        inputPort.required &&
        !connectedInputKeys.has(`${node.id}:${inputPort.id}`)
      ) {
        issues.push({
          severity: "error",
          code: validationIssueCodes.requiredInputNotConnected,
          message: `Required input port "${inputPort.id}" on node "${node.label}" is not connected.`,
          nodeId: node.id,
          path: `nodes.${nodeIndex}`,
        });
      }
    }
  }

  return issues;
};

const validateCycles = (graph: FlowGraph): ValidationIssue[] => {
  const sorted = topologicalSort(graph);

  if (sorted.status === "ok") {
    return [];
  }

  return sorted.cycleNodeIds.map((nodeId) => ({
    severity: "error",
    code: validationIssueCodes.graphHasCycle,
    message: `Node "${nodeId}" is part of a cycle.`,
    nodeId,
  }));
};

const validateUniqueRuntimeKeys = (graph: FlowGraph): ValidationIssue[] => [
  ...findDuplicateRuntimeKeys({
    graph,
    kind: "core.input.text",
    code: validationIssueCodes.duplicateTextInputKey,
    getKey: (config) => textInputConfigSchema.parse(config).key,
    label: "Text Input",
  }),
  ...findDuplicateRuntimeKeys({
    graph,
    kind: "core.output.text",
    code: validationIssueCodes.duplicateTextOutputKey,
    getKey: (config) => textOutputConfigSchema.parse(config).key,
    label: "Text Output",
  }),
];

const findDuplicateRuntimeKeys = ({
  graph,
  kind,
  code,
  getKey,
  label,
}: {
  readonly graph: FlowGraph;
  readonly kind: "core.input.text" | "core.output.text";
  readonly code: string;
  readonly getKey: (config: unknown) => string;
  readonly label: string;
}): ValidationIssue[] => {
  const firstNodeByKey = new Map<string, { nodeId: string; index: number }>();
  const issues: ValidationIssue[] = [];

  for (const [index, node] of graph.nodes.entries()) {
    if (node.kind !== kind) {
      continue;
    }

    const key = getKey(node.config);
    const firstNode = firstNodeByKey.get(key);
    if (firstNode === undefined) {
      firstNodeByKey.set(key, { nodeId: node.id, index });
      continue;
    }

    issues.push({
      severity: "error",
      code,
      message: `${label} key "${key}" is already used by node "${firstNode.nodeId}".`,
      nodeId: node.id,
      path: `nodes.${index}.config.key`,
    });
  }

  return issues;
};

const validateOutputPresence = (graph: FlowGraph): ValidationIssue[] =>
  graph.nodes.some((node) => node.kind === "core.output.text")
    ? []
    : [
        {
          severity: "error",
          code: validationIssueCodes.outputNodeRequired,
          message: "At least one Text Output node is required.",
        },
      ];

const validateTemplatePlaceholders = (graph: FlowGraph): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const [index, node] of graph.nodes.entries()) {
    if (node.kind !== "core.text.template") {
      continue;
    }

    const config = textTemplateConfigSchema.parse(node.config);
    for (const match of config.template.matchAll(templatePlaceholderPattern)) {
      const placeholder = match[1] ?? "";
      if (placeholder !== "input") {
        issues.push({
          severity: "error",
          code: validationIssueCodes.unknownTemplatePlaceholder,
          message: `Template placeholder "{{${placeholder}}}" is not supported. Use "{{input}}".`,
          nodeId: node.id,
          path: `nodes.${index}.config.template`,
        });
      }
    }
  }

  return issues;
};

const validateOutputReachability = (graph: FlowGraph): ValidationIssue[] => {
  const outputNodeIds = graph.nodes
    .filter((node) => node.kind === "core.output.text")
    .map((node) => node.id);

  if (outputNodeIds.length === 0) {
    return [];
  }

  const reachingOutputNodeIds = collectNodesReachingOutputs(
    graph,
    outputNodeIds,
  );
  const issues: ValidationIssue[] = [];

  for (const [index, node] of graph.nodes.entries()) {
    if (reachingOutputNodeIds.has(node.id)) {
      continue;
    }

    issues.push({
      severity: "warning",
      code: validationIssueCodes.nodeNotReachingOutput,
      message: `Node "${node.label}" does not reach any Text Output node.`,
      nodeId: node.id,
      path: `nodes.${index}`,
    });

    if (node.kind === "core.input.text") {
      const config = textInputConfigSchema.parse(node.config);
      issues.push({
        severity: "warning",
        code: validationIssueCodes.unusedInputNode,
        message: `Text Input "${config.key}" is not used by any Text Output node.`,
        nodeId: node.id,
        path: `nodes.${index}`,
      });
    }
  }

  return issues;
};

const collectNodesReachingOutputs = (
  graph: FlowGraph,
  outputNodeIds: readonly string[],
): ReadonlySet<string> => {
  const incomingNodeIdsByTarget = new Map<string, string[]>();

  for (const edge of graph.edges) {
    const incomingNodeIds =
      incomingNodeIdsByTarget.get(edge.target.nodeId) ?? [];
    incomingNodeIds.push(edge.source.nodeId);
    incomingNodeIdsByTarget.set(edge.target.nodeId, incomingNodeIds);
  }

  const visited = new Set<string>();
  const stack = [...outputNodeIds];

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (nodeId === undefined || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    for (const sourceNodeId of incomingNodeIdsByTarget.get(nodeId) ?? []) {
      if (!visited.has(sourceNodeId)) {
        stack.push(sourceNodeId);
      }
    }
  }

  return visited;
};
