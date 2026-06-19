import { findNodeSpec } from "../nodes/registry.js";
import type { PortDataType, PortSpec } from "../nodes/node-spec.js";
import {
  flowGraphSchema,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
} from "../schemas/flow-graph.js";
import {
  pathToString,
  validationIssueCodes,
  validationResult,
  type ValidationIssue,
  type ValidationResult,
} from "./issues.js";

export const isPortDataTypeCompatible = (
  source: PortDataType,
  target: PortDataType,
): boolean => source === target || source === "any" || target === "any";

export const validateStorage = (input: unknown): ValidationResult => {
  const parsed = flowGraphSchema.safeParse(input);

  if (!parsed.success) {
    return validationResult(
      parsed.error.issues.map((issue) => {
        const path = pathToString(issue.path);

        return {
          severity: "error",
          code: validationIssueCodes.invalidFlowSchema,
          message: `Invalid flow graph document: ${issue.message}`,
          ...(path.length > 0 ? { path } : {}),
        };
      }),
    );
  }

  const graph = parsed.data;
  const issues: ValidationIssue[] = [];

  issues.push(...validateUniqueIds(graph));

  const nodesById = new Map<string, FlowNode>();
  for (const node of graph.nodes) {
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
    }
  }

  const nodeSpecsByNodeId = new Map<
    string,
    NonNullable<ReturnType<typeof findNodeSpec>>
  >();

  for (const [index, node] of graph.nodes.entries()) {
    const spec = findNodeSpec(node.kind, node.specVersion);
    if (spec === null) {
      issues.push({
        severity: "error",
        code: validationIssueCodes.unknownNodeSpec,
        message: `Node kind "${node.kind}" version ${node.specVersion} is not supported.`,
        nodeId: node.id,
        path: `nodes.${index}`,
      });
      continue;
    }

    nodeSpecsByNodeId.set(node.id, spec);

    const configResult = spec.configSchema.safeParse(node.config);
    if (!configResult.success) {
      for (const configIssue of configResult.error.issues) {
        const subPath = pathToString(configIssue.path);
        issues.push({
          severity: "error",
          code: validationIssueCodes.invalidNodeConfig,
          message: `Invalid config for ${spec.displayName}: ${configIssue.message}`,
          nodeId: node.id,
          path:
            subPath.length > 0
              ? `nodes.${index}.config.${subPath}`
              : `nodes.${index}.config`,
        });
      }
    }
  }

  issues.push(...validateEdges(graph, nodesById, nodeSpecsByNodeId));

  return validationResult(issues);
};

const validateUniqueIds = (graph: FlowGraph): ValidationIssue[] => [
  ...findDuplicateIssues({
    values: graph.nodes.map((node) => node.id),
    code: validationIssueCodes.duplicateNodeId,
    message: (id) => `Duplicate node ID "${id}".`,
    pathPrefix: "nodes",
  }),
  ...findDuplicateIssues({
    values: graph.edges.map((edge) => edge.id),
    code: validationIssueCodes.duplicateEdgeId,
    message: (id) => `Duplicate edge ID "${id}".`,
    pathPrefix: "edges",
  }),
];

const findDuplicateIssues = ({
  values,
  code,
  message,
  pathPrefix,
}: {
  readonly values: readonly string[];
  readonly code: string;
  readonly message: (value: string) => string;
  readonly pathPrefix: string;
}): ValidationIssue[] => {
  const firstIndexByValue = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  for (const [index, value] of values.entries()) {
    const firstIndex = firstIndexByValue.get(value);
    if (firstIndex === undefined) {
      firstIndexByValue.set(value, index);
      continue;
    }

    issues.push({
      severity: "error",
      code,
      message: `${message(value)} First occurrence is at ${pathPrefix}.${firstIndex}.`,
      path: `${pathPrefix}.${index}.id`,
    });
  }

  return issues;
};

