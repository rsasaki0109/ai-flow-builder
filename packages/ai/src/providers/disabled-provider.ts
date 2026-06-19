import type {
  AiProvider,
  AiStructuredGenerationRequest,
  AiTextGenerationRequest,
} from "../ai-provider.js";
import { AiProviderError } from "../ai-result.js";

export class DisabledAiProvider implements AiProvider {
  public readonly name = "disabled";
  public readonly model = null;

  public async generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ): Promise<never> {
    void request;
    throw this.createDisabledError();
  }

  public async generateText(request: AiTextGenerationRequest): Promise<never> {
    void request;
    throw this.createDisabledError();
  }

  private createDisabledError(): AiProviderError {
    return new AiProviderError({
      code: "AI_DISABLED",
      message: "AI features are disabled.",
      provider: this.name,
      model: this.model,
    });
  }
}
