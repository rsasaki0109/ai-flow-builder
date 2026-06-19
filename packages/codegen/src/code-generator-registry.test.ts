import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowGraph,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it, vi } from "vitest";
import {
  createCodeGeneratorRegistry,
  DuplicateCodeGeneratorError,
  TYPESCRIPT_LANGUAGE_ID,
  UnsupportedCodegenLanguageError,
  type CodeGenerator,
} from "./index.js";

describe("CodeGeneratorRegistry", () => {
  it("registers, lists, finds, and gets generators by language", () => {
    const generator = createGenerator();
    const registry = createCodeGeneratorRegistry();

    registry.register(generator);

    expect(registry.list()).toEqual([generator]);
    expect(registry.find(TYPESCRIPT_LANGUAGE_ID)).toBe(generator);
    expect(registry.get(TYPESCRIPT_LANGUAGE_ID)).toBe(generator);
  });

  it("rejects duplicate generator language IDs", () => {
    const generator = createGenerator();

    expect(() => {
      createCodeGeneratorRegistry([generator, generator]);
    }).toThrow(DuplicateCodeGeneratorError);
  });

  it("throws a typed error for unsupported languages", () => {
    const registry = createCodeGeneratorRegistry();

    expect(() => {
      registry.get("python");
    }).toThrow(UnsupportedCodegenLanguageError);

    try {
      registry.get("python");
      throw new Error("Expected registry.get to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedCodegenLanguageError);
      expect((error as UnsupportedCodegenLanguageError).language).toBe(
        "python",
      );
    }
  });

  it("preserves the generator request and generated bundle contract", async () => {
    const graph = createGraph();
    const generate = vi.fn<CodeGenerator["generate"]>((request) => ({
      entrypoint: "flow.ts",
      files: [
        {
          content: `nodes:${request.graph.nodes.length}`,
          path: "flow.ts",
        },
      ],
      language: TYPESCRIPT_LANGUAGE_ID,
      warnings: [],
    }));
    const generator: CodeGenerator = {
      generate,
      language: TYPESCRIPT_LANGUAGE_ID,
    };
    const registry = createCodeGeneratorRegistry([generator]);

    const bundle = await registry.get(TYPESCRIPT_LANGUAGE_ID).generate({
      graph,
      options: {},
    });

    expect(generate).toHaveBeenCalledWith({
      graph,
      options: {},
    });
    expect(bundle).toEqual({
      entrypoint: "flow.ts",
      files: [
        {
          content: "nodes:0",
          path: "flow.ts",
        },
      ],
      language: TYPESCRIPT_LANGUAGE_ID,
      warnings: [],
    });
  });
});

function createGenerator(): CodeGenerator {
  return {
    async generate() {
      return {
        entrypoint: "flow.ts",
        files: [],
        language: TYPESCRIPT_LANGUAGE_ID,
        warnings: [],
      };
    },
    language: TYPESCRIPT_LANGUAGE_ID,
  };
}

function createGraph(): FlowGraph {
  return {
    edges: [],
    nodes: [],
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