const validateEdges = (
  graph: FlowGraph,
  nodesById: ReadonlyMap<string, FlowNode>,
  nodeSpecsByNodeId: ReadonlyMap<
    string,
    NonNullable<ReturnType<typeof findNodeSpec>>
  >,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const targetInputEdgeByKey = new Map<string, FlowEdge>();

  for (const [index, edge] of graph.edges.entries()) {
    const sourceNode = nodesById.get(edge.source.nodeId);
    const targetNode = nodesById.get(edge.target.nodeId);

    if (sourceNode === undefined) {
      issues.push({
        severity: "error",
        code: validationIssueCodes.edgeSourceNodeNotFound,
        message: `Source node "${edge.source.nodeId}" does not exist.`,
        edgeId: edge.id,
        path: `edges.${index}.source.nodeId`,
      });
    }

    if (targetNode === undefined) {
      issues.push({
        severity: "error",
        code: validationIssueCodes.edgeTargetNodeNotFound,
        message: `Target node "${edge.target.nodeId}" does not exist.`,
        edgeId: edge.id,
        path: `edges.${index}.target.nodeId`,
      });
    }

    if (edge.source.nodeId === edge.target.nodeId) {
      issues.push({
        severity: "error",
        code: validationIssueCodes.selfLoopEdge,
        message: `Edge "${edge.id}" cannot connect a node to itself.`,
        edgeId: edge.id,
        path: `edges.${index}`,
      });
    }

    const sourcePort =
      sourceNode === undefined
        ? null
        : validateEdgePort({
            direction: "source",
            edge,
            edgeIndex: index,
            node: sourceNode,
            portId: edge.source.portId,
            expectedDirection: "output",
            spec: nodeSpecsByNodeId.get(sourceNode.id) ?? null,
          });
    const targetPort =
      targetNode === undefined
        ? null
        : validateEdgePort({
            direction: "target",
            edge,
            edgeIndex: index,
            node: targetNode,
            portId: edge.target.portId,
            expectedDirection: "input",
            spec: nodeSpecsByNodeId.get(targetNode.id) ?? null,
          });

    if (sourcePort?.issue !== undefined) {
      issues.push(sourcePort.issue);
    }
    if (targetPort?.issue !== undefined) {
      issues.push(targetPort.issue);
    }

    if (
      sourcePort?.port !== undefined &&
      sourcePort.port.direction === "output" &&
      targetPort?.port !== undefined &&
      targetPort.port.direction === "input"
    ) {
      if (
        !isPortDataTypeCompatible(
          sourcePort.port.dataType,
          targetPort.port.dataType,
        )
      ) {
        issues.push({
          severity: "error",
          code: validationIssueCodes.edgePortTypeMismatch,
          message: `Cannot connect ${sourcePort.port.dataType} output to ${targetPort.port.dataType} input.`,
          edgeId: edge.id,
          path: `edges.${index}`,
        });
      }

      const targetInputKey = `${edge.target.nodeId}:${edge.target.portId}`;
      const existingEdge = targetInputEdgeByKey.get(targetInputKey);
      if (existingEdge === undefined) {
        targetInputEdgeByKey.set(targetInputKey, edge);
      } else {
        issues.push({
          severity: "error",
          code: validationIssueCodes.duplicateTargetInput,
          message: `Input port "${edge.target.portId}" on node "${edge.target.nodeId}" already has an incoming edge "${existingEdge.id}".`,
          edgeId: edge.id,
          path: `edges.${index}.target`,
        });
      }
    }
  }

  return issues;
};

const validateEdgePort = ({
  direction,
  edge,
  edgeIndex,
  node,
  portId,
  expectedDirection,
  spec,
}: {
  readonly direction: "source" | "target";
  readonly edge: FlowEdge;
  readonly edgeIndex: number;
  readonly node: FlowNode;
  readonly portId: string;
  readonly expectedDirection: PortSpec["direction"];
  readonly spec: NonNullable<ReturnType<typeof findNodeSpec>> | null;
}): { readonly port?: PortSpec; readonly issue?: ValidationIssue } => {
  if (spec === null) {
    return {};
  }

  const port = [...spec.inputs, ...spec.outputs].find(
    (candidate) => candidate.id === portId,
  );

  if (port === undefined) {
    return {
      issue: {
        severity: "error",
        code:
          direction === "source"
            ? validationIssueCodes.edgeSourcePortNotFound
            : validationIssueCodes.edgeTargetPortNotFound,
        message: `${capitalize(direction)} port "${portId}" does not exist on node "${node.id}".`,
        edgeId: edge.id,
        path: `edges.${edgeIndex}.${direction}.portId`,
      },
    };
  }

  if (port.direction !== expectedDirection) {
    return {
      port,
      issue: {
        severity: "error",
        code:
          direction === "source"
            ? validationIssueCodes.edgeSourcePortDirectionInvalid
            : validationIssueCodes.edgeTargetPortDirectionInvalid,
        message: `${capitalize(direction)} port "${portId}" on node "${node.id}" is a ${port.direction} port.`,
        edgeId: edge.id,
        path: `edges.${edgeIndex}.${direction}.portId`,
      },
    };
  }

  return { port };
};

const capitalize = (value: string): string =>
  value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
