import {
  flowGraphSchema,
  textInputConfigSchema,
  textOutputConfigSchema,
  topologicalSort,
  validateExecutable,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type ValidationIssue,
} from "@ai-flow-builder/flow-core";
import type {
  CodeGenerationRequest,
  CodeGenerator,
} from "../code-generator.js";
import {
  TYPESCRIPT_LANGUAGE_ID,
  type CodegenWarning,
  type GeneratedBundle,
} from "../generated-bundle.js";
import { formatTypeScript } from "./format.js";
import { createStableNodeVariableNames } from "./naming.js";
import {
  builtInTypeScriptNodeEmitters,
  createTypeScriptNodeEmitterRegistry,
  type TypeScriptExpressionMap,
  type TypeScriptNodeEmitterRegistry,
} from "./emitters/index.js";
import { emitFlowApiTypes, emitRunFlowSignature } from "./runtime-api.js";

export interface TypeScriptGeneratorDependencies {
  readonly emitterRegistry?: TypeScriptNodeEmitterRegistry;
  readonly formatSource?: (source: string) => Promise<string> | string;
}

export class TypeScriptGeneratorError extends Error {
  public override readonly name = "TypeScriptGeneratorError";

  public constructor(
    message: string,
    public readonly issues: readonly ValidationIssue[] = [],
  ) {
    super(message);
  }
}

export class TypeScriptGenerator implements CodeGenerator {
  public readonly language = TYPESCRIPT_LANGUAGE_ID;

  private readonly emitterRegistry: TypeScriptNodeEmitterRegistry;
  private readonly formatSource: (source: string) => Promise<string> | string;

  public constructor(dependencies: TypeScriptGeneratorDependencies = {}) {
    this.emitterRegistry =
      dependencies.emitterRegistry ??
      createTypeScriptNodeEmitterRegistry(builtInTypeScriptNodeEmitters);
    this.formatSource = dependencies.formatSource ?? formatTypeScript;
  }

  public async generate(
    request: CodeGenerationRequest,
  ): Promise<GeneratedBundle> {
    const validation = validateExecutable(request.graph);

    if (!validation.valid) {
      throw new TypeScriptGeneratorError(
        "The flow graph is not executable.",
        validation.issues,
      );
    }

    const graph = flowGraphSchema.parse(request.graph);
    const activeNodeIds = collectActiveNodeIds(graph);
    const activeNodes = graph.nodes.filter((node) =>
      activeNodeIds.has(node.id),
    );
    const source = assembleTypeScriptSource(graph, {
      activeNodeIds,
      activeNodes,
      emitterRegistry: this.emitterRegistry,
    });
    const formattedSource = await this.formatSource(source);

    return {
      entrypoint: "flow.ts",
      files: [
        {
          content: formattedSource,
          path: "flow.ts",
        },
      ],
      language: TYPESCRIPT_LANGUAGE_ID,
      warnings: validation.issues
        .filter((issue) => issue.severity === "warning")
        .map(toCodegenWarning),
    };
  }
}

export function createTypeScriptGenerator(
  dependencies: TypeScriptGeneratorDependencies = {},
): TypeScriptGenerator {
  return new TypeScriptGenerator(dependencies);
}

function assembleTypeScriptSource(
  graph: FlowGraph,
  input: {
    readonly activeNodeIds: ReadonlySet<string>;
    readonly activeNodes: readonly FlowNode[];
    readonly emitterRegistry: TypeScriptNodeEmitterRegistry;
  },
): string {
  const nodeNames = createStableNodeVariableNames(input.activeNodes, [
    "deps",
    "inputs",
    "outputs",
  ]);
  const executionOrder = getTopologicalNodeOrder(graph, input.activeNodeIds);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingEdgesByTarget = collectIncomingEdgesByTarget(
    graph,
    input.activeNodeIds,
  );
  const nodeOutputExpressions = new Map<string, TypeScriptExpressionMap>();
  const bodyStatements = [
    "const outputs: Record<string, string> = {};",
    "",
    ...emitNodeStatements({
      emitterRegistry: input.emitterRegistry,
      executionOrder,
      incomingEdgesByTarget,
      nodeNames,
      nodeOutputExpressions,
      nodesById,
    }),
    "",
    "return outputs as unknown as FlowOutputs;",
  ];

  return [
    ...emitFlowApiTypes({
      inputKeys: collectInputKeys(input.activeNodes),
      outputKeys: collectOutputKeys(input.activeNodes),
      requiresTextGeneration: input.activeNodes.some(
        (node) => node.kind === "ai.text.generate",
      ),
    }),
    "",
    emitRunFlowSignature(),
    ...bodyStatements.map((line) => indentLine(line)),
    "}",
    "",
  ].join("\n");
}

