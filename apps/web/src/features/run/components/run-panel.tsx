"use client";

import {
  textInputConfigSchema,
  type FlowGraph,
  type TextInputConfig,
} from "@ai-flow-builder/flow-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store/index.js";
import {
  RunFlowClientError,
  runFlow,
  type RunResult,
} from "../api/run-flow-client.js";

interface RunPanelProps {
  readonly disabled: boolean;
}

interface RuntimeInputDescriptor {
  readonly nodeId: string;
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly defaultValue: string;
}

type RunStatus = "idle" | "running" | "succeeded" | "failed";

export function RunPanel({ disabled }: RunPanelProps) {
  const flowId = useEditorStore((store) => store.flowId);
  const graph = useEditorStore((store) => store.graph);
  const descriptors = useMemo(() => collectRuntimeInputs(graph), [graph]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInputValues((currentValues) =>
      createNextInputValues(currentValues, descriptors),
    );
  }, [descriptors]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const canRun = !disabled && status !== "running";

  const submitRun = async () => {
    if (!canRun) {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setStatus("running");
    setResult(null);
    setErrorMessage(null);

    try {
      const nextResult = await runFlow({
        flowId,
        inputs: inputValues,
        signal: abortController.signal,
      });
      setResult(nextResult);
      setStatus("succeeded");
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setErrorMessage(formatRunError(error));
      setStatus("failed");
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <section aria-labelledby="run-panel-heading" className="flex h-full gap-4">
      <div className="w-72 shrink-0 overflow-auto pr-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" id="run-panel-heading">
            Run
          </h2>
          <button
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--foreground)] px-4 text-sm font-medium text-white disabled:bg-[var(--border)] disabled:text-[var(--muted)]"
            disabled={!canRun}
            onClick={() => {
              void submitRun();
            }}
            type="button"
          >
            {status === "running" ? "Running" : "Run"}
          </button>
        </div>

        {disabled ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Resolve executable validation errors before running.
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          {descriptors.length === 0 ? (
            <p className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
              No runtime inputs.
            </p>
          ) : (
            descriptors.map((descriptor) => (
              <label
                className="block text-xs font-semibold"
                key={descriptor.nodeId}
              >
                <span>
                  {descriptor.label}
                  {descriptor.required ? "" : " (optional)"}
                </span>
                <textarea
                  className="mt-1 h-20 w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal"
                  maxLength={50_000}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setInputValues((currentValues) => ({
                      ...currentValues,
                      [descriptor.key]: nextValue,
                    }));
                  }}
                  value={inputValues[descriptor.key] ?? ""}
                />
              </label>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
        <RunStatusView
          errorMessage={errorMessage}
          result={result}
          status={status}
        />
      </div>
    </section>
  );
}

function RunStatusView({
  errorMessage,
  result,
  status,
}: {
  readonly errorMessage: string | null;
  readonly result: RunResult | null;
  readonly status: RunStatus;
}) {
  if (status === "running") {
    return <p className="text-sm text-[var(--muted)]">Running flow...</p>;
  }

  if (status === "failed") {
    return (
      <div role="alert">
        <h3 className="text-sm font-semibold text-red-700">Run failed</h3>
        <p className="mt-1 text-sm text-red-700">
          {errorMessage ?? "The flow run failed."}
        </p>
      </div>
    );
  }

  if (result === null) {
    return (
      <p className="text-sm text-[var(--muted)]">Run results appear here.</p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section>
        <h3 className="text-sm font-semibold">Outputs</h3>
        <dl className="mt-2 space-y-2">
          {Object.entries(result.outputs).map(([key, value]) => (
            <div
              className="rounded-md border border-[var(--border)] bg-white p-2"
              key={key}
            >
              <dt className="font-mono text-xs text-[var(--muted)]">{key}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Node results</h3>
        <ol className="mt-2 space-y-2">
          {result.nodeResults.map((nodeResult) => (
            <li
              className="rounded-md border border-[var(--border)] bg-white p-2"
              key={nodeResult.nodeId}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="break-all font-mono text-xs">
                  {nodeResult.nodeId}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {nodeResult.durationMs}ms
                </span>
              </div>
              <p className="mt-1 text-xs font-medium">{nodeResult.status}</p>
              {nodeResult.status === "succeeded" ? (
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {nodeResult.outputPreview}
                </p>
              ) : (
                <p className="mt-1 text-sm text-red-700">
                  {nodeResult.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function collectRuntimeInputs(graph: FlowGraph): RuntimeInputDescriptor[] {
  return graph.nodes
    .filter((node) => node.kind === "core.input.text")
    .flatMap((node) => {
      const parsed = textInputConfigSchema.safeParse(node.config);
      if (!parsed.success) {
        return [];
      }

      return [toRuntimeInputDescriptor(node.id, parsed.data)];
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function toRuntimeInputDescriptor(
  nodeId: string,
  config: TextInputConfig,
): RuntimeInputDescriptor {
  return {
    defaultValue: config.defaultValue ?? "",
    key: config.key,
    label: config.label,
    nodeId,
    required: config.required,
  };
}

function createNextInputValues(
  currentValues: Record<string, string>,
  descriptors: readonly RuntimeInputDescriptor[],
): Record<string, string> {
  const nextValues: Record<string, string> = {};

  for (const descriptor of descriptors) {
    nextValues[descriptor.key] =
      currentValues[descriptor.key] ?? descriptor.defaultValue;
  }

  if (areRecordsEqual(currentValues, nextValues)) {
    return currentValues;
  }

  return nextValues;
}

function areRecordsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => right[key] === value);
}

function formatRunError(error: unknown): string {
  if (error instanceof RunFlowClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The flow run failed.";
}
