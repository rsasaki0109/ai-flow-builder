import { describe, expect, it } from "vitest";
import { MAX_NODE_LABEL_LENGTH } from "../schemas/flow-graph.js";
import {
  aiTextGenerateConfigSchema,
  builtInNodeSpecs,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_TEMPLATE_LENGTH,
  MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH,
  textInputConfigSchema,
  textOutputConfigSchema,
  textTemplateConfigSchema,
} from "./builtins.js";

describe("built-in node specs", () => {
  it("parses every default config", () => {
    for (const spec of builtInNodeSpecs) {
      expect(spec.configSchema.safeParse(spec.defaultConfig).success).toBe(
        true,
      );
    }
  });

  it("defines only MVP text ports", () => {
    expect(
      builtInNodeSpecs.map((spec) => ({
        kind: spec.kind,
        inputs: spec.inputs,
        outputs: spec.outputs,
      })),
    ).toEqual([
      {
        kind: "core.input.text",
        inputs: [],
        outputs: [
          {
            id: "value",
            label: "Value",
            direction: "output",
            dataType: "text",
            required: true,
          },
        ],
      },
      {
        kind: "core.text.template",
        inputs: [
          {
            id: "input",
            label: "Input",
            direction: "input",
            dataType: "text",
            required: true,
          },
        ],
        outputs: [
          {
            id: "text",
            label: "Text",
            direction: "output",
            dataType: "text",
            required: true,
          },
        ],
      },
      {
        kind: "ai.text.generate",
        inputs: [
          {
            id: "prompt",
            label: "Prompt",
            direction: "input",
            dataType: "text",
            required: true,
          },
        ],
        outputs: [
          {
            id: "text",
            label: "Text",
            direction: "output",
            dataType: "text",
            required: true,
          },
        ],
      },
      {
        kind: "core.output.text",
        inputs: [
          {
            id: "value",
            label: "Value",
            direction: "input",
            dataType: "text",
            required: true,
          },
        ],
        outputs: [],
      },
    ]);
  });

  it("enforces key regex for input and output configs", () => {
    for (const invalidKey of ["1input", "input-key", "input key", ""]) {
      expect(
        textInputConfigSchema.safeParse({
          key: invalidKey,
          label: "Input",
          required: true,
        }).success,
      ).toBe(false);
      expect(
        textOutputConfigSchema.safeParse({
          key: invalidKey,
          label: "Result",
        }).success,
      ).toBe(false);
    }

    expect(
      textInputConfigSchema.safeParse({
        key: "_input1",
        label: "Input",
        required: true,
      }).success,
    ).toBe(true);
    expect(
      textOutputConfigSchema.safeParse({
        key: "result_1",
        label: "Result",
      }).success,
    ).toBe(true);
  });

  it("enforces config limits and rejects unknown fields", () => {
    expect(
      textInputConfigSchema.safeParse({
        key: "input",
        label: "x".repeat(MAX_NODE_LABEL_LENGTH + 1),
        required: true,
      }).success,
    ).toBe(false);
    expect(
      textInputConfigSchema.safeParse({
        key: "input",
        label: "Input",
        required: true,
        defaultValue: "x".repeat(MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      textTemplateConfigSchema.safeParse({
        template: "",
      }).success,
    ).toBe(false);
    expect(
      textTemplateConfigSchema.safeParse({
        template: "x".repeat(MAX_TEMPLATE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      aiTextGenerateConfigSchema.safeParse({
        systemPrompt: "x".repeat(MAX_SYSTEM_PROMPT_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      textOutputConfigSchema.safeParse({
        key: "result",
        label: "Result",
        extra: true,
      }).success,
    ).toBe(false);
  });
});
