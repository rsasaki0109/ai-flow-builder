import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";
import { describe, expect, it, vi } from "vitest";
import {
  createExecutorRegistry,
  DuplicateNodeExecutorError,
  UnknownNodeExecutorError,
  type FlowExecutionServices,
  type NodeExecutor,
} from "./index.js";

describe("ExecutorRegistry", () => {
  it("registers, lists, finds, and gets node executors by kind and version", () => {
    const inputExecutor = createExecutor("core.input.text");
    const outputExecutor = createExecutor("core.output.text");
    const registry = createExecutorRegistry([inputExecutor]);

    registry.register(outputExecutor);

    expect(registry.list()).toEqual([inputExecutor, outputExecutor]);
    expect(registry.find("core.input.text", 1)).toBe(inputExecutor);
    expect(registry.get("core.output.text", 1)).toBe(outputExecutor);
    expect(registry.find("core.text.template", 1)).toBeNull();
  });

  it("rejects duplicate executor kind and version pairs", () => {
    const executor = createExecutor("core.input.text");

    expect(() => {
      createExecutorRegistry([executor, executor]);
    }).toThrow(DuplicateNodeExecutorError);
  });

  it("throws a typed error for unknown executors", () => {
    const registry = createExecutorRegistry();

    expect(() => {
      registry.get("ai.text.generate", 1);
    }).toThrow(UnknownNodeExecutorError);
  });

  it("preserves the executor contract with context services and abort signal", async () => {
    const execute = vi.fn<NodeExecutor<{ readonly value: string }>["execute"]>(
      async (context) => ({
        outputs: {
          result: `${context.node.config.value}:${context.inputs.input}:${context.signal.aborted}`,
        },
      }),
    );
    const executor: NodeExecutor<{ readonly value: string }> = {
      kind: "core.text.template",
      version: 1,
      execute,
    };
    const registry = createExecutorRegistry([executor]);
    const abortController = new AbortController();
    const services = createExecutionServices();
    const result = await registry.get("core.text.template", 1).execute({
      inputs: {
        input: "input text",
      },
      node: {
        config: {
          value: "config",
        },
        id: "10000000-0000-4000-8000-000000000001",
        kind: "core.text.template",
        label: "Template",
        position: { x: 0, y: 0 },
        specVersion: 1,
      } satisfies FlowNode & { readonly config: { readonly value: string } },
      services,
      signal: abortController.signal,
    });

    expect(result).toEqual({
      outputs: {
        result: "config:input text:false",
      },
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        services,
        signal: abortController.signal,
      }),
    );
  });
});

function createExecutor(kind: FlowNodeKind): NodeExecutor {
  return {
    kind,
    version: 1,
    async execute() {
      return {
        outputs: {},
      };
    },
  };
}

function createExecutionServices(): FlowExecutionServices {
  return {
    textGeneration: {
      async generateText(request) {
        return {
          text: request.prompt,
        };
      },
    },
  };
}
