"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export interface FlowListItem {
  id: string;
  name: string;
  description: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface FlowListClientProps {
  initialItems: FlowListItem[];
  aiEnabled: boolean;
}

interface FlowResourceResponse {
  data: {
    id: string;
  };
}

export function FlowListClient({
  initialItems,
  aiEnabled,
}: FlowListClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [items],
  );

  const createFlow = () => {
    setErrorMessage(null);
    startTransition(() => {
      void createFlowAndNavigate();
    });
  };

  const deleteFlow = (flow: FlowListItem) => {
    if (!window.confirm(`Delete "${flow.name}"?`)) {
      return;
    }

    setErrorMessage(null);
    setDeletingFlowId(flow.id);
    void deleteFlowById(flow.id);
  };

  const createFlowAndNavigate = async () => {
    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Flow",
          description: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create flow.");
      }

      const body = (await response.json()) as FlowResourceResponse;
      router.push(`/flows/${body.data.id}`);
    } catch {
      setErrorMessage("Could not create the flow.");
    }
  };

  const deleteFlowById = async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete flow.");
      }

      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== flowId),
      );
    } catch {
      setErrorMessage("Could not delete the flow.");
    } finally {
      setDeletingFlowId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-8 py-8 text-[var(--foreground)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-7">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
              MVP v0.1.0
            </p>
            <h1 className="text-4xl font-semibold leading-tight">
              AI Flow Builder
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[var(--muted)]">
              Build local visual flows from text inputs, templates, AI
              generation, and text outputs.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isPending}
              onClick={createFlow}
              type="button"
            >
              New Flow
            </button>
            <button
              aria-disabled={!aiEnabled}
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 text-sm font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!aiEnabled}
              type="button"
            >
              Generate with AI
            </button>
          </div>
        </header>

        {errorMessage === null ? null : (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {!aiEnabled ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            AI generation is disabled. Set AI_PROVIDER to fake or openai to use
            it.
          </div>
        ) : null}

        {sortedItems.length === 0 ? (
          <section className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] px-6 text-center">
            <h2 className="text-xl font-semibold">No flows yet</h2>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              Create a flow to start arranging inputs, transformations, AI
              generation, and outputs.
            </p>
            <button
              className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isPending}
              onClick={createFlow}
              type="button"
            >
              New Flow
            </button>
          </section>
        ) : (
          <section
            aria-label="Flows"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {sortedItems.map((flow) => (
              <article
                className="flex min-h-52 flex-col justify-between gap-5 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm"
                key={flow.id}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="break-words text-lg font-semibold leading-7">
                      {flow.name}
                    </h2>
                    <span className="shrink-0 rounded-md bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
                      rev {flow.revision}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                    {flow.description ?? "No description"}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-[var(--muted)]">
                    Updated {formatDateTime(flow.updatedAt)}
                  </p>
                  <div className="flex gap-3">
                    <Link
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-medium text-white"
                      href={`/flows/${flow.id}`}
                    >
                      Open
                    </Link>
                    <button
                      className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={deletingFlowId === flow.id}
                      onClick={() => deleteFlow(flow)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
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
