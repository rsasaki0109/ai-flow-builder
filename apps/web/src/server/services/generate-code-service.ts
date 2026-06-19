import {
  CodeGeneratorRegistry,
  createCodeGeneratorRegistry,
  createTypeScriptGenerator,
  TypeScriptGeneratorError,
  UnsupportedCodegenLanguageError as CodegenUnsupportedLanguageError,
  type GeneratedBundle,
} from "@ai-flow-builder/codegen";
import type { FlowRepository } from "@ai-flow-builder/db";
import { validateExecutable } from "@ai-flow-builder/flow-core";
import {
  AppError,
  CodeGenerationFailedError,
  FlowNotExecutableError,
  FlowNotFoundError,
  UnsupportedCodegenLanguageError,
} from "../errors.js";

export interface GenerateCodeInput {
  readonly flowId: string;
  readonly language: string;
}

export interface GenerateCodeServiceOptions {
  readonly codeGeneratorRegistry?: CodeGeneratorRegistry;
}

export class GenerateCodeService {
  private readonly codeGeneratorRegistry: CodeGeneratorRegistry;

  public constructor(
    private readonly flowRepository: FlowRepository,
    options: GenerateCodeServiceOptions = {},
  ) {
    this.codeGeneratorRegistry =
      options.codeGeneratorRegistry ??
      createCodeGeneratorRegistry([createTypeScriptGenerator()]);
  }

  public async generate(input: GenerateCodeInput): Promise<GeneratedBundle> {
    const flow = await this.flowRepository.findById(input.flowId);
    if (flow === null) {
      throw new FlowNotFoundError(input.flowId);
    }

    const validation = validateExecutable(flow.graph);
    if (!validation.valid) {
      throw new FlowNotExecutableError(validation.issues);
    }

    try {
      const generator = this.codeGeneratorRegistry.get(input.language);
      return await generator.generate({ graph: flow.graph });
    } catch (error) {
      throw mapCodegenError(error);
    }
  }
}

function mapCodegenError(error: unknown): Error {
  if (error instanceof CodegenUnsupportedLanguageError) {
    return new UnsupportedCodegenLanguageError(error.language);
  }

  if (error instanceof TypeScriptGeneratorError && error.issues.length > 0) {
    return new FlowNotExecutableError(error.issues);
  }

  if (error instanceof AppError) {
    return error;
  }

  return new CodeGenerationFailedError(error);
}
