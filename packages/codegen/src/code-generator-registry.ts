import type { CodeGenerator } from "./code-generator.js";
import type { CodegenLanguageId } from "./generated-bundle.js";

export class DuplicateCodeGeneratorError extends Error {
  public override readonly name = "DuplicateCodeGeneratorError";

  public constructor(public readonly language: CodegenLanguageId) {
    super(`Duplicate code generator: ${language}`);
  }
}

export class UnsupportedCodegenLanguageError extends Error {
  public override readonly name = "UnsupportedCodegenLanguageError";

  public constructor(public readonly language: string) {
    super(`Unsupported code generation language: ${language}`);
  }
}

export class CodeGeneratorRegistry {
  private readonly generatorsByLanguage = new Map<
    CodegenLanguageId,
    CodeGenerator
  >();

  public constructor(generators: readonly CodeGenerator[] = []) {
    for (const generator of generators) {
      this.register(generator);
    }
  }

  public register(generator: CodeGenerator): void {
    if (this.generatorsByLanguage.has(generator.language)) {
      throw new DuplicateCodeGeneratorError(generator.language);
    }

    this.generatorsByLanguage.set(generator.language, generator);
  }

  public find(language: string): CodeGenerator | null {
    return isCodegenLanguageId(language)
      ? (this.generatorsByLanguage.get(language) ?? null)
      : null;
  }

  public get(language: string): CodeGenerator {
    const generator = this.find(language);

    if (generator === null) {
      throw new UnsupportedCodegenLanguageError(language);
    }

    return generator;
  }

  public list(): readonly CodeGenerator[] {
    return [...this.generatorsByLanguage.values()];
  }
}

export function createCodeGeneratorRegistry(
  generators: readonly CodeGenerator[] = [],
): CodeGeneratorRegistry {
  return new CodeGeneratorRegistry(generators);
}

function isCodegenLanguageId(language: string): language is CodegenLanguageId {
  return language === "typescript";
}
