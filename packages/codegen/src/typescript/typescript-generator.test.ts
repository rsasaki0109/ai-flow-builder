import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeKind,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  createTypeScriptGenerator,
  TYPESCRIPT_LANGUAGE_ID,
  TypeScriptGeneratorError,
} from "../index.js";

const inputNodeId = "11111111-1111-4111-8111-111111111111";
const templateNodeId = "22222222-2222-4222-8222-222222222222";
const aiNodeId = "33333333-3333-4333-8333-333333333333";
const outputNodeId = "44444444-4444-4444-8444-444444444444";
const unusedInputNodeId = "55555555-5555-4555-8555-555555555555";

describe("TypeScriptGenerator", () => {
  it("generates a formatted flow.ts bundle for a deterministic text flow", async () => {
    const bundle = await createTypeScriptGenerator().generate({
      graph: createTextFlowGraph(),
    });

    expect(bundle.language).toBe(TYPESCRIPT_LANGUAGE_ID);
    expect(bundle.entrypoint).toBe("flow.ts");
    expect(bundle.warnings).toEqual([]);
    expect(bundle.files).toHaveLength(1);
    expect(bundle.files[0]).toEqual({
      path: "flow.ts",
      content: `export interface FlowInputs {
  readonly input?: string;
}

export interface FlowOutputs {
  readonly result: string;
}

export type FlowDependencies = Record<string, never>;

export async function runFlow(
  inputs: FlowInputs,
  deps: FlowDependencies,
): Promise<FlowOutputs> {
  const outputs: Record<string, string> = {};

  // Flow node: Input (core.input.text@1)
  // Flow node ID: 11111111-1111-4111-8111-111111111111
  const inputRawValue = inputs["input"] ?? undefined;
  if (inputRawValue === undefined || inputRawValue.length === 0) {
    throw new Error('Missing required runtime input "input".');
  }
  const inputValue = inputRawValue ?? "";

  // Flow node: Template (core.text.template@1)
  // Flow node ID: 22222222-2222-4222-8222-222222222222
  const templateText = "Hi {{input}}".split("{{input}}").join(inputValue);

  // Flow node: Output (core.output.text@1)
  // Flow node ID: 44444444-4444-4444-8444-444444444444
  outputs["result"] = templateText;

  return outputs as unknown as FlowOutputs;
}
`,
    });
  });

  it("generates dependency-injected AI code without embedding environment secrets", async () => {
    const bundle = await createTypeScriptGenerator().generate({
      graph: createAiFlowGraph(),
    });
    const content = bundle.files[0]?.content ?? "";

    expect(content).toContain("export interface FlowDependencies");
    expect(content).toContain("readonly generateText: (request: {");
    expect(content).toContain("const aiText = await deps.generateText({");
    expect(content).toContain('systemPrompt: "Be concise.",');
    expect(content).not.toContain("process.env");
    expect(content).not.toContain("OPENAI");
    expect(content).toMatchInlineSnapshot(`
      "export interface FlowInputs {
        readonly input?: string;
      }

      export interface FlowOutputs {
        readonly answer: string;
      }

      export interface FlowDependencies {
        readonly generateText: (request: {
          readonly prompt: string;
          readonly systemPrompt?: string;
        }) => Promise<string>;
      }

      export async function runFlow(
        inputs: FlowInputs,
        deps: FlowDependencies,
      ): Promise<FlowOutputs> {
        const outputs: Record<string, string> = {};

        // Flow node: Input (core.input.text@1)
        // Flow node ID: 11111111-1111-4111-8111-111111111111
        const inputRawValue = inputs["input"] ?? undefined;
        if (inputRawValue === undefined || inputRawValue.length === 0) {
          throw new Error('Missing required runtime input "input".');
        }
        const inputValue = inputRawValue ?? "";

        // Flow node: Template (core.text.template@1)
        // Flow node ID: 22222222-2222-4222-8222-222222222222
        const templateText = "Summarize {{input}}"
          .split("{{input}}")
          .join(inputValue);

        // Flow node: AI (ai.text.generate@1)
        // Flow node ID: 33333333-3333-4333-8333-333333333333
        const aiText = await deps.generateText({
          prompt: templateText,
          systemPrompt: "Be concise.",
        });

        // Flow node: Output (core.output.text@1)
        // Flow node ID: 44444444-4444-4444-8444-444444444444
        outputs["answer"] = aiText;

        return outputs as unknown as FlowOutputs;
      }
      "
    `);
  });

  it("returns validation warnings and omits unreachable nodes from generated code", async () => {
    const bundle = await createTypeScriptGenerator().generate({
      graph: createTextFlowGraph({
        extraNodes: [
          createNode({
            config: {
              key: "unused",
              label: "Unused",
              required: false,
            },
            id: unusedInputNodeId,
            kind: "core.input.text",
            label: "Unused Input",
          }),
        ],
      }),
    });
    const content = bundle.files[0]?.content ?? "";

    expect(bundle.warnings.map((warning) => warning.code)).toEqual([
      "NODE_NOT_REACHING_OUTPUT",
      "UNUSED_INPUT_NODE",
    ]);
    expect(content).not.toContain(unusedInputNodeId);
    expect(content).not.toContain("unused");
  });

  it("rejects non-executable graphs with a typed error", async () => {
    await expect(
      createTypeScriptGenerator().generate({
        graph: createGraph({
          edges: [],
          nodes: [
            createNode({
              config: {
                key: "input",
                label: "Input",
                required: true,
              },
              id: inputNodeId,
              kind: "core.input.text",
              label: "Input",
            }),
          ],
        }),
      }),
    ).rejects.toThrow(TypeScriptGeneratorError);
  });
});

