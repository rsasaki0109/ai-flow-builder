import type { z } from "zod";
import type { AiProvider } from "../ai-provider.js";

export interface AiProviderContractOptions<TStructured> {
  readonly createProvider: () => AiProvider;
  readonly expectedName: string;
  readonly expectedModel: string | null;
  readonly text: {
    readonly prompt: string;
    readonly expectedText: string;
    readonly systemPrompt?: string;
  };
  readonly structured: {
    readonly instructions: string;
    readonly input: string;
    readonly schemaName: string;
    readonly schema: z.ZodType<TStructured>;
    readonly expectedValue: TStructured;
  };
}

export async function assertAiProviderContract<TStructured>(
  options: AiProviderContractOptions<TStructured>,
): Promise<void> {
  const provider = options.createProvider();
  assertEqual(provider.name, options.expectedName, "provider.name");
  assertEqual(provider.model, options.expectedModel, "provider.model");

  const textSignal = new AbortController().signal;
  const textResult = await provider.generateText({
    prompt: options.text.prompt,
    signal: textSignal,
    ...(options.text.systemPrompt === undefined
      ? {}
      : { systemPrompt: options.text.systemPrompt }),
  });

  assertEqual(textResult.text, options.text.expectedText, "text result");
  assertDeepEqual(textResult.metadata, {
    provider: provider.name,
    model: provider.model,
  });

  const structuredSignal = new AbortController().signal;
  const structuredResult = await provider.generateStructured({
    instructions: options.structured.instructions,
    input: options.structured.input,
    schemaName: options.structured.schemaName,
    schema: options.structured.schema,
    signal: structuredSignal,
  });

  assertDeepEqual(
    options.structured.schema.parse(structuredResult.value),
    options.structured.expectedValue,
  );
  assertDeepEqual(structuredResult.metadata, {
    provider: provider.name,
    model: provider.model,
  });
}

function assertEqual<TValue>(
  actual: TValue,
  expected: TValue,
  label: string,
): void {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Contract value mismatch.");
  }
}
