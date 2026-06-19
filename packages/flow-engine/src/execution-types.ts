import type {
  FlowGraph,
  FlowNode,
  FlowNodeKind,
} from "@ai-flow-builder/flow-core";
import type { ExecutorRegistry } from "./executor-registry.js";

export interface TextGenerationRequest {
  readonly systemPrompt?: string;
  readonly prompt: string;
  readonly signal: AbortSignal;
}

export interface TextGenerationResult {
  readonly text: string;
}

export interface TextGenerationService {
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
}

export interface FlowExecutionServices {
  readonly textGeneration: TextGenerationService;
}

export interface ExecutionClock {
  nowMs(): number;
  nowIso(): string;
}

export type TextPortValues = Record<string, string>;

export type ExecutableFlowNode<TConfig> = FlowNode & {
  readonly config: TConfig;
};

export interface NodeExecutionContext<TConfig> {
  readonly node: ExecutableFlowNode<TConfig>;
  readonly inputs: TextPortValues;
  readonly services: FlowExecutionServices;
  readonly signal: AbortSignal;
}

export interface NodeExecutionOutput {
  readonly outputs: TextPortValues;
}

export interface NodeExecutor<TConfig = unknown> {
  readonly kind: FlowNodeKind;
  readonly version: number;
  execute(context: NodeExecutionContext<TConfig>): Promise<NodeExecutionOutput>;
}

export interface SucceededNodeRunResult {
  readonly nodeId: string;
  readonly status: "succeeded";
  readonly durationMs: number;
  readonly outputPreview: string;
}

export interface FailedNodeRunResult {
  readonly nodeId: string;
  readonly status: "failed";
  readonly durationMs: number;
  readonly errorMessage: string;
}

export type NodeRunResult = SucceededNodeRunResult | FailedNodeRunResult;

export interface RunResult {
  readonly status: "succeeded";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outputs: Record<string, string>;
  readonly nodeResults: readonly NodeRunResult[];
}

export interface ExecuteFlowInput {
  readonly graph: FlowGraph;
  readonly inputs: Record<string, string>;
  readonly services: FlowExecutionServices;
  readonly signal: AbortSignal;
  readonly registry?: ExecutorRegistry;
  readonly clock?: ExecutionClock;
}
