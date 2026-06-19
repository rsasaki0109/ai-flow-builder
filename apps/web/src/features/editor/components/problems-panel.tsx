"use client";

import type { ValidationIssue } from "@ai-flow-builder/flow-core";
import { useMemo } from "react";
import { useEditorStore } from "../store/index.js";

interface ProblemsPanelProps {
  readonly isValidating: boolean;
  readonly issues: readonly ValidationIssue[];
}

export function ProblemsPanel({ isValidating, issues }: ProblemsPanelProps) {
  const graph = useEditorStore((store) => store.graph);
  const selectEdge = useEditorStore((store) => store.selectEdge);
  const selectNode = useEditorStore((store) => store.selectNode);
  const nodeLabelById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.label])),
    [graph.nodes],
  );
  const edgeIds = useMemo(
    () => new Set(graph.edges.map((edge) => edge.id)),
    [graph.edges],
  );
  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return (
    <section aria-labelledby="problems-heading" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" id="problems-heading">
            Problems
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {errorCount} errors · {warningCount} warnings
            {isValidating ? " · Updating" : ""}
          </p>
        </div>
        <ProblemSummaryBadge
          errorCount={errorCount}
          warningCount={warningCount}
        />
      </div>

      {issues.length === 0 ? (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--muted)]">
          No problems found.
        </div>
      ) : (
        <ol className="mt-3 max-h-32 space-y-2 overflow-auto pr-1">
          {issues.map((issue, index) => {
            const target = getIssueTarget(issue, nodeLabelById, edgeIds);

            return (
              <li key={`${issue.code}:${issue.path ?? ""}:${index}`}>
                <button
                  className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-left text-xs transition hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-default disabled:hover:border-[var(--border)]"
                  disabled={target === null}
                  onClick={() => {
                    if (target?.type === "node") {
                      selectNode(target.id);
                    }

                    if (target?.type === "edge") {
                      selectEdge(target.id);
                    }
                  }}
                  type="button"
                >
                  <span
                    className={
                      issue.severity === "error"
                        ? "font-semibold text-red-700"
                        : "font-semibold text-amber-700"
                    }
                  >
                    {issue.severity === "error" ? "Error" : "Warning"}
                  </span>
                  <span className="ml-2 font-mono text-[var(--muted)]">
                    {issue.code}
                  </span>
                  <span className="mt-1 block leading-5 text-[var(--foreground)]">
                    {issue.message}
                  </span>
                  {target === null ? null : (
                    <span className="mt-1 block text-[var(--muted)]">
                      {target.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ProblemSummaryBadge({
  errorCount,
  warningCount,
}: {
  readonly errorCount: number;
  readonly warningCount: number;
}) {
  if (errorCount > 0) {
    return (
      <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
        {errorCount} error{errorCount === 1 ? "" : "s"}
      </span>
    );
  }

  if (warningCount > 0) {
    return (
      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
        {warningCount} warning{warningCount === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
      Valid
    </span>
  );
}

function getIssueTarget(
  issue: ValidationIssue,
  nodeLabelById: ReadonlyMap<string, string>,
  edgeIds: ReadonlySet<string>,
): {
  readonly id: string;
  readonly label: string;
  readonly type: "node" | "edge";
} | null {
  if (issue.nodeId !== undefined && nodeLabelById.has(issue.nodeId)) {
    return {
      id: issue.nodeId,
      label: `Node: ${nodeLabelById.get(issue.nodeId)}`,
      type: "node",
    };
  }

  if (issue.edgeId !== undefined && edgeIds.has(issue.edgeId)) {
    return {
      id: issue.edgeId,
      label: `Edge: ${issue.edgeId}`,
      type: "edge",
    };
  }

  return null;
}
