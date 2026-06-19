import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  aiTextGenerateTypeScriptEmitter,
  builtInTypeScriptNodeEmitters,
  createTypeScriptNodeEmitterRegistry,
  inputTextTypeScriptEmitter,
  outputTextTypeScriptEmitter,
  textTemplateTypeScriptEmitter,
  TypeScriptEmitterError,
} from "../../index.js";

describe("TypeScript node emitters", () => {
  it("emits Text Input code with runtime input fallback and required check", () => {
    const emission = inputTextTypeScriptEmitter.emit({
      inputExpressions: {},
      node: createNode({
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
        kind: "core.input.text",
      }),
      nodeVariableName: "textInput",
    });

    expect(emission).toEqual({
      outputExpressions: {
        value: "textInputValue",
      },
      statements: [
        'const textInputRawValue = inputs["input"] ?? undefined;',
        "if (textInputRawValue === undefined || textInputRawValue.length === 0) {",
        '  throw new Error("Missing required runtime input \\"input\\".");',
        "}",
        'const textInputValue = textInputRawValue ?? "";',
      ],
    });
  });

  it("emits Text Input code with default value and quoted reserved input key", () => {
    const emission = inputTextTypeScriptEmitter.emit({
      inputExpressions: {},
      node: createNode({
        config: {
          defaultValue: "hello",
          key: "class",
          label: "Class",
          required: false,
        },
        kind: "core.input.text",
      }),
      nodeVariableName: "classInput",
    });

    expect(emission.statements).toEqual([
      'const classInputRawValue = inputs["class"] ?? "hello";',
      'const classInputValue = classInputRawValue ?? "";',
    ]);
    expect(emission.outputExpressions.value).toBe("classInputValue");
  });

  it("emits Text Template replacement without a template engine", () => {
    const emission = textTemplateTypeScriptEmitter.emit({
      inputExpressions: {
        input: "textInputValue",
      },
      node: createNode({
        config: {
          template: "Summarize:\\n{{input}}",
        },
        kind: "core.text.template",
      }),
      nodeVariableName: "textTemplate",
    });

    expect(emission).toEqual({
      outputExpressions: {
        text: "textTemplateText",
      },
      statements: [
        'const textTemplateText = "Summarize:\\\\n{{input}}".split("{{input}}").join(textInputValue);',
      ],
    });
  });

  it("emits AI Generate code through FlowDependencies only", () => {
    const emission = aiTextGenerateTypeScriptEmitter.emit({
      inputExpressions: {
        prompt: "textTemplateText",
      },
      node: createNode({
        config: {
          systemPrompt: "Be concise.",
        },
        kind: "ai.text.generate",
      }),
      nodeVariableName: "aiGenerate",
    });
    const emittedCode = emission.statements.join("\n");

    expect(emission).toEqual({
      outputExpressions: {
        text: "aiGenerateText",
      },
      statements: [
        "const aiGenerateText = await deps.generateText({",
        "  prompt: textTemplateText,",
        '  systemPrompt: "Be concise.",',
        "});",
      ],
    });
    expect(emittedCode).not.toContain("process.env");
    expect(emittedCode).not.toContain("OPENAI");
  });

  it("omits systemPrompt when AI Generate config does not include one", () => {
    const emission = aiTextGenerateTypeScriptEmitter.emit({
      inputExpressions: {
        prompt: "promptText",
      },
      node: createNode({
        config: {},
        kind: "ai.text.generate",
      }),
      nodeVariableName: "aiGenerate",
    });

    expect(emission.statements).toEqual([
      "const aiGenerateText = await deps.generateText({",
      "  prompt: promptText,",
      "});",
    ]);
  });

  it("emits Text Output code that writes to the output accumulator", () => {
    const emission = outputTextTypeScriptEmitter.emit({
      inputExpressions: {
        value: "aiGenerateText",
      },
      node: createNode({
        config: {
          key: "result",
          label: "Result",
        },
        kind: "core.output.text",
      }),
      nodeVariableName: "textOutput",
    });

    expect(emission).toEqual({
      outputExpressions: {},
      statements: ['outputs["result"] = aiGenerateText;'],
    });
  });

  it("throws a typed error when an emitter is missing an input expression", () => {
    expect(() => {
      textTemplateTypeScriptEmitter.emit({
        inputExpressions: {},
        node: createNode({
          config: {
            template: "{{input}}",
          },
          kind: "core.text.template",
        }),
        nodeVariableName: "textTemplate",
      });
    }).toThrow(TypeScriptEmitterError);
  });

  it("registers built-in emitters by node kind and version", () => {
    const registry = createTypeScriptNodeEmitterRegistry(
      builtInTypeScriptNodeEmitters,
    );

    expect(registry.get("core.input.text", 1)).toBe(inputTextTypeScriptEmitter);
    expect(registry.get("core.text.template", 1)).toBe(
      textTemplateTypeScriptEmitter,
    );
    expect(registry.get("ai.text.generate", 1)).toBe(
      aiTextGenerateTypeScriptEmitter,
    );
    expect(registry.get("core.output.text", 1)).toBe(
      outputTextTypeScriptEmitter,
    );
  });

  it("rejects duplicate emitter registration", () => {
    expect(() => {
      createTypeScriptNodeEmitterRegistry([
        inputTextTypeScriptEmitter,
        inputTextTypeScriptEmitter,
      ]);
    }).toThrow(TypeScriptEmitterError);
  });
});

function createNode(input: {
  readonly kind: FlowNodeKind;
  readonly config: unknown;
}): FlowNode {
  return {
    config: input.config,
    id: "11111111-1111-4111-8111-111111111111",
    kind: input.kind,
    label: "Node",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}
