import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";

export type TypeScriptExpressionMap = Readonly<Record<string, string>>;

export interface TypeScriptNodeEmission {
  readonly statements: readonly string[];
  readonly outputExpressions: TypeScriptExpressionMap;
}

export interface TypeScriptNodeEmitterInput {
  readonly node: FlowNode;
  readonly nodeVariableName: string;
  readonly inputExpressions: TypeScriptExpressionMap;
}

export interface TypeScriptNodeEmitter {
  readonly kind: FlowNodeKind;
  readonly version: number;
  emit(input: TypeScriptNodeEmitterInput): TypeScriptNodeEmission;
}

export class TypeScriptEmitterError extends Error {
  public override readonly name = "TypeScriptEmitterError";

  public constructor(message: string) {
    super(message);
  }
}
