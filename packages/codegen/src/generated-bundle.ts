import type { FlowNode } from "@ai-flow-builder/flow-core";

export const TYPESCRIPT_LANGUAGE_ID = "typescript";

export const codegenLanguageIds = [TYPESCRIPT_LANGUAGE_ID] as const;

export type CodegenLanguageId = (typeof codegenLanguageIds)[number];

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface CodegenWarning {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: FlowNode["id"];
  readonly path?: string;
}

export interface GeneratedBundle {
  readonly language: CodegenLanguageId;
  readonly entrypoint: string;
  readonly files: readonly GeneratedFile[];
  readonly warnings: readonly CodegenWarning[];
}
