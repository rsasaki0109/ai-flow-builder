import type { FlowGraph } from "@ai-flow-builder/flow-core";
import type { CodegenLanguageId, GeneratedBundle } from "./generated-bundle.js";

export type CodeGeneratorOptions = Readonly<Record<string, unknown>>;

export interface CodeGenerationRequest<
  TOptions extends CodeGeneratorOptions = CodeGeneratorOptions,
> {
  readonly graph: FlowGraph;
  readonly options?: TOptions;
}

export interface CodeGenerator<
  TOptions extends CodeGeneratorOptions = CodeGeneratorOptions,
> {
  readonly language: CodegenLanguageId;

  generate(
    request: CodeGenerationRequest<TOptions>,
  ): GeneratedBundle | Promise<GeneratedBundle>;
}
