import {
  isSafeIdentifierName,
  toTypeScriptStringLiteral,
} from "../literals.js";
import { toSafeIdentifier } from "../naming.js";
import type {
  TypeScriptNodeEmitterInput,
  TypeScriptExpressionMap,
} from "./types.js";
import { TypeScriptEmitterError } from "./types.js";

export function requireInputExpression(
  input: TypeScriptNodeEmitterInput,
  portId: string,
): string {
  const expression = input.inputExpressions[portId];

  if (expression === undefined) {
    throw new TypeScriptEmitterError(
      `Missing input expression "${portId}" for node "${input.node.id}".`,
    );
  }

  return expression;
}

export function createPortVariableName(
  nodeVariableName: string,
  portId: string,
): string {
  const safePortId = isSafeIdentifierName(portId)
    ? portId
    : toSafeIdentifier(portId, "port");

  return `${nodeVariableName}${capitalizeIdentifier(safePortId)}`;
}

export function createSingleOutputEmission(input: {
  readonly statements: readonly string[];
  readonly portId: string;
  readonly expression: string;
}): {
  readonly statements: readonly string[];
  readonly outputExpressions: TypeScriptExpressionMap;
} {
  return {
    outputExpressions: {
      [input.portId]: input.expression,
    },
    statements: input.statements,
  };
}

export function createErrorStatement(message: string): readonly string[] {
  return [`throw new Error(${toTypeScriptStringLiteral(message)});`];
}

function capitalizeIdentifier(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
