import type { z } from "zod";
import type { AiStructuredResult, AiTextResult } from "./ai-result.js";

export interface AiProvider {
  readonly name: string;
  readonly model: string | null;

  generateStructured<TValue>(
    request: AiStructuredGenerationRequest<TValue>,
  ): Promise<AiStructuredResult<TValue>>;

  generateText(request: AiTextGenerationRequest): Promise<AiTextResult>;
}

export interface AiStructuredGenerationRequest<TValue> {
  readonly instructions: string;
  readonly input: string;
  readonly schemaName: string;
  readonly schema: z.ZodType<TValue>;
  readonly signal: AbortSignal;
}

export interface AiTextGenerationRequest {
  readonly systemPrompt?: string;
  readonly prompt: string;
  readonly signal: AbortSignal;
}
