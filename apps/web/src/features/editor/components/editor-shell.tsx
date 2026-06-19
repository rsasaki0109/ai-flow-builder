"use client";

import type { FlowResource } from "@ai-flow-builder/flow-core";
import Link from "next/link";
import { useState } from "react";
import { AiGenerationDialog } from "../../ai-generation/components/ai-generation-dialog.js";
import { CodePanel } from "../../codegen/components/code-panel.js";
import { RunPanel } from "../../run/components/run-panel.js";
import { useEditorAutosave } from "../hooks/use-editor-autosave.js";
import { useEditorKeyboardShortcuts } from "../hooks/use-editor-keyboard-shortcuts.js";
import { NodeInspector } from "../inspector/node-inspector.js";
import type { SaveStatus } from "../store/index.js";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { useEditorValidation } from "../validation/index.js";
import { ConflictBanner } from "./conflict-banner.js";
import { FlowCanvas } from "./flow-canvas.js";
import { NodePalette } from "./node-palette.js";
import { ProblemsPanel } from "./problems-panel.js";

interface EditorShellProps {
  flow: FlowResource;
}

export function EditorShell({ flow }: EditorShellProps) {
  return (
    <EditorStoreProvider flow={flow}>
      <EditorShellContent />
    </EditorStoreProvider>
  );
}

function EditorShellContent() {
  const [activeBottomPanel, setActiveBottomPanel] =
    useState<BottomPanel>("problems");
  const [aiGenerationOpen, setAiGenerationOpen] = useState(false);
  const name = useEditorStore((store) => store.name);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const serverRevision = useEditorStore((store) => store.serverRevision);
  const updatedAt = useEditorStore((store) => store.updatedAt);
  const replaceGraphFromAi = useEditorStore(
    (store) => store.replaceGraphFromAi,
  );
  const validation = useEditorValidation();
  useEditorAutosave();
  useEditorKeyboardShortcuts();

  return (
    <main className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--panel)] px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
            href="/"
          >
            Back
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{name}</h1>
            <p className="text-xs text-[var(--muted)]">
              Revision {serverRevision} · Updated {formatDateTime(updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ValidationSummary
            errorCount={validation.errorCount}
            isValidating={validation.isValidating}
            warningCount={validation.warningCount}
          />
          <span className="rounded-md bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]">
            {formatSaveStatus(saveStatus)}
          </span>
          <button
            aria-label="Generate with AI"
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            onClick={() => {
              setAiGenerationOpen(true);
            }}
            type="button"
          >
            AI
          </button>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            disabled={validation.hasExecutableErrors}
            onClick={() => {
              setActiveBottomPanel("run");
            }}
            title={
              validation.hasExecutableErrors
                ? "Resolve validation errors before running."
                : "Open run panel."
            }
            type="button"
          >
            Run
          </button>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            disabled={validation.hasExecutableErrors}
            onClick={() => {
              setActiveBottomPanel("code");
            }}
            title={
              validation.hasExecutableErrors
                ? "Resolve validation errors before generating code."
                : "Open code panel."
            }
            type="button"
          >
            Generate Code
          </button>
        </div>
      </header>

      <AiGenerationDialog
        onApplyDraft={replaceGraphFromAi}
        onOpenChange={setAiGenerationOpen}
        open={aiGenerationOpen}
      />

      <ConflictBanner />

      <section className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="border-r border-[var(--border)] bg-[var(--panel)] p-4">
          <NodePalette />
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="min-h-0 flex-1 border-b border-[var(--border)]">
            <FlowCanvas />
          </div>
          <div className="h-72 bg-[var(--panel)] p-4">
            <BottomPanelTabs
              activePanel={activeBottomPanel}
              onSelectPanel={setActiveBottomPanel}
            />
            <div className="mt-3 h-[calc(100%-2.75rem)] min-h-0">
              {activeBottomPanel === "problems" ? (
                <ProblemsPanel
                  isValidating={validation.isValidating}
                  issues={validation.issues}
                />
              ) : null}
              {activeBottomPanel === "run" ? (
                <RunPanel disabled={validation.hasExecutableErrors} />
              ) : null}
              {activeBottomPanel === "code" ? (
                <CodePanel disabled={validation.hasExecutableErrors} />
              ) : null}
            </div>
          </div>
        </section>

        <aside className="border-l border-[var(--border)] bg-[var(--panel)] p-4">
          <NodeInspector />
        </aside>
      </section>
    </main>
  );
}

type BottomPanel = "problems" | "run" | "code";

function BottomPanelTabs({
  activePanel,
  onSelectPanel,
}: {
  readonly activePanel: BottomPanel;
  readonly onSelectPanel: (panel: BottomPanel) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-2" role="tablist">
      <button
        aria-selected={activePanel === "problems"}
        className={bottomPanelTabClassName(activePanel === "problems")}
        onClick={() => {
          onSelectPanel("problems");
        }}
        role="tab"
        type="button"
      >
        Problems
      </button>
      <button
        aria-selected={activePanel === "run"}
        className={bottomPanelTabClassName(activePanel === "run")}
        onClick={() => {
          onSelectPanel("run");
        }}
        role="tab"
        type="button"
      >
        Run
      </button>
      <button
        aria-selected={activePanel === "code"}
        className={bottomPanelTabClassName(activePanel === "code")}
        onClick={() => {
          onSelectPanel("code");
        }}
        role="tab"
        type="button"
      >
        Code
      </button>
    </div>
  );
}

function bottomPanelTabClassName(active: boolean): string {
  return active
    ? "h-8 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white"
    : "h-8 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)]";
}

function ValidationSummary({
  errorCount,
  isValidating,
  warningCount,
}: {
  readonly errorCount: number;
  readonly isValidating: boolean;
  readonly warningCount: number;
}) {
  const statusClassName =
    errorCount > 0
      ? "bg-red-50 text-red-700"
      : warningCount > 0
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <span
      aria-live="polite"
      className={`rounded-md px-3 py-2 text-sm font-medium ${statusClassName}`}
    >
      {errorCount} errors · {warningCount} warnings
      {isValidating ? " · Updating" : ""}
    </span>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSaveStatus(saveStatus: SaveStatus): string {
  switch (saveStatus) {
    case "conflict":
      return "Conflict";
    case "dirty":
      return "Unsaved";
    case "error":
      return "Save error";
    case "saving":
      return "Saving";
    case "idle":
    case "saved":
      return "Saved";
    default:
      return "Saved";
  }
}
