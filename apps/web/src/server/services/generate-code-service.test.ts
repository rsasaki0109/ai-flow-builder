import {
  CodeGeneratorRegistry,
  TYPESCRIPT_LANGUAGE_ID,
  type CodeGenerator,
  type GeneratedBundle,
} from "@ai-flow-builder/codegen";
import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "@ai-flow-builder/db";
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CodeGenerationFailedError,
  FlowNotExecutableError,
  FlowNotFoundError,
  UnsupportedCodegenLanguageError,
} from "../errors.js";
import { GenerateCodeService } from "./generate-code-service.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const MISSING_FLOW_ID = "10000000-0000-4000-8000-000000000999";
const inputId = "10000000-0000-4000-8000-000000000101";
const templateId = "10000000-0000-4000-8000-000000000102";
const outputId = "10000000-0000-4000-8000-000000000103";

let repository: InMemoryFlowRepository;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
});

describe("GenerateCodeService", () => {
  it("loads an executable flow and returns a generated bundle", async () => {
    const bundle = createBundle("generated");
    const generate = vi.fn<CodeGenerator["generate"]>(() => bundle);
    const service = createService({ generate });
    await repository.create({
      id: FLOW_ID,
      name: "Code Flow",
      description: null,
      graph: executableGraph(),
    });

    await expect(
      service.generate({
        flowId: FLOW_ID,
        language: TYPESCRIPT_LANGUAGE_ID,
      }),
    ).resolves.toEqual(bundle);
    expect(generate).toHaveBeenCalledWith({ graph: executableGraph() });
  });

  it("throws FlowNotFoundError when the flow is missing", async () => {
    const generate = vi.fn<CodeGenerator["generate"]>(() =>
      createBundle("unused"),
    );
    const service = createService({ generate });

    await expect(
      service.generate({
        flowId: MISSING_FLOW_ID,
        language: TYPESCRIPT_LANGUAGE_ID,
      }),
    ).rejects.toBeInstanceOf(FlowNotFoundError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("throws FlowNotExecutableError before invoking a generator", async () => {
    const generate = vi.fn<CodeGenerator["generate"]>(() =>
      createBundle("unused"),
    );
    const service = createService({ generate });
    await repository.create({
      id: FLOW_ID,
      name: "Invalid Flow",
      description: null,
      graph: emptyGraph(),
    });

    await expect(
      service.generate({
        flowId: FLOW_ID,
        language: TYPESCRIPT_LANGUAGE_ID,
      }),
    ).rejects.toBeInstanceOf(FlowNotExecutableError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("maps unsupported languages to application errors", async () => {
    const service = new GenerateCodeService(repository, {
      codeGeneratorRegistry: new CodeGeneratorRegistry(),
    });
    await repository.create({
      id: FLOW_ID,
      name: "Code Flow",
      description: null,
      graph: executableGraph(),
    });

    await expect(
      service.generate({
        flowId: FLOW_ID,
        language: "python",
      }),
    ).rejects.toBeInstanceOf(UnsupportedCodegenLanguageError);
  });

  it("maps unexpected generator failures to CodeGenerationFailedError", async () => {
    const generate = vi.fn<CodeGenerator["generate"]>(() => {
      throw new Error("Unexpected formatter failure.");
    });
    const service = createService({ generate });
    await repository.create({
      id: FLOW_ID,
      name: "Code Flow",
      description: null,
      graph: executableGraph(),
    });

    await expect(
      service.generate({
        flowId: FLOW_ID,
        language: TYPESCRIPT_LANGUAGE_ID,
      }),
    ).rejects.toBeInstanceOf(CodeGenerationFailedError);
  });
});

class InMemoryFlowRepository implements FlowRepository {
  private readonly records = new Map<string, FlowResource>();

  public async list(): Promise<FlowResource[]> {
    return [...this.records.values()];
  }

  public async findById(id: string): Promise<FlowResource | null> {
    return this.records.get(id) ?? null;
  }

  public async create(input: CreateFlowRecord): Promise<FlowResource> {
    const flow = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: 1,
    });
    this.records.set(flow.id, flow);

    return flow;
  }

  public async update(input: UpdateFlowRecord): Promise<UpdateFlowResult> {
    const current = this.records.get(input.id);
    if (current === undefined) {
      return { status: "not_found" };
    }

    const flow = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: current.revision + 1,
    });
    this.records.set(flow.id, flow);

    return { status: "updated", flow };
  }

  public async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

function createService(input: {
  readonly generate: CodeGenerator["generate"];
}): GenerateCodeService {
  return new GenerateCodeService(repository, {
    codeGeneratorRegistry: new CodeGeneratorRegistry([
      {
        generate: input.generate,
        language: TYPESCRIPT_LANGUAGE_ID,
      },
    ]),
  });
}

function createBundle(content: string): GeneratedBundle {
  return {
    entrypoint: "flow.ts",
    files: [
      {
        content,
        path: "flow.ts",
      },
    ],
    language: TYPESCRIPT_LANGUAGE_ID,
    warnings: [],
  };
}

function createResource(input: {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly graph: FlowGraph;
  readonly revision: number;
}): FlowResource {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    graph: input.graph,
    revision: input.revision,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function executableGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000201",
        inputId,
        "value",
        templateId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-000000000202",
        templateId,
        "text",
        outputId,
        "value",
      ),
    ],
    nodes: [
      inputNode(inputId),
      templateNode(templateId, "Processed: {{input}}"),
      outputNode(outputId),
    ],
  });
}

function emptyGraph(): FlowGraph {
  return graph({ edges: [], nodes: [] });
}

function graph(input: {
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}): FlowGraph {
  return {
    edges: [...input.edges],
    nodes: [...input.nodes],
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function inputNode(id: string): FlowNode {
  return {
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
    id,
    kind: "core.input.text",
    label: "Text Input",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function templateNode(id: string, template: string): FlowNode {
  return {
    config: {
      template,
    },
    id,
    kind: "core.text.template",
    label: "Text Template",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function outputNode(id: string): FlowNode {
  return {
    config: {
      key: "result",
      label: "Result",
    },
    id,
    kind: "core.output.text",
    label: "Text Output",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function edge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge {
  return {
    id,
    source: { nodeId: sourceNodeId, portId: sourcePortId },
    target: { nodeId: targetNodeId, portId: targetPortId },
  };
}
