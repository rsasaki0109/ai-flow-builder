import type {
  FlowNode,
  TextInputConfig,
  TextOutputConfig,
  TextTemplateConfig,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  createExecutorRegistry,
  deterministicNodeExecutors,
  inputTextExecutor,
  MissingNodeInputError,
  MissingRuntimeInputError,
  outputTextExecutor,
  textTemplateExecutor,
  UnknownTemplatePlaceholderError,
  type FlowExecutionServices,
} from "../index.js";

const signal = new AbortController().signal;

describe("deterministic node executors", () => {
  it("exports the non-AI built-in executors for registry composition", () => {
    const registry = createExecutorRegistry(deterministicNodeExecutors);

    expect(registry.get("core.input.text", 1)).toBe(inputTextExecutor);
    expect(registry.get("core.text.template", 1)).toBe(textTemplateExecutor);
    expect(registry.get("core.output.text", 1)).toBe(outputTextExecutor);
  });
});

describe("inputTextExecutor", () => {
  it("returns the runtime input by config key", async () => {
    const result = await inputTextExecutor.execute({
      inputs: {
        topic: "Runtime text",
      },
      node: textInputNode({
        defaultValue: "Default text",
        key: "topic",
        label: "Topic",
        required: true,
      }),
      services: createServices(),
      signal,
    });

    expect(result).toEqual({
      outputs: {
        value: "Runtime text",
      },
    });
  });

  it("falls back to defaultValue when the runtime input is absent", async () => {
    const result = await inputTextExecutor.execute({
      inputs: {},
      node: textInputNode({
        defaultValue: "Default text",
        key: "topic",
        label: "Topic",
        required: true,
      }),
      services: createServices(),
      signal,
    });

    expect(result.outputs.value).toBe("Default text");
  });

  it("returns an empty string for optional missing input", async () => {
    const result = await inputTextExecutor.execute({
      inputs: {},
      node: textInputNode({
        key: "topic",
        label: "Topic",
        required: false,
      }),
      services: createServices(),
      signal,
    });

    expect(result.outputs.value).toBe("");
  });

  it("throws a typed error for missing required runtime input", async () => {
    await expect(
      inputTextExecutor.execute({
        inputs: {},
        node: textInputNode({
          key: "topic",
          label: "Topic",
          required: true,
        }),
        services: createServices(),
        signal,
      }),
    ).rejects.toThrow(MissingRuntimeInputError);
  });
});

describe("textTemplateExecutor", () => {
  it("replaces every supported input placeholder", async () => {
    const result = await textTemplateExecutor.execute({
      inputs: {
        input: "source text",
      },
      node: textTemplateNode("{{input}} / {{input}}"),
      services: createServices(),
      signal,
    });

    expect(result).toEqual({
      outputs: {
        text: "source text / source text",
      },
    });
  });

  it("throws for missing template input", async () => {
    await expect(
      textTemplateExecutor.execute({
        inputs: {},
        node: textTemplateNode("{{input}}"),
        services: createServices(),
        signal,
      }),
    ).rejects.toThrow(MissingNodeInputError);
  });

  it("throws for unknown template placeholders", async () => {
    await expect(
      textTemplateExecutor.execute({
        inputs: {
          input: "source text",
        },
        node: textTemplateNode("Hello {{name}}"),
        services: createServices(),
        signal,
      }),
    ).rejects.toThrow(UnknownTemplatePlaceholderError);
  });
});

describe("outputTextExecutor", () => {
  it("maps the value input to the configured output key", async () => {
    const result = await outputTextExecutor.execute({
      inputs: {
        value: "Final text",
      },
      node: textOutputNode({
        key: "summary",
        label: "Summary",
      }),
      services: createServices(),
      signal,
    });

    expect(result).toEqual({
      outputs: {
        summary: "Final text",
      },
    });
  });

  it("throws for missing output input", async () => {
    await expect(
      outputTextExecutor.execute({
        inputs: {},
        node: textOutputNode({
          key: "summary",
          label: "Summary",
        }),
        services: createServices(),
        signal,
      }),
    ).rejects.toThrow(MissingNodeInputError);
  });
});

function textInputNode(
  config: TextInputConfig,
): FlowNode & { readonly config: TextInputConfig } {
  return {
    config,
    id: "10000000-0000-4000-8000-000000000001",
    kind: "core.input.text",
    label: "Text Input",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function textTemplateNode(
  template: string,
): FlowNode & { readonly config: TextTemplateConfig } {
  return {
    config: {
      template,
    },
    id: "10000000-0000-4000-8000-000000000002",
    kind: "core.text.template",
    label: "Text Template",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function textOutputNode(
  config: TextOutputConfig,
): FlowNode & { readonly config: TextOutputConfig } {
  return {
    config,
    id: "10000000-0000-4000-8000-000000000003",
    kind: "core.output.text",
    label: "Text Output",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function createServices(): FlowExecutionServices {
  return {
    textGeneration: {
      async generateText() {
        return {
          text: "unused",
        };
      },
    },
  };
}