function emitNodeStatements(input: {
  readonly emitterRegistry: TypeScriptNodeEmitterRegistry;
  readonly executionOrder: readonly string[];
  readonly incomingEdgesByTarget: ReadonlyMap<string, readonly FlowEdge[]>;
  readonly nodeNames: ReadonlyMap<string, string>;
  readonly nodeOutputExpressions: Map<string, TypeScriptExpressionMap>;
  readonly nodesById: ReadonlyMap<string, FlowNode>;
}): readonly string[] {
  const statements: string[] = [];

  for (const nodeId of input.executionOrder) {
    const node = input.nodesById.get(nodeId);
    const nodeVariableName = input.nodeNames.get(nodeId);

    if (node === undefined || nodeVariableName === undefined) {
      continue;
    }

    const emission = input.emitterRegistry
      .get(node.kind, node.specVersion)
      .emit({
        inputExpressions: resolveInputExpressions({
          incomingEdges: input.incomingEdgesByTarget.get(node.id) ?? [],
          nodeOutputExpressions: input.nodeOutputExpressions,
        }),
        node,
        nodeVariableName,
      });

    statements.push(
      `// Flow node: ${node.label} (${node.kind}@${node.specVersion})`,
      `// Flow node ID: ${node.id}`,
      ...emission.statements,
      "",
    );
    input.nodeOutputExpressions.set(node.id, emission.outputExpressions);
  }

  if (statements.at(-1) === "") {
    statements.pop();
  }

  return statements;
}

function resolveInputExpressions(input: {
  readonly incomingEdges: readonly FlowEdge[];
  readonly nodeOutputExpressions: ReadonlyMap<string, TypeScriptExpressionMap>;
}): TypeScriptExpressionMap {
  const expressions: Record<string, string> = {};

  for (const edge of input.incomingEdges) {
    const sourceOutputs = input.nodeOutputExpressions.get(edge.source.nodeId);
    const expression = sourceOutputs?.[edge.source.portId];

    if (expression === undefined) {
      throw new TypeScriptGeneratorError(
        `Missing generated expression for ${edge.source.nodeId}.${edge.source.portId}.`,
      );
    }

    expressions[edge.target.portId] = expression;
  }

  return expressions;
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

function getTopologicalNodeOrder(
  graph: FlowGraph,
  activeNodeIds: ReadonlySet<string>,
): readonly string[] {
  const sorted = topologicalSort(graph);

  if (sorted.status === "cycle") {
    throw new TypeScriptGeneratorError(
      "The flow graph contains a cycle.",
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

function collectInputKeys(nodes: readonly FlowNode[]): readonly string[] {
  return nodes
    .filter((node) => node.kind === "core.input.text")
    .map((node) => textInputConfigSchema.parse(node.config).key);
}

function collectOutputKeys(nodes: readonly FlowNode[]): readonly string[] {
  return nodes
    .filter((node) => node.kind === "core.output.text")
    .map((node) => textOutputConfigSchema.parse(node.config).key);
}

function toCodegenWarning(issue: ValidationIssue): CodegenWarning {
  return {
    code: issue.code,
    message: issue.message,
    ...(issue.nodeId === undefined ? {} : { nodeId: issue.nodeId }),
    ...(issue.path === undefined ? {} : { path: issue.path }),
  };
}

function indentLine(line: string): string {
  return line.length === 0 ? "" : `  ${line}`;
}
