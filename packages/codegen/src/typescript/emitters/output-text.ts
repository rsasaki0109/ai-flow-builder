import { textOutputConfigSchema } from "@ai-flow-builder/flow-core";
import { toTypeScriptStringLiteral } from "../literals.js";
import { requireInputExpression } from "./helpers.js";
import type {
  TypeScriptNodeEmission,
  TypeScriptNodeEmitter,
  TypeScriptNodeEmitterInput,
} from "./types.js";

export const outputTextTypeScriptEmitter: TypeScriptNodeEmitter = {
  kind: "core.output.text",
  version: 1,
  emit(input: TypeScriptNodeEmitterInput): TypeScriptNodeEmission {
    const config = textOutputConfigSchema.parse(input.node.config);
    const valueExpression = requireInputExpression(input, "value");

    return {
      outputExpressions: {},
      statements: [
        `outputs[${toTypeScriptStringLiteral(config.key)}] = ${valueExpression};`,
      ],
    };
  },
};