function createTextFlowGraph(
  input: {
    readonly extraNodes?: readonly FlowNode[];
  } = {},
): FlowGraph {
  return createGraph({
    edges: [
      createEdge({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        sourceNodeId: inputNodeId,
        sourcePortId: "value",
        targetNodeId: templateNodeId,
        targetPortId: "input",
      }),
      createEdge({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        sourceNodeId: templateNodeId,
        sourcePortId: "text",
        targetNodeId: outputNodeId,
        targetPortId: "value",
      }),
    ],
    nodes: [
      createNode({
        config: {
          key: "result",
          label: "Result",
        },
        id: outputNodeId,
        kind: "core.output.text",
        label: "Output",
      }),
      createNode({
        config: {
          template: "Hi {{input}}",
        },
        id: templateNodeId,
        kind: "core.text.template",
        label: "Template",
      }),
      createNode({
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
        id: inputNodeId,
        kind: "core.input.text",
        label: "Input",
      }),
      ...(input.extraNodes ?? []),
    ],
  });
}

function createAiFlowGraph(): FlowGraph {
  return createGraph({
    edges: [
      createEdge({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        sourceNodeId: inputNodeId,
        sourcePortId: "value",
        targetNodeId: templateNodeId,
        targetPortId: "input",
      }),
      createEdge({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        sourceNodeId: templateNodeId,
        sourcePortId: "text",
        targetNodeId: aiNodeId,
        targetPortId: "prompt",
      }),
      createEdge({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
        sourceNodeId: aiNodeId,
        sourcePortId: "text",
        targetNodeId: outputNodeId,
        targetPortId: "value",
      }),
    ],
    nodes: [
      createNode({
        config: {
          key: "answer",
          label: "Answer",
        },
        id: outputNodeId,
        kind: "core.output.text",
        label: "Output",
      }),
      createNode({
        config: {
          systemPrompt: "Be concise.",
        },
        id: aiNodeId,
        kind: "ai.text.generate",
        label: "AI",
      }),
      createNode({
        config: {
          template: "Summarize {{input}}",
        },
        id: templateNodeId,
        kind: "core.text.template",
        label: "Template",
      }),
      createNode({
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
        id: inputNodeId,
        kind: "core.input.text",
        label: "Input",
      }),
    ],
  });
}

function createGraph(input: {
  readonly edges: readonly FlowEdge[];
  readonly nodes: readonly FlowNode[];
}): FlowGraph {
  return {
    edges: [...input.edges],
    nodes: [...input.nodes],
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

function createNode(input: {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly label: string;
  readonly config: unknown;
}): FlowNode {
  return {
    config: input.config,
    id: input.id,
    kind: input.kind,
    label: input.label,
    position: {
      x: 0,
      y: 0,
    },
    specVersion: 1,
  };
}

function createEdge(input: {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
}): FlowEdge {
  return {
    id: input.id,
    source: {
      nodeId: input.sourceNodeId,
      portId: input.sourcePortId,
    },
    target: {
      nodeId: input.targetNodeId,
      portId: input.targetPortId,
    },
  };
}
