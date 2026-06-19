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
import {
  FlowExecutionAbortedError,
  MAX_NODE_OUTPUT_TEXT_LENGTH,
  NodeExecutionFailedError,
  NodeOutputTooLargeError,
  type ExecuteFlowInput,
  type RunResult,
  type TextGenerationService,
} from "@ai-flow-builder/flow-engine";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AiDisabledError,
  AiProviderError,
  FlowNotExecutableError,
  TimeoutError,
} from "../errors.js";
import { RunFlowService } from "./run-flow-service.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const inputId = "10000000-0000-4000-8000-000000000101";
const templateId = "10000000-0000-4000-8000-000000000102";
const aiId = "10000000-0000-4000-8000-000000000103";
const outputId = "10000000-0000-4000-8000-000000000104";

let repository: InMemoryFlowRepository;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
});

describe("RunFlowService", () => {
  it("runs a non-AI executable flow without using the text generation service", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });
    const textGenerationService = createCountingTextGenerationService();
    const service = createService({ textGenerationService });

    const result = await service.run({
      flowId: FLOW_ID,
      inputs: {
        input: "source",
      },
    });

    expect(result.outputs).toEqual({
      result: "Processed: source",
    });
    expect(textGenerationService.calls).toBe(0);
  });

  it("maps executable validation failures", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Invalid Flow",
      description: null,
      graph: emptyGraph(),
    });
    const service = createService();

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {},
      }),
    ).rejects.toBeInstanceOf(FlowNotExecutableError);
  });

  it("maps missing runtime input failures", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });
    const service = createService();

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {},
      }),
    ).rejects.toMatchObject({
      code: "MISSING_FLOW_INPUT",
      details: { key: "input" },
    });
  });

  it("maps disabled AI execution failures", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "AI Flow",
      description: null,
      graph: aiGraph(),
    });
    const service = createService({
      textGenerationService: {
        async generateText() {
          throw new AiDisabledError();
        },
      },
    });

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {
          input: "source",
        },
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("maps provider execution failures", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "AI Flow",
      description: null,
      graph: aiGraph(),
    });
    const service = createService({
      textGenerationService: {
        async generateText() {
          throw new AiProviderError("Provider failed.");
        },
      },
    });

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {
          input: "source",
        },
      }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      message: "Provider failed.",
    });
  });

  it("maps timeout aborts", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });
    const service = createService({
      executeFlowFn: async (input) =>
        new Promise((_, reject) => {
          input.signal.addEventListener(
            "abort",
            () => reject(new FlowExecutionAbortedError([])),
            { once: true },
          );
        }),
      timeoutMs: 1,
    });

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {
          input: "source",
        },
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("maps oversized node outputs without exposing output content", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });
    const service = createService({
      executeFlowFn: async () => {
        throw new NodeExecutionFailedError(
          templateId,
          [],
          new NodeOutputTooLargeError(
            templateId,
            "text",
            MAX_NODE_OUTPUT_TEXT_LENGTH + 1,
            MAX_NODE_OUTPUT_TEXT_LENGTH,
          ),
        );
      },
    });

    await expect(
      service.run({
        flowId: FLOW_ID,
        inputs: {
          input: "source",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      details: {
        maxLength: MAX_NODE_OUTPUT_TEXT_LENGTH,
        nodeId: templateId,
        outputKey: "text",
      },
      message: "A node output exceeded the size limit.",
    });
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

    return {
      status: "updated",
      flow: createResource({
        id: input.id,
        name: input.name,
        description: input.description,
        graph: input.graph,
        revision: current.revision + 1,
      }),
    };
  }

  public async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

function createService(
  options: {
    readonly executeFlowFn?: (input: ExecuteFlowInput) => Promise<RunResult>;
    readonly textGenerationService?: TextGenerationService;
    readonly timeoutMs?: number;
  } = {},
): RunFlowService {
  return new RunFlowService(repository, {
    ...(options.executeFlowFn === undefined
      ? {}
      : { executeFlowFn: options.executeFlowFn }),
    textGenerationService:
      options.textGenerationService ?? createCountingTextGenerationService(),
    timeoutMs: options.timeoutMs ?? 1_000,
  });
}

function createCountingTextGenerationService(): TextGenerationService & {
  readonly calls: number;
} {
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    async generateText(request) {
      calls += 1;
      return {
        text: `AI: ${request.prompt}`,
      };
    },
  };
}

function templateGraph(): FlowGraph {
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

function aiGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000301",
        inputId,
        "value",
        aiId,
        "prompt",
      ),
      edge(
        "10000000-0000-4000-8000-000000000302",
        aiId,
        "text",
        outputId,
        "value",
      ),
    ],
    nodes: [inputNode(inputId), aiNode(aiId), outputNode(outputId)],
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

function aiNode(id: string): FlowNode {
  return {
    config: {},
    id,
    kind: "ai.text.generate",
    label: "AI Generate",
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
    source: {
      nodeId: sourceNodeId,
      portId: sourcePortId,
    },
    target: {
      nodeId: targetNodeId,
      portId: targetPortId,
    },
  };
}

function createResource(input: {
  id: string;
  name: string;
  description: string | null;
  graph: FlowGraph;
  revision: number;
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
