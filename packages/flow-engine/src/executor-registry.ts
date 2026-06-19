import type { FlowNodeKind } from "@ai-flow-builder/flow-core";
import type { NodeExecutor } from "./execution-types.js";

export class DuplicateNodeExecutorError extends Error {
  public override readonly name = "DuplicateNodeExecutorError";

  public constructor(
    public readonly kind: FlowNodeKind,
    public readonly version: number,
  ) {
    super(`Duplicate node executor: ${kind}@${version}`);
  }
}

export class UnknownNodeExecutorError extends Error {
  public override readonly name = "UnknownNodeExecutorError";

  public constructor(
    public readonly kind: FlowNodeKind,
    public readonly version: number,
  ) {
    super(`Unknown node executor: ${kind}@${version}`);
  }
}

export class ExecutorRegistry {
  private readonly executorsByKey = new Map<string, NodeExecutor>();

  public constructor(executors: readonly NodeExecutor[] = []) {
    for (const executor of executors) {
      this.register(executor);
    }
  }

  public register(executor: NodeExecutor): void {
    const key = createExecutorKey(executor.kind, executor.version);

    if (this.executorsByKey.has(key)) {
      throw new DuplicateNodeExecutorError(executor.kind, executor.version);
    }

    this.executorsByKey.set(key, executor);
  }

  public find(kind: FlowNodeKind, version: number): NodeExecutor | null {
    return this.executorsByKey.get(createExecutorKey(kind, version)) ?? null;
  }

  public get(kind: FlowNodeKind, version: number): NodeExecutor {
    const executor = this.find(kind, version);

    if (executor === null) {
      throw new UnknownNodeExecutorError(kind, version);
    }

    return executor;
  }

  public list(): readonly NodeExecutor[] {
    return [...this.executorsByKey.values()];
  }
}

export function createExecutorRegistry(
  executors: readonly NodeExecutor[] = [],
): ExecutorRegistry {
  return new ExecutorRegistry(executors);
}

function createExecutorKey(kind: FlowNodeKind, version: number): string {
  return `${kind}@${version}`;
}
