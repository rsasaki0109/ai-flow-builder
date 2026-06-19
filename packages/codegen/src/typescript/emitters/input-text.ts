import { textInputConfigSchema } from "@ai-flow-builder/flow-core";
import {
  toTypeScriptPropertyKey,
  toTypeScriptStringLiteral,
} from "../literals.js";
import {
  createErrorStatement,
  createPortVariableName,
  createSingleOutputEmission,
} from "./helpers.js";
import type {
  TypeScriptNodeEmission,
  TypeScriptNodeEmitter,
  TypeScriptNodeEmitterInput,
} from "./types.js";

export const inputTextTypeScriptEmitter: TypeScriptNodeEmitter = {
  kind: "core.input.text",
  version: 1,
  emit(input: TypeScriptNodeEmitterInput): TypeScriptNodeEmission {
    const config = textInputConfigSchema.parse(input.node.config);
    const rawVariableName = createPortVariableName(
      input.nodeVariableName,
      "rawValue",
    );
    const valueVariableName = createPortVariableName(
      input.nodeVariableName,
      "value",
    );
    const fallbackExpression =
      config.defaultValue === undefined
        ? "undefined"
        : toTypeScriptStringLiteral(config.defaultValue);
    const inputExpression = `inputs[${toTypeScriptStringLiteral(config.key)}]`;
    const statements = [
      `const ${rawVariableName} = ${inputExpression} ?? ${fallbackExpression};`,
      ...(config.required
        ? [
            `if (${rawVariableName} === undefined || ${rawVariableName}.length === 0) {`,
            ...createErrorStatement(
              `Missing required runtime input "${config.key}".`,
            ).map((statement) => `  ${statement}`),
            "}",
          ]
        : []),
      `const ${valueVariableName} = ${rawVariableName} ?? "";`,
    ];

    return createSingleOutputEmission({
      expression: valueVariableName,
      portId: "value",
      statements,
    });
  },
};

export function emitFlowInputProperty(key: string): string {
  return `  readonly ${toTypeScriptPropertyKey(key)}?: string;`;
}
