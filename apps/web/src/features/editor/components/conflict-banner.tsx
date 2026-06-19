"use client";

import {
  flowResourceSchema,
  successResponseSchema,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { useState } from "react";
import { useEditorStore } from "../store/index.js";

const flowResourceResponseSchema = successResponseSchema(flowResourceSchema);

export function ConflictBanner() {
  const applySavedResource = useEditorStore(
    (store) => store.applySavedResource,
  );
  const conflictRevision = useEditorStore((store) => store.conflictRevision);
  const description = useEditorStore((store) => store.description);
  const flowId = useEditorStore((store) => store.flowId);
  const graph = useEditorStore((store) => store.graph);
  const name = useEditorStore((store) => store.name);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [reloadStatus, setReloadStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  if (saveStatus !== "conflict") {
    return null;
  }

  const copyCurrentFlowJson = async () => {
    setCopyStatus("idle");

    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ description, graph, name }, null, 2),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const reloadServerVersion = async () => {
    setReloadStatus("loading");

    try {
      const flow = await fetchFlowResource(flowId);
      applySavedResource(flow);
      setReloadStatus("idle");
      setCopyStatus("idle");
    } catch {
      setReloadStatus("error");
    }
  };

  return (
    <section
      aria-label="Revision conflict"
      className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950"
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">A newer server version exists.</h2>
          <p className="mt-1 text-amber-900">
            Autosave stopped because the server is at revision{" "}
            {conflictRevision ?? "unknown"}. Copy your current Flow JSON before
            reloading if you need to preserve local edits.
          </p>
          {copyStatus === "copied" ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Current Flow JSON copied.
            </p>
          ) : null}
          {copyStatus === "error" ? (
            <p className="mt-1 text-xs font-medium text-red-700">
              Could not copy Flow JSON.
            </p>
          ) : null}
          {reloadStatus === "error" ? (
            <p className="mt-1 text-xs font-medium text-red-700">
              Could not reload the server version.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950"
            onClick={() => {
              void copyCurrentFlowJson();
            }}
            type="button"
          >
            Copy Current Flow JSON
          </button>
          <button
            className="h-9 rounded-md bg-amber-700 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={reloadStatus === "loading"}
            onClick={() => {
              void reloadServerVersion();
            }}
            type="button"
          >
            {reloadStatus === "loading"
              ? "Reloading..."
              : "Reload Server Version"}
          </button>
        </div>
      </div>
    </section>
  );
}

async function fetchFlowResource(flowId: string): Promise<FlowResource> {
  const response = await fetch(`/api/flows/${flowId}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Failed to reload flow.");
  }

  const body: unknown = await response.json();
  return flowResourceResponseSchema.parse(body).data;
}
