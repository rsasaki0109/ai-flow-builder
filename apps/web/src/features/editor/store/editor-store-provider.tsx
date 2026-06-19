"use client";

import type { FlowResource } from "@ai-flow-builder/flow-core";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createEditorStore,
  type EditorStore,
  type EditorStoreApi,
} from "./editor-store.js";

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

interface EditorStoreProviderProps {
  flow: FlowResource;
  children: ReactNode;
}

export function EditorStoreProvider({
  children,
  flow,
}: EditorStoreProviderProps) {
  const storeRef = useRef<EditorStoreApi | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createEditorStore(flow);
  }

  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
}

export function useEditorStore<TSelected>(
  selector: (store: EditorStore) => TSelected,
): TSelected {
  const store = useContext(EditorStoreContext);

  if (store === null) {
    throw new Error("useEditorStore must be used inside EditorStoreProvider.");
  }

  return useStore(store, selector);
}
