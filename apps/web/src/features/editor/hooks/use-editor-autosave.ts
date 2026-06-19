"use client";

import {
  errorResponseSchema,
  flowResourceSchema,
  successResponseSchema,
  type FlowGraph,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { useEditorStore, useEditorStoreApi } from "../store/index.js";

export const AUTOSAVE_DEBOUNCE_MS = 800;

export interface AutosaveRequest {
  readonly flowId: string;
  readonly expectedRevision: number;
  readonly name: string;
  readonly description: string | null;
  readonly graph: FlowGraph;
}

export type AutosaveResult =
  | {
      readonly status: "saved";
      readonly flow: FlowResource;
    }
  | {
      readonly status: "conflict";
      readonly currentRevision: number;
    };

export type SaveFlow = (
  request: AutosaveRequest,
  signal: AbortSignal,
) => Promise<AutosaveResult>;

export interface UseEditorAutosaveOptions {
  readonly debounceMs?: number;
  readonly saveFlow?: SaveFlow;
}

const flowResourceResponseSchema = successResponseSchema(flowResourceSchema);
const revisionConflictDetailsSchema = z
  .object({
    currentRevision: z.number().int().min(1),
  })
  .strict();

export function useEditorAutosave(
  options: UseEditorAutosaveOptions = {},
): void {
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  const saveFlow = options.saveFlow ?? saveFlowResource;
  const store = useEditorStoreApi();
  const dirty = useEditorStore((state) => state.dirty);
  const graph = useEditorStore((state) => state.graph);
  const name = useEditorStore((state) => state.name);
  const description = useEditorStore((state) => state.description);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const serverRevision = useEditorStore((state) => state.serverRevision);
  const timeoutIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveFlowRef = useRef(saveFlow);

  useEffect(() => {
    saveFlowRef.current = saveFlow;
  }, [saveFlow]);

  useEffect(() => {
    if (!dirty || saveStatus !== "dirty") {
      return;
    }

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    scheduleSave(debounceMs);

    return () => {
      clearScheduledSave();
    };

    function scheduleSave(delayMs: number) {
      clearScheduledSave();
      timeoutIdRef.current = window.setTimeout(() => {
        timeoutIdRef.current = null;
        void runSave();
      }, delayMs);
    }

    function clearScheduledSave() {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }

    async function runSave() {
      isSavingRef.current = true;

      try {
        while (true) {
          const snapshotState = store.getState();

          if (!snapshotState.dirty || snapshotState.saveStatus !== "dirty") {
            return;
          }

          const request: AutosaveRequest = {
            description: snapshotState.description,
            expectedRevision: snapshotState.serverRevision,
            flowId: snapshotState.flowId,
            graph: structuredClone(snapshotState.graph),
            name: snapshotState.name,
          };
          const abortController = new AbortController();

          abortControllerRef.current = abortController;
          pendingSaveRef.current = false;
          snapshotState.markSaving();

          try {
            const result = await saveFlowRef.current(
              request,
              abortController.signal,
            );

            if (abortController.signal.aborted) {
              return;
            }

            if (result.status === "conflict") {
              store.getState().markConflict(result.currentRevision);
              return;
            }

            store.getState().applyAutosaveResult(result.flow, {
              description: request.description,
              graph: request.graph,
              name: request.name,
            });
          } catch {
            if (abortController.signal.aborted) {
              return;
            }

            store.getState().markSaveError();
            return;
          } finally {
            if (abortControllerRef.current === abortController) {
              abortControllerRef.current = null;
            }
          }

          const latestState = store.getState();
          if (
            !pendingSaveRef.current ||
            !latestState.dirty ||
            latestState.saveStatus !== "dirty"
          ) {
            return;
          }
        }
      } finally {
        isSavingRef.current = false;
      }
    }
  }, [
    debounceMs,
    description,
    dirty,
    graph,
    name,
    saveStatus,
    serverRevision,
    store,
  ]);

  useEffect(
    () => () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }

      abortControllerRef.current?.abort();
    },
    [],
  );
}

export async function saveFlowResource(
  request: AutosaveRequest,
  signal: AbortSignal,
): Promise<AutosaveResult> {
  const response = await fetch(`/api/flows/${request.flowId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      description: request.description,
      expectedRevision: request.expectedRevision,
      graph: request.graph,
      name: request.name,
    }),
    signal,
  });

  const body: unknown = await response.json();

  if (response.ok) {
    return {
      flow: flowResourceResponseSchema.parse(body).data,
      status: "saved",
    };
  }

  const errorBody = errorResponseSchema.safeParse(body);
  if (response.status === 409 && errorBody.success) {
    const details = revisionConflictDetailsSchema.safeParse(
      errorBody.data.error.details,
    );

    if (details.success) {
      return {
        currentRevision: details.data.currentRevision,
        status: "conflict",
      };
    }
  }

  throw new Error("Autosave failed.");
}
