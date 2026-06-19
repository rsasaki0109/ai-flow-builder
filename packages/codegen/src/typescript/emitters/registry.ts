import type { FlowNodeKind } from "@ai-flow-builder/flow-core";
import type { TypeScriptNodeEmitter } from "./types.js";
import { TypeScriptEmitterError } from "./types.js";

export class TypeScriptNodeEmitterRegistry {
  private readonly emittersByKey = new Map<string, TypeScriptNodeEmitter>();

  public constructor(emitters: readonly TypeScriptNodeEmitter[] = []) {
    for (const emitter of emitters) {
      this.register(emitter);
    }
  }

  public register(emitter: TypeScriptNodeEmitter): void {
    const key = createEmitterKey(emitter.kind, emitter.version);

    if (this.emittersByKey.has(key)) {
      throw new TypeScriptEmitterError(
        `Duplicate TypeScript emitter for ${emitter.kind}@${emitter.version}.`,
      );
    }

    this.emittersByKey.set(key, emitter);
  }

  public get(kind: FlowNodeKind, version: number): TypeScriptNodeEmitter {
    const emitter = this.emittersByKey.get(createEmitterKey(kind, version));

    if (emitter === undefined) {
      throw new TypeScriptEmitterError(
        `No TypeScript emitter registered for ${kind}@${version}.`,
      );
    }

    return emitter;
  }
}

export function createTypeScriptNodeEmitterRegistry(
  emitters: readonly TypeScriptNodeEmitter[] = [],
): TypeScriptNodeEmitterRegistry {
  return new TypeScriptNodeEmitterRegistry(emitters);
}

function createEmitterKey(kind: FlowNodeKind, version: number): string {
  return `${kind}@${version}`;
}
