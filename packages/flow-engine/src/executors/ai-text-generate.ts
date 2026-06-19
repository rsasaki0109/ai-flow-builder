import type { AiTextGenerateConfig } from "@ai-flow-builder/flow-core";
import {
  MissingNodeInputError,
  NodeOutputTooLargeError,
} from "../execution-errors.js";
import { MAX_NODE_OUTPUT_TEXT_LENGTH } from "../execution-limits.js";
import type {
  NodeExecutor,
  TextGenerationRequest,
} from "../execution-types.js";

export const aiTextGenerateExecutor: NodeExecutor<AiTextGenerateConfig> = {
  kind: "ai.text.generate",
  version: 1,
  async execute(context) {
    const prompt = context.inputs.prompt;

    if (prompt === undefined) {
      throw new MissingNodeInputError(context.node.id, "prompt");
    }

    const request = createTextGenerationRequest({
      prompt,
      signal: context.signal,
      systemPrompt: context.node.config.systemPrompt,
    });
    const result = await context.services.textGeneration.generateText(request);

    if (result.text.length > MAX_NODE_OUTPUT_TEXT_LENGTH) {
      throw new NodeOutputTooLargeError(
        context.node.id,
        "text",
        result.text.length,
        MAX_NODE_OUTPUT_TEXT_LENGTH,
      );
    }

    return {
      outputs: {
        text: result.text,
      },
    };
  },
};

function createTextGenerationRequest(input: {
  readonly prompt: string;
  readonly signal: AbortSignal;
  readonly systemPrompt: string | undefined;
}): TextGenerationRequest {
  if (input.systemPrompt === undefined) {
    return {
      prompt: input.prompt,
      signal: input.signal,
    };
  }

  return {
    prompt: input.prompt,
    signal: input.signal,
    systemPrompt: input.systemPrompt,
  };
}
