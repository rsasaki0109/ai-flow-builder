import {
  FLOW_GRAPH_SCHEMA_VERSION,
  flowGraphSchema,
  getNodeSpec,
  layoutFlowGraph,
  pathToString,
  type FlowGraph,
} from "@ai-flow-builder/flow-core";
import { flowPlanSchema, type FlowPlan } from "./flow-plan-schema.js";

export const flowPlanNormalizationIssueCodes = {
  invalidFlowPlan: "INVALID_FLOW_PLAN",
  edgeSourceRefNotFound: "EDGE_SOURCE_REF_NOT_FOUND",
  edgeTargetRefNotFound: "EDGE_TARGET_REF_NOT_FOUND",
  invalidGeneratedGraph: "INVALID_GENERATED_GRAPH",
} as const;

export type FlowPlanNormalizationIssueCode =
  (typeof flowPlanNormalizationIssueCodes)[keyof typeof flowPlanNormalizationIssueCodes];

export interface FlowPlanNormalizationIssue {
  readonly code: FlowPlanNormalizationIssueCode;
  readonly message: string;
  readonly path?: string;
}

export class FlowPlanNormalizationError extends Error {
  public override readonly name = "FlowPlanNormalizationError";
  public readonly issues: readonly FlowPlanNormalizationIssue[];

  public constructor(issues: readonly FlowPlanNormalizationIssue[]) {
    super("Flow plan normalization failed.");
    this.issues = issues;
  }
}

export interface NormalizeFlowPlanOptions {
  readonly idFactory?: () => string;
}

export interface NormalizedFlowPlan {
  readonly name: string;
  readonly description: string;
  readonly graph: FlowGraph;
  readonly assumptions: readonly string[];
  readonly unsupportedRequirements: readonly string[];
  readonly nodeIdByRef: ReadonlyMap<string, string>;
}

export function normalizeFlowPlan(
  input: unknown,
  options: NormalizeFlowPlanOptions = {},
): NormalizedFlowPlan {
  const plan = parseFlowPlan(input);
  const idFactory = options.idFactory ?? createRandomId;
  const nodeIdByRef = createNodeIdMap(plan, idFactory);
  const nodeRefById = new Map<string, string>();

  for (const [ref, nodeId] of nodeIdByRef) {
    nodeRefById.set(nodeId, ref);
  }

  const nodes = plan.nodes.map((node) => {
    const spec = getNodeSpec(node.kind, 1);
    const nodeId = nodeIdByRef.get(node.ref);

    if (nodeId === undefined) {
      throw new FlowPlanNormalizationError([
        {
          code: flowPlanNormalizationIssueCodes.invalidFlowPlan,
          message: `Node ref "${node.ref}" was not assigned an ID.`,
        },
      ]);
    }

    return {
      id: nodeId,
      kind: node.kind,
      specVersion: 1,
      position: { x: 0, y: 0 },
      label: normalizeNonEmptyText(node.label, spec.defaultLabel),
      config: spec.configSchema.parse(node.config),
    };
  });

  const edgeIssues: FlowPlanNormalizationIssue[] = [];
  const edges = plan.edges.flatMap((edge, index) => {
    const sourceNodeId = nodeIdByRef.get(edge.sourceRef);
    const targetNodeId = nodeIdByRef.get(edge.targetRef);

    if (sourceNodeId === undefined) {
      edgeIssues.push({
        code: flowPlanNormalizationIssueCodes.edgeSourceRefNotFound,
        message: `Edge source ref "${edge.sourceRef}" does not exist.`,
        path: `edges.${index}.sourceRef`,
      });
    }

    if (targetNodeId === undefined) {
      edgeIssues.push({
        code: flowPlanNormalizationIssueCodes.edgeTargetRefNotFound,
        message: `Edge target ref "${edge.targetRef}" does not exist.`,
        path: `edges.${index}.targetRef`,
      });
    }

    if (sourceNodeId === undefined || targetNodeId === undefined) {
      return [];
    }

    return [
      {
        id: idFactory(),
        source: {
          nodeId: sourceNodeId,
          portId: edge.sourcePort,
        },
        target: {
          nodeId: targetNodeId,
          portId: edge.targetPort,
        },
      },
    ];
  });

  if (edgeIssues.length > 0) {
    throw new FlowPlanNormalizationError(edgeIssues);
  }

  const graph = parseGeneratedGraph({
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  return {
    name: normalizeNonEmptyText(plan.title, "Untitled Flow"),
    description: plan.description.trim(),
    graph: layoutFlowGraph(graph, {
      sortKeyByNodeId: (nodeId) => nodeRefById.get(nodeId) ?? nodeId,
    }),
    assumptions: normalizeTextList(plan.assumptions),
    unsupportedRequirements: normalizeTextList(plan.unsupportedRequirements),
    nodeIdByRef,
  };
}

function parseFlowPlan(input: unknown): FlowPlan {
  const parsed = flowPlanSchema.safeParse(input);

  if (!parsed.success) {
    throw new FlowPlanNormalizationError(
      parsed.error.issues.map((issue) => ({
        code: flowPlanNormalizationIssueCodes.invalidFlowPlan,
        message: issue.message,
        ...(issue.path.length > 0 ? { path: pathToString(issue.path) } : {}),
      })),
    );
  }

  return parsed.data;
}

function createNodeIdMap(
  plan: FlowPlan,
  idFactory: () => string,
): ReadonlyMap<string, string> {
  const nodeIdByRef = new Map<string, string>();

  for (const node of plan.nodes) {
    nodeIdByRef.set(node.ref, idFactory());
  }

  return nodeIdByRef;
}

function parseGeneratedGraph(input: unknown): FlowGraph {
  const parsed = flowGraphSchema.safeParse(input);

  if (!parsed.success) {
    throw new FlowPlanNormalizationError(
      parsed.error.issues.map((issue) => ({
        code: flowPlanNormalizationIssueCodes.invalidGeneratedGraph,
        message: issue.message,
        ...(issue.path.length > 0 ? { path: pathToString(issue.path) } : {}),
      })),
    );
  }

  return parsed.data;
}

function normalizeNonEmptyText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed;
}

function normalizeTextList(values: readonly string[]): readonly string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}
