import { z } from "zod";
import { MAX_NODE_LABEL_LENGTH } from "../schemas/flow-graph.js";
import type { NodeSpec } from "./node-spec.js";

export const MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH = 50_000;
export const MAX_TEMPLATE_LENGTH = 20_000;
export const MAX_SYSTEM_PROMPT_LENGTH = 10_000;

export const nodeConfigKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const textInputConfigSchema = z
  .object({
    key: nodeConfigKeySchema,
    label: z.string().min(1).max(MAX_NODE_LABEL_LENGTH),
    required: z.boolean(),
    defaultValue: z
      .string()
      .max(MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH)
      .optional(),
  })
  .strict();

export const textTemplateConfigSchema = z
  .object({
    template: z.string().min(1).max(MAX_TEMPLATE_LENGTH),
  })
  .strict();

export const aiTextGenerateConfigSchema = z
  .object({
    systemPrompt: z.string().max(MAX_SYSTEM_PROMPT_LENGTH).optional(),
  })
  .strict();

export const textOutputConfigSchema = z
  .object({
    key: nodeConfigKeySchema,
    label: z.string().min(1).max(MAX_NODE_LABEL_LENGTH),
  })
  .strict();

export type TextInputConfig = z.infer<typeof textInputConfigSchema>;
export type TextTemplateConfig = z.infer<typeof textTemplateConfigSchema>;
export type AiTextGenerateConfig = z.infer<typeof aiTextGenerateConfigSchema>;
export type TextOutputConfig = z.infer<typeof textOutputConfigSchema>;

export const textInputNodeSpec: NodeSpec<TextInputConfig> = {
  kind: "core.input.text",
  version: 1,
  displayName: "Text Input",
  description: "Receives a text value at run time.",
  category: "input",
  configSchema: textInputConfigSchema,
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
  defaultConfig: {
    key: "input",
    label: "Input",
    required: true,
  },
  defaultLabel: "Text Input",
};

export const textTemplateNodeSpec: NodeSpec<TextTemplateConfig> = {
  kind: "core.text.template",
  version: 1,
  displayName: "Text Template",
  description: "Embeds text input into a template string.",
  category: "transform",
  configSchema: textTemplateConfigSchema,
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
  defaultConfig: {
    template: "{{input}}",
  },
  defaultLabel: "Text Template",
};

export const aiTextGenerateNodeSpec: NodeSpec<AiTextGenerateConfig> = {
  kind: "ai.text.generate",
  version: 1,
  displayName: "AI Generate",
  description: "Generates text with the configured AI provider.",
  category: "ai",
  configSchema: aiTextGenerateConfigSchema,
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
  defaultConfig: {},
  defaultLabel: "AI Generate",
};

export const textOutputNodeSpec: NodeSpec<TextOutputConfig> = {
  kind: "core.output.text",
  version: 1,
  displayName: "Text Output",
  description: "Returns a text value as a final flow output.",
  category: "output",
  configSchema: textOutputConfigSchema,
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
  defaultConfig: {
    key: "result",
    label: "Result",
  },
  defaultLabel: "Text Output",
};

export const builtInNodeSpecs = [
  textInputNodeSpec,
  textTemplateNodeSpec,
  aiTextGenerateNodeSpec,
  textOutputNodeSpec,
] as const;

export type BuiltInNodeSpec = (typeof builtInNodeSpecs)[number];
