import type { FlowRepository } from "@ai-flow-builder/db";
import {
  executeFlow,
  FlowExecutionAbortedError,
  FlowNotExecutableExecutionError,
  MissingRuntimeInputError,
  NodeExecutionFailedError,
  NodeOutputTooLargeError,
  type ExecuteFlowInput,
  type FlowExecutionServices,
  type RunResult,
  type TextGenerationService,
} from "@ai-flow-builder/flow-engine";
import {
  AiProviderError,
  AppError,
  FlowNotExecutableError,
  FlowNotFoundError,
  InvalidRequestError,
  MissingFlowInputError,
  TimeoutError,
} from "../errors.js";

type ExecuteFlowFn = (input: ExecuteFlowInput) => Promise<RunResult>;

export interface RunFlowServiceOptions {
  readonly textGenerationService: TextGenerationService;
  readonly timeoutMs: number;
  readonly executeFlowFn?: ExecuteFlowFn;
}

export interface RunFlowInput {
  readonly flowId: string;
  readonly inputs: Record<string, string>;
  readonly signal?: AbortSignal;
}

export class RunFlowService {
  private readonly textGenerationService: TextGenerationService;
  private readonly timeoutMs: number;
  private readonly executeFlowFn: ExecuteFlowFn;

  public constructor(
    private readonly flowRepository: FlowRepository,
    options: RunFlowServiceOptions,
  ) {
    this.textGenerationService = options.textGenerationService;
    this.timeoutMs = options.timeoutMs;
    this.executeFlowFn = options.executeFlowFn ?? executeFlow;
  }

  public async run(input: RunFlowInput): Promise<RunResult> {
    const flow = await this.flowRepository.findById(input.flowId);
    if (flow === null) {
      throw new FlowNotFoundError(input.flowId);
    }

    const timeout = createTimeoutAbortController(this.timeoutMs);
    const combinedSignal = combineAbortSignals([
      ...(input.signal === undefined ? [] : [input.signal]),
      timeout.signal,
    ]);

    try {
      return await this.executeFlowFn({
        graph: flow.graph,
        inputs: input.inputs,
        services: this.createExecutionServices(),
        signal: combinedSignal.signal,
      });
    } catch (error) {
      throw this.mapExecutionError(error, timeout.timedOut);
    } finally {
      timeout.dispose();
      combinedSignal.dispose();
    }
  }

  private createExecutionServices(): FlowExecutionServices {
    return {
      textGeneration: this.textGenerationService,
    };
  }

  private mapExecutionError(error: unknown, timedOut: boolean): Error {
    if (timedOut) {
      return new TimeoutError("flow_run");
    }

    if (error instanceof FlowNotExecutableExecutionError) {
      return new FlowNotExecutableError(error.issues);
    }

    if (error instanceof FlowExecutionAbortedError) {
      return new TimeoutError("flow_run");
    }

    if (error instanceof NodeExecutionFailedError) {
      return mapNodeExecutionFailure(error);
    }

    if (error instanceof AppError) {
      return error;
    }

    return new AiProviderError("Flow execution failed.", error);
  }
}

function mapNodeExecutionFailure(error: NodeExecutionFailedError): Error {
  const originalError = error.originalError;

  if (originalError instanceof MissingRuntimeInputError) {
    return new MissingFlowInputError(originalError.inputKey);
  }

  if (originalError instanceof NodeOutputTooLargeError) {
    return new InvalidRequestError("A node output exceeded the size limit.", {
      nodeId: originalError.nodeId,
      outputKey: originalError.outputKey,
      maxLength: originalError.limit,
    });
  }

  if (originalError instanceof AppError) {
    return originalError;
  }

  return error;
}

function createTimeoutAbortController(timeoutMs: number): {
  readonly signal: AbortSignal;
  readonly timedOut: boolean;
  dispose(): void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    dispose() {
      clearTimeout(timeoutId);
    },
  };
}

function combineAbortSignals(signals: readonly AbortSignal[]): {
  readonly signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose() {
      for (const signal of signals) {
        signal.removeEventListener("abort", abort);
      }
    },
  };
}
