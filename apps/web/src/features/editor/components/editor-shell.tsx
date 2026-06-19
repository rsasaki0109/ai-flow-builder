"use client";

import type { FlowResource } from "@ai-flow-builder/flow-core";
import Link from "next/link";
import type { SaveStatus } from "../store/index.js";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { FlowCanvas } from "./flow-canvas.js";
import { NodePalette } from "./node-palette.js";

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
  const description = useEditorStore((store) => store.description);
  const flowId = useEditorStore((store) => store.flowId);
  const name = useEditorStore((store) => store.name);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const serverRevision = useEditorStore((store) => store.serverRevision);
  const updatedAt = useEditorStore((store) => store.updatedAt);

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
          <span className="rounded-md bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]">
            {formatSaveStatus(saveStatus)}
          </span>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            disabled
            type="button"
          >
            AI
          </button>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            disabled
            type="button"
          >
            Run
          </button>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            disabled
            type="button"
          >
            Generate Code
          </button>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="border-r border-[var(--border)] bg-[var(--panel)] p-4">
          <NodePalette />
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="min-h-0 flex-1 border-b border-[var(--border)]">
            <FlowCanvas />
          </div>
          <div className="h-48 bg-[var(--panel)] p-4">
            <h2 className="text-sm font-semibold">Problems</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Editor validation panel placeholder.
            </p>
          </div>
        </section>

        <aside className="border-l border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-semibold">Inspector</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Description</dt>
              <dd className="mt-1 leading-6">
                {description ?? "No description"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Flow ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{flowId}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
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
