"use client";

import type { GeneratedCodeBundle } from "@ai-flow-builder/flow-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store/index.js";
import {
  GenerateCodeClientError,
  generateCode,
} from "../api/generate-code-client.js";
import { downloadGeneratedFile } from "./download-generated-file.js";

interface CodePanelProps {
  readonly disabled: boolean;
}

type CodeStatus = "idle" | "generating" | "succeeded" | "failed";
type CopyStatus = "idle" | "copied" | "failed";

export function CodePanel({ disabled }: CodePanelProps) {
  const flowId = useEditorStore((store) => store.flowId);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [bundle, setBundle] = useState<GeneratedCodeBundle | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);
  const primaryFile = useMemo(() => selectPrimaryFile(bundle), [bundle]);
  const canGenerate = !disabled && status !== "generating";
  const canUseFile = primaryFile !== null && status !== "generating";

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const submitGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setStatus("generating");
    setErrorMessage(null);
    setCopyStatus("idle");

    try {
      const nextBundle = await generateCode({
        flowId,
        language: "typescript",
        signal: abortController.signal,
      });
      setBundle(nextBundle);
      setStatus("succeeded");
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setErrorMessage(formatCodegenError(error));
      setStatus("failed");
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const copyCode = async () => {
    if (primaryFile === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(primaryFile.content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const downloadCode = () => {
    if (primaryFile === null) {
      return;
    }

    downloadGeneratedFile(primaryFile);
  };

  return (
    <section aria-labelledby="code-panel-heading" className="flex h-full gap-4">
      <div className="w-72 shrink-0 overflow-auto pr-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" id="code-panel-heading">
              Code
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Deterministic TypeScript output.
            </p>
          </div>
          <button
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--foreground)] px-4 text-sm font-medium text-white disabled:bg-[var(--border)] disabled:text-[var(--muted)]"
            disabled={!canGenerate}
            onClick={() => {
              void submitGenerate();
            }}
            type="button"
          >
            {status === "generating" ? "Generating" : "Generate"}
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold">
          Language
          <select
            className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-white px-2 text-sm font-normal"
            defaultValue="typescript"
            disabled
          >
            <option value="typescript">TypeScript</option>
          </select>
        </label>

        {disabled ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Resolve executable validation errors before generating code.
          </p>
        ) : null}

        {errorMessage === null ? null : (
          <div
            className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {bundle === null ? null : (
          <div className="mt-3 space-y-3 text-xs">
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-2">
              <p className="font-semibold">Bundle</p>
              <p className="mt-1 font-mono text-[var(--muted)]">
                {bundle.entrypoint}
              </p>
              <p className="mt-1 text-[var(--muted)]">
                {bundle.files.length} file{bundle.files.length === 1 ? "" : "s"}
              </p>
            </div>

            {bundle.warnings.length === 0 ? null : (
              <section>
                <h3 className="font-semibold">Warnings</h3>
                <ol className="mt-2 space-y-2">
                  {bundle.warnings.map((warning, index) => (
                    <li
                      className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900"
                      key={`${warning.code}:${warning.path ?? ""}:${index}`}
                    >
                      <span className="font-mono">{warning.code}</span>
                      <span className="mt-1 block">{warning.message}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-md border border-[var(--border)] bg-[var(--background)]">
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-3">
          <span className="min-w-0 truncate font-mono text-xs text-[var(--muted)]">
            {primaryFile?.path ?? "flow.ts"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {copyStatus === "copied" ? (
              <span className="text-xs font-medium text-emerald-700">
                Copied
              </span>
            ) : null}
            {copyStatus === "failed" ? (
              <span className="text-xs font-medium text-red-700">
                Copy failed
              </span>
            ) : null}
            <button
              className="h-8 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canUseFile}
              onClick={() => {
                void copyCode();
              }}
              type="button"
            >
              Copy
            </button>
            <button
              className="h-8 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canUseFile}
              onClick={downloadCode}
              type="button"
            >
              Download
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <CodeView primaryFile={primaryFile} status={status} />
        </div>
      </div>
    </section>
  );
}

function CodeView({
  primaryFile,
  status,
}: {
  readonly primaryFile: GeneratedCodeBundle["files"][number] | null;
  readonly status: CodeStatus;
}) {
  if (status === "generating") {
    return <p className="text-sm text-[var(--muted)]">Generating code...</p>;
  }

  if (primaryFile === null) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Generated TypeScript appears here.
      </p>
    );
  }

  return (
    <pre
      aria-label="Generated code"
      className="min-h-full whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--foreground)]"
    >
      <code>{primaryFile.content}</code>
    </pre>
  );
}

function selectPrimaryFile(
  bundle: GeneratedCodeBundle | null,
): GeneratedCodeBundle["files"][number] | null {
  if (bundle === null) {
    return null;
  }

  return (
    bundle.files.find((file) => file.path === bundle.entrypoint) ??
    bundle.files[0] ??
    null
  );
}

function formatCodegenError(error: unknown): string {
  if (error instanceof GenerateCodeClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Code generation failed.";
}
