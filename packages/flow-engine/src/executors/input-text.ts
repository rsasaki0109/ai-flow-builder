import type { TextInputConfig } from "@ai-flow-builder/flow-core";
import { MissingRuntimeInputError } from "../execution-errors.js";
import type { NodeExecutor } from "../execution-types.js";

export const inputTextExecutor: NodeExecutor<TextInputConfig> = {
  kind: "core.input.text",
  version: 1,
  async execute(context) {
    const value =
      context.inputs[context.node.config.key] ??
      context.node.config.defaultValue;

    if (context.node.config.required && isMissingText(value)) {
      throw new MissingRuntimeInputError(
        context.node.id,
        context.node.config.key,
      );
    }

    return {
      outputs: {
        value: value ?? "",
      },
    };
  },
};

function isMissingText(value: string | undefined): boolean {
  return value === undefined || value.length === 0;
}
