import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeKind,
} from "@ai-flow-builder/flow-core";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { createTypeScriptGenerator } from "../index.js";

const temporaryDirectories: string[] = [];

const inputNodeId = "11111111-1111-4111-8111-111111111111";
const templateNodeId = "22222222-2222-4222-8222-222222222222";
const aiNodeId = "33333333-3333-4333-8333-333333333333";
const outputNodeId = "44444444-4444-4444-8444-444444444444";

interface GeneratedFlowModule {
  readonly runFlow: (
    inputs: Record<string, string>,
    deps: {
      readonly generateText?: (request: {
        readonly prompt: string;
        readonly systemPrompt?: string;
      }) => Promise<string>;
    },
  ) => Promise<Record<string, string>>;
}

describe("generated TypeScript code", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("passes TypeScript compilation and executes a deterministic fixture", async () => {
    const content = await generateFlowSource(createTextFlowGraph());
    const directory = await writeGeneratedFlow(content);

    assertTypeScriptCompiles(join(directory, "flow.ts"));
    const module = await importGeneratedFlowModule(directory, content);
    const outputs = await module.runFlow(
      {
        input: "world",
      },
      {},
    );

    expect(outputs).toEqual({
      result: "Hello world",
    });
  });

  it("passes TypeScript compilation and executes an AI fixture with fake dependency", async () => {
    const content = await generateFlowSource(createAiFlowGraph());
    const directory = await writeGeneratedFlow(content);
    const textGenerationRequests: {
      readonly prompt: string;
      readonly systemPrompt?: string;
    }[] = [];

    assertTypeScriptCompiles(join(directory, "flow.ts"));
    const module = await importGeneratedFlowModule(directory, content);
    const outputs = await module.runFlow(
      {
        input: "long article",
      },
      {
        async generateText(request) {
          textGenerationRequests.push(request);
          return `FAKE_AI: ${request.prompt}`;
        },
      },
    );

    expect(textGenerationRequests).toEqual([
      {
        prompt: "Summarize long article",
        systemPrompt: "Be concise.",
      },
    ]);
    expect(outputs).toEqual({
      answer: "FAKE_AI: Summarize long article",
    });
  });
});

async function generateFlowSource(graph: FlowGraph): Promise<string> {
  const bundle = await createTypeScriptGenerator().generate({ graph });
  const flowFile = bundle.files.find((file) => file.path === "flow.ts");

  if (flowFile === undefined) {
    throw new Error("Expected generated flow.ts file.");
  }

  return flowFile.content;
}

async function writeGeneratedFlow(content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "ai-flow-builder-codegen-"));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, "flow.ts"), content, "utf8");
  return directory;
}

function assertTypeScriptCompiles(flowPath: string): void {
  const program = ts.createProgram([flowPath], {
    exactOptionalPropertyTypes: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2024,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  expect(formatDiagnostics(diagnostics)).toEqual([]);
}

async function importGeneratedFlowModule(
  directory: string,
  content: string,
): Promise<GeneratedFlowModule> {
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2024,
    },
  });
  const modulePath = join(directory, "flow.mjs");
  await writeFile(modulePath, transpiled.outputText, "utf8");

  const importedModule: unknown = await import(pathToFileURL(modulePath).href);
  if (!isGeneratedFlowModule(importedModule)) {
    throw new Error("Generated module did not export runFlow.");
  }

  return importedModule;
}

function isGeneratedFlowModule(value: unknown): value is GeneratedFlowModule {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    typeof (value as { readonly runFlow?: unknown }).runFlow === "function"
  );
}

function formatDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
): readonly string[] {
  return diagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );

    if (diagnostic.file === undefined || diagnostic.start === undefined) {
      return message;
    }

    const position = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );

    return `${diagnostic.file.fileName}:${position.line + 1}:${
      position.character + 1
    } ${message}`;
  });
}

function createTextFlowGraph(): FlowGraph {
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
          key: "input",
          label: "Input",
          required: true,
        },
        id: inputNodeId,
        kind: "core.input.text",
        label: "Input",
      }),
      createNode({
        config: {
          template: "Hello {{input}}",
        },
        id: templateNodeId,
        kind: "core.text.template",
        label: "Template",
      }),
      createNode({
        config: {
          key: "result",
          label: "Result",
        },
        id: outputNodeId,
        kind: "core.output.text",
        label: "Output",
      }),
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
          key: "input",
          label: "Input",
          required: true,
        },
        id: inputNodeId,
        kind: "core.input.text",
        label: "Input",
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
          systemPrompt: "Be concise.",
        },
        id: aiNodeId,
        kind: "ai.text.generate",
        label: "AI",
      }),
      createNode({
        config: {
          key: "answer",
          label: "Answer",
        },
        id: outputNodeId,
        kind: "core.output.text",
        label: "Output",
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
