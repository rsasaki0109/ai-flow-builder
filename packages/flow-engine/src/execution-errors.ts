import type { ValidationIssue } from "@ai-flow-builder/flow-core";
import type { NodeRunResult } from "./execution-types.js";

export class MissingNodeInputError extends Error {
  public override readonly name = "MissingNodeInputError";

  public constructor(
    public readonly nodeId: string,
    public readonly inputKey: string,
  ) {
    super(`Missing input "${inputKey}" for node "${nodeId}".`);
  }
}

export class MissingRuntimeInputError extends Error {
  public override readonly name = "MissingRuntimeInputError";

  public constructor(
    public readonly nodeId: string,
    public readonly inputKey: string,
  ) {
    super(`Missing required runtime input "${inputKey}" for node "${nodeId}".`);
  }
}

export class UnknownTemplatePlaceholderError extends Error {
  public override readonly name = "UnknownTemplatePlaceholderError";

  public constructor(
    public readonly nodeId: string,
    public readonly placeholder: string,
  ) {
    super(
      `Template placeholder "{{${placeholder}}}" is not supported for node "${nodeId}".`,
    );
  }
}

export class NodeOutputTooLargeError extends Error {
  public override readonly name = "NodeOutputTooLargeError";

  public constructor(
    public readonly nodeId: string,
    public readonly outputKey: string,
    public readonly length: number,
    public readonly limit: number,
  ) {
    super(
      `Output "${outputKey}" for node "${nodeId}" is ${length} characters, exceeding the ${limit} character limit.`,
    );
  }
}

export class MissingNodeOutputError extends Error {
  public override readonly name = "MissingNodeOutputError";

  public constructor(
    public readonly nodeId: string,
    public readonly outputKey: string,
  ) {
    super(`Missing output "${outputKey}" for node "${nodeId}".`);
  }
}

export class FlowNotExecutableExecutionError extends Error {
  public override readonly name = "FlowNotExecutableExecutionError";

  public constructor(public readonly issues: readonly ValidationIssue[]) {
    super("The flow graph is not executable.");
  }
}

export class FlowExecutionAbortedError extends Error {
  public override readonly name = "FlowExecutionAbortedError";

  public constructor(public readonly nodeResults: readonly NodeRunResult[]) {
    super("Flow execution was aborted.");
  }
}

export class NodeExecutionFailedError extends Error {
  public override readonly name = "NodeExecutionFailedError";

  public constructor(
    public readonly nodeId: string,
    public readonly nodeResults: readonly NodeRunResult[],
    public readonly originalError: unknown,
  ) {
    super(`Node "${nodeId}" failed during execution.`);
  }
}
