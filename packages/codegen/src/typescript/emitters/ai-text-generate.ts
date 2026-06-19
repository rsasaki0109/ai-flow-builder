import { aiTextGenerateConfigSchema } from "@ai-flow-builder/flow-core";
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

export const aiTextGenerateTypeScriptEmitter: TypeScriptNodeEmitter = {
  kind: "ai.text.generate",
  version: 1,
  emit(input: TypeScriptNodeEmitterInput): TypeScriptNodeEmission {
    const config = aiTextGenerateConfigSchema.parse(input.node.config);
    const promptExpression = requireInputExpression(input, "prompt");
    const textVariableName = createPortVariableName(
      input.nodeVariableName,
      "text",
    );
    const requestLines =
      config.systemPrompt === undefined
        ? [`prompt: ${promptExpression},`]
        : [
            `prompt: ${promptExpression},`,
            `systemPrompt: ${toTypeScriptStringLiteral(config.systemPrompt)},`,
          ];

    return createSingleOutputEmission({
      expression: textVariableName,
      portId: "text",
      statements: [
        `const ${textVariableName} = await deps.generateText({`,
        ...requestLines.map((line) => `  ${line}`),
        "});",
      ],
    });
  },
};
