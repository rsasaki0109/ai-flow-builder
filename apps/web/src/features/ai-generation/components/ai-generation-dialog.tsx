"use client";

import { getNodeSpec } from "@ai-flow-builder/flow-core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  GenerateFlowClientError,
  generateFlowFromText,
  type GeneratedFlowDraft,
  type GenerateFlowResult,
} from "../api/generate-flow-client.js";

interface AiGenerationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onApplyDraft?: (draft: GeneratedFlowDraft) => void;
}

type DialogView = "prompt" | "generating" | "preview" | "confirm" | "error";

const MAX_PROMPT_LENGTH = 4_000;

export function AiGenerationDialog({
  onApplyDraft,
  onOpenChange,
  open,
}: AiGenerationDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<DialogView>("prompt");
  const [result, setResult] = useState<GenerateFlowResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      return;
    }

    const firstFocusable = findFocusableElements(dialogRef.current)[0];
    firstFocusable?.focus();
  }, [open]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const promptLength = prompt.length;
  const promptError = validatePrompt(prompt);
  const canGenerate = view !== "generating" && promptError === null;

  if (!open) {
    return null;
  }

  const closeDialog = () => {
    onOpenChange(false);
  };

  const submitPrompt = async () => {
    if (!canGenerate) {
      setErrorMessage(promptError ?? "Prompt is invalid.");
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setView("generating");
    setResult(null);
    setErrorMessage(null);

    try {
      const nextResult = await generateFlowFromText({
        prompt,
        signal: abortController.signal,
      });
      setResult(nextResult);
      setView("preview");
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setErrorMessage(formatGenerationError(error));
      setView("error");
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <section
        aria-labelledby="ai-generation-title"
        aria-modal="true"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
        onKeyDown={(event) => {
          handleDialogKeyDown(event, dialogRef.current, closeDialog);
        }}
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold" id="ai-generation-title">
              Generate with AI
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Draft a validated Flow IR from a short prompt.
            </p>
          </div>
          <button
            aria-label="Close AI generation"
            className="h-9 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)]"
            onClick={closeDialog}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 overflow-auto px-5 py-4">
          {view === "prompt" ? (
            <PromptStep
              canGenerate={canGenerate}
              errorMessage={errorMessage}
              onPromptChange={(nextPrompt) => {
                setPrompt(nextPrompt);
                setErrorMessage(null);
              }}
              onSubmit={() => {
                void submitPrompt();
              }}
              prompt={prompt}
              promptError={promptError}
              promptLength={promptLength}
            />
          ) : null}

          {view === "generating" ? <GeneratingStep /> : null}

          {view === "preview" && result !== null ? (
            <PreviewStep
              onBack={() => {
                setView("prompt");
              }}
              onReviewApply={() => {
                setView("confirm");
              }}
              result={result}
            />
          ) : null}

          {view === "confirm" && result !== null ? (
            <ConfirmStep
              applyEnabled={onApplyDraft !== undefined}
              draft={result.draft}
              onBack={() => {
                setView("preview");
              }}
              onConfirm={() => {
                if (onApplyDraft === undefined) {
                  return;
                }

                onApplyDraft(result.draft);
                closeDialog();
              }}
            />
          ) : null}

          {view === "error" ? (
            <ErrorStep
              errorMessage={errorMessage}
              onEditPrompt={() => {
                setView("prompt");
              }}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PromptStep({
  canGenerate,
  errorMessage,
  onPromptChange,
  onSubmit,
  prompt,
  promptError,
  promptLength,
}: {
  readonly canGenerate: boolean;
  readonly errorMessage: string | null;
  readonly onPromptChange: (prompt: string) => void;
  readonly onSubmit: () => void;
  readonly prompt: string;
  readonly promptError: string | null;
  readonly promptLength: number;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="ai-flow-prompt">
        Prompt
      </label>
      <textarea
        className="mt-2 h-40 w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        id="ai-flow-prompt"
        maxLength={MAX_PROMPT_LENGTH}
        onChange={(event) => {
          onPromptChange(event.currentTarget.value);
        }}
        placeholder="入力文章をAIで要約し、結果を出力するフロー"
        value={prompt}
      />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--muted)]">
          {promptLength}/{MAX_PROMPT_LENGTH}
        </p>
        {promptError === null ? null : (
          <p className="text-xs font-medium text-red-700">{promptError}</p>
        )}
      </div>

      {errorMessage === null ? null : (
        <p
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-medium text-white disabled:bg-[var(--border)] disabled:text-[var(--muted)]"
          disabled={!canGenerate}
          type="submit"
        >
          Generate Flow
        </button>
      </div>
    </form>
  );
}

function GeneratingStep() {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-6">
      <h3 className="text-sm font-semibold">Generating flow...</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Waiting for a structured Flow Plan response.
      </p>
    </div>
  );
}

function PreviewStep({
  onBack,
  onReviewApply,
  result,
}: {
  readonly onBack: () => void;
  readonly onReviewApply: () => void;
  readonly result: GenerateFlowResult;
}) {
  const nodeSummaries = useMemo(
    () =>
      result.draft.graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        kind: getNodeSpec(node.kind, node.specVersion).displayName,
      })),
    [result.draft.graph.nodes],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Generated flow preview</h3>
          <p className="mt-1 text-lg font-semibold">{result.draft.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {result.draft.description}
          </p>
        </div>
        <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {result.meta.provider}
          {result.meta.model === null ? "" : ` · ${result.meta.model}`}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Nodes
          </h4>
          <ol className="mt-3 space-y-2">
            {nodeSummaries.map((node, index) => (
              <li
                className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                key={node.id}
              >
                <span className="font-mono text-xs text-[var(--muted)]">
                  {index + 1}
                </span>
                <span className="ml-2 font-semibold">{node.label}</span>
                <span className="ml-2 text-xs text-[var(--muted)]">
                  {node.kind}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {result.draft.graph.edges.length} edges
          </p>
        </section>

        <section className="space-y-3">
          <PreviewList title="Assumptions" values={result.assumptions} />
          <PreviewList
            title="Unsupported"
            values={result.unsupportedRequirements}
          />
          <WarningsList warnings={result.warnings} />
        </section>
      </div>

      <div className="mt-5 flex justify-between gap-3">
        <button
          className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
          onClick={onBack}
          type="button"
        >
          Edit Prompt
        </button>
        <button
          className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-medium text-white"
          onClick={onReviewApply}
          type="button"
        >
          Review Apply
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({
  applyEnabled,
  draft,
  onBack,
  onConfirm,
}: {
  readonly applyEnabled: boolean;
  readonly draft: GeneratedFlowDraft;
  readonly onBack: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">Apply generated flow?</h3>
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        This will replace the current graph with “{draft.name}”.
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-[var(--border)] bg-white p-3">
          <dt className="text-xs text-[var(--muted)]">Nodes</dt>
          <dd className="mt-1 text-lg font-semibold">
            {draft.graph.nodes.length}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white p-3">
          <dt className="text-xs text-[var(--muted)]">Edges</dt>
          <dd className="mt-1 text-lg font-semibold">
            {draft.graph.edges.length}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white p-3">
          <dt className="text-xs text-[var(--muted)]">Schema</dt>
          <dd className="mt-1 text-lg font-semibold">
            v{draft.graph.schemaVersion}
          </dd>
        </div>
      </dl>

      {!applyEnabled ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Applying the draft will be enabled when editor integration is added.
        </p>
      ) : null}

      <div className="mt-5 flex justify-between gap-3">
        <button
          className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
          onClick={onBack}
          type="button"
        >
          Back to Preview
        </button>
        <button
          className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-medium text-white disabled:bg-[var(--border)] disabled:text-[var(--muted)]"
          disabled={!applyEnabled}
          onClick={onConfirm}
          type="button"
        >
          Apply Generated Flow
        </button>
      </div>
    </div>
  );
}

function ErrorStep({
  errorMessage,
  onEditPrompt,
}: {
  readonly errorMessage: string | null;
  readonly onEditPrompt: () => void;
}) {
  return (
    <div role="alert">
      <h3 className="text-sm font-semibold text-red-700">
        AI generation failed
      </h3>
      <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {errorMessage ?? "The AI flow generation request failed."}
      </p>
      <div className="mt-5 flex justify-end">
        <button
          className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium"
          onClick={onEditPrompt}
          type="button"
        >
          Edit Prompt
        </button>
      </div>
    </div>
  );
}

function PreviewList({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {title}
      </h4>
      {values.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">None</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {values.map((value, index) => (
            <li key={`${title}:${index}`}>{value}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WarningsList({
  warnings,
}: {
  readonly warnings: GenerateFlowResult["warnings"];
}) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        Warnings
      </h4>
      {warnings.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">None</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {warnings.map((warning, index) => (
            <li key={`${warning.code}:${warning.path ?? ""}:${index}`}>
              <span className="font-mono text-xs text-amber-700">
                {warning.code}
              </span>
              <span className="mt-1 block">{warning.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function validatePrompt(prompt: string): string | null {
  if (prompt.trim().length === 0) {
    return "Prompt is required.";
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`;
  }

  return null;
}

function formatGenerationError(error: unknown): string {
  if (error instanceof GenerateFlowClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The AI flow generation request failed.";
}

function handleDialogKeyDown(
  event: KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
  closeDialog: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog();
    return;
  }

  if (event.key !== "Tab" || dialog === null) {
    return;
  }

  const focusableElements = findFocusableElements(dialog);
  if (focusableElements.length === 0) {
    return;
  }

  const first = focusableElements[0];
  if (first === undefined) {
    return;
  }

  const last = focusableElements.at(-1);
  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function findFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (root === null) {
    return [];
  }

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}
