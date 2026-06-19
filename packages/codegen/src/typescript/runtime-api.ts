import { toTypeScriptPropertyKey } from "./literals.js";

export interface FlowApiTypeEmissionInput {
  readonly inputKeys: readonly string[];
  readonly outputKeys: readonly string[];
  readonly requiresTextGeneration: boolean;
}

export function emitFlowApiTypes(
  input: FlowApiTypeEmissionInput,
): readonly string[] {
  return [
    ...emitTextRecordInterface("FlowInputs", uniqueSorted(input.inputKeys), {
      optional: true,
    }),
    "",
    ...emitTextRecordInterface("FlowOutputs", uniqueSorted(input.outputKeys), {
      optional: false,
    }),
    "",
    ...emitFlowDependenciesType(input.requiresTextGeneration),
  ];
}

export function emitRunFlowSignature(): string {
  return "export async function runFlow(inputs: FlowInputs, deps: FlowDependencies): Promise<FlowOutputs> {";
}

function emitTextRecordInterface(
  name: string,
  keys: readonly string[],
  options: { readonly optional: boolean },
): readonly string[] {
  if (keys.length === 0) {
    return [`export interface ${name} {}`];
  }

  return [
    `export interface ${name} {`,
    ...keys.map(
      (key) =>
        `  readonly ${toTypeScriptPropertyKey(key)}${
          options.optional ? "?" : ""
        }: string;`,
    ),
    "}",
  ];
}

function emitFlowDependenciesType(
  requiresTextGeneration: boolean,
): readonly string[] {
  if (!requiresTextGeneration) {
    return ["export type FlowDependencies = Record<string, never>;"];
  }

  return [
    "export interface FlowDependencies {",
    "  readonly generateText: (request: {",
    "    readonly prompt: string;",
    "    readonly systemPrompt?: string;",
    "  }) => Promise<string>;",
    "}",
  ];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
