import type { TextGenerationService } from "@ai-flow-builder/flow-engine";
import type { AppConfig } from "../config.js";
import { AiDisabledError, AiProviderError } from "../errors.js";

export function createTextGenerationService(
  config: AppConfig,
): TextGenerationService {
  switch (config.aiProvider) {
    case "disabled":
      return disabledTextGenerationService;
    case "fake":
      return fakeTextGenerationService;
    case "openai":
      return unavailableOpenAiTextGenerationService;
  }
}

const disabledTextGenerationService: TextGenerationService = {
  async generateText() {
    throw new AiDisabledError();
  },
};

const fakeTextGenerationService: TextGenerationService = {
  async generateText(request) {
    if (request.signal.aborted) {
      throw new AiProviderError("The AI request was aborted.");
    }

    return {
      text: `FAKE_AI: ${request.prompt}`,
    };
  },
};

const unavailableOpenAiTextGenerationService: TextGenerationService = {
  async generateText() {
    throw new AiProviderError("The OpenAI provider is not configured yet.");
  },
};
