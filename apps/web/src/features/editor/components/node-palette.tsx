"use client";

import {
  listNodeSpecs,
  type BuiltInNodeSpec,
} from "@ai-flow-builder/flow-core";
import { useMemo } from "react";
import { useEditorStore } from "../store/index.js";

const CATEGORY_LABELS: Record<BuiltInNodeSpec["category"], string> = {
  ai: "AI",
  input: "Input",
  output: "Output",
  transform: "Transform",
};

const CATEGORY_ORDER: readonly BuiltInNodeSpec["category"][] = [
  "input",
  "transform",
  "ai",
  "output",
];

export function NodePalette() {
  const addNode = useEditorStore((store) => store.addNode);
  const nodeCount = useEditorStore((store) => store.graph.nodes.length);
  const specsByCategory = useMemo(() => groupSpecsByCategory(), []);

  return (
    <div>
      <h2 className="text-sm font-semibold">Node Palette</h2>
      <div className="mt-4 space-y-5">
        {CATEGORY_ORDER.map((category) => (
          <section key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="mt-2 space-y-2">
              {(specsByCategory.get(category) ?? []).map((spec) => (
                <button
                  aria-label={`Add ${spec.displayName}`}
                  className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  key={spec.kind}
                  onClick={() => {
                    addNode(spec.kind, getNextNodePosition(nodeCount));
                  }}
                  type="button"
                >
                  <span className="block font-medium text-[var(--foreground)]">
                    {spec.displayName}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    {spec.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupSpecsByCategory(): Map<
  BuiltInNodeSpec["category"],
  BuiltInNodeSpec[]
> {
  const specsByCategory = new Map<
    BuiltInNodeSpec["category"],
    BuiltInNodeSpec[]
  >();

  for (const spec of listNodeSpecs()) {
    const specs = specsByCategory.get(spec.category) ?? [];
    specs.push(spec);
    specsByCategory.set(spec.category, specs);
  }

  return specsByCategory;
}

function getNextNodePosition(nodeCount: number): { x: number; y: number } {
  return {
    x: 80 + (nodeCount % 4) * 40,
    y: 80 + Math.floor(nodeCount / 4) * 40,
  };
}
