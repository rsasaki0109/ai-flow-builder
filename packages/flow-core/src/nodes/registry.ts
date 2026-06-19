import { builtInNodeSpecs, type BuiltInNodeSpec } from "./builtins.js";

export class UnknownNodeSpecError extends Error {
  public override readonly name = "UnknownNodeSpecError";

  public constructor(
    public readonly kind: string,
    public readonly version: number,
  ) {
    super(`Unknown node spec: ${kind}@${version}`);
  }
}

const createNodeSpecKey = (kind: string, version: number) =>
  `${kind}@${version}`;

const nodeSpecsByKey = new Map(
  builtInNodeSpecs.map((spec) => [
    createNodeSpecKey(spec.kind, spec.version),
    spec,
  ]),
);

export const listNodeSpecs = (): readonly BuiltInNodeSpec[] => builtInNodeSpecs;

export const findNodeSpec = (
  kind: string,
  version: number,
): BuiltInNodeSpec | null =>
  nodeSpecsByKey.get(createNodeSpecKey(kind, version)) ?? null;

export const getNodeSpec = (kind: string, version: number): BuiltInNodeSpec => {
  const spec = findNodeSpec(kind, version);

  if (spec === null) {
    throw new UnknownNodeSpecError(kind, version);
  }

  return spec;
};
