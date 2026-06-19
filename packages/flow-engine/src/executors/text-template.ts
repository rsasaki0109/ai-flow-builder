import type { TextTemplateConfig } from "@ai-flow-builder/flow-core";
import {
  MissingNodeInputError,
  UnknownTemplatePlaceholderError,
} from "../execution-errors.js";
import type { NodeExecutor } from "../execution-types.js";

const templatePlaceholderPattern = /{{([^{}]*)}}/g;

export const textTemplateExecutor: NodeExecutor<TextTemplateConfig> = {
  kind: "core.text.template",
  version: 1,
  async execute(context) {
    const input = context.inputs.input;

    if (input === undefined) {
      throw new MissingNodeInputError(context.node.id, "input");
    }

    validateTemplatePlaceholders(context.node.id, context.node.config.template);

    return {
      outputs: {
        text: context.node.config.template.split("{{input}}").join(input),
      },
    };
  },
};

function validateTemplatePlaceholders(nodeId: string, template: string): void {
  for (const match of template.matchAll(templatePlaceholderPattern)) {
    const placeholder = match[1] ?? "";

    if (placeholder !== "input") {
      throw new UnknownTemplatePlaceholderError(nodeId, placeholder);
    }
  }
}
