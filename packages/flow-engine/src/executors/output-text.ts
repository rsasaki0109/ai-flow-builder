import type { TextOutputConfig } from "@ai-flow-builder/flow-core";
import { MissingNodeInputError } from "../execution-errors.js";
import type { NodeExecutor } from "../execution-types.js";

export const outputTextExecutor: NodeExecutor<TextOutputConfig> = {
  kind: "core.output.text",
  version: 1,
  async execute(context) {
    const value = context.inputs.value;

    if (value === undefined) {
      throw new MissingNodeInputError(context.node.id, "value");
    }

    return {
      outputs: {
        [context.node.config.key]: value,
      },
    };
  },
};
