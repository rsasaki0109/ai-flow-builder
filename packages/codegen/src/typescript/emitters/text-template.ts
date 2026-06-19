import { textTemplateConfigSchema } from "@ai-flow-builder/flow-core";
import { toTypeScriptStringLiteral } from "../literals.js";
import {
  createPortVariableName,
  createSingleOutputEmission,
  requireInputExpression,
} from "./helpers.js";
import type {
  TypeScriptNodeEmission,
  TypeScriptNodeEmitter,
  TypeScriptNodeEmitterInput,
} from "./types.js";

export const textTemplateTypeScriptEmitter: TypeScriptNodeEmitter = {
  kind: "core.text.template",
  version: 1,
  emit(input: TypeScriptNodeEmitterInput): TypeScriptNodeEmission {
    const config = textTemplateConfigSchema.parse(input.node.config);
    const inputExpression = requireInputExpression(input, "input");
    const textVariableName = createPortVariableName(
      input.nodeVariableName,
      "text",
    );

    return createSingleOutputEmission({
      expression: textVariableName,
      portId: "text",
      statements: [
        `const ${textVariableName} = ${toTypeScriptStringLiteral(
          config.template,
        )}.split("{{input}}").join(${inputExpression});`,
      ],
    });
  },
};
