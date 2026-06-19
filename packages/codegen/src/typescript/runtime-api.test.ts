import { describe, expect, it } from "vitest";
import { emitFlowApiTypes, emitRunFlowSignature } from "./index.js";

describe("TypeScript runtime API emitters", () => {
  it("emits FlowInputs, FlowOutputs, and empty FlowDependencies types", () => {
    expect(
      emitFlowApiTypes({
        inputKeys: ["input", "class", "input"],
        outputKeys: ["result"],
        requiresTextGeneration: false,
      }),
    ).toEqual([
      "export interface FlowInputs {",
      '  readonly "class"?: string;',
      "  readonly input?: string;",
      "}",
      "",
      "export interface FlowOutputs {",
      "  readonly result: string;",
      "}",
      "",
      "export type FlowDependencies = Record<string, never>;",
    ]);
  });

  it("emits text generation dependency when an AI node is present", () => {
    expect(
      emitFlowApiTypes({
        inputKeys: [],
        outputKeys: ["result"],
        requiresTextGeneration: true,
      }),
    ).toEqual([
      "export interface FlowInputs {}",
      "",
      "export interface FlowOutputs {",
      "  readonly result: string;",
      "}",
      "",
      "export interface FlowDependencies {",
      "  readonly generateText: (request: {",
      "    readonly prompt: string;",
      "    readonly systemPrompt?: string;",
      "  }) => Promise<string>;",
      "}",
    ]);
  });

  it("emits the public runFlow signature", () => {
    expect(emitRunFlowSignature()).toBe(
      "export async function runFlow(inputs: FlowInputs, deps: FlowDependencies): Promise<FlowOutputs> {",
    );
  });
});
