"use client";

import {
  validateExecutable,
  type ValidationIssue,
} from "@ai-flow-builder/flow-core";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../store/index.js";

const DEFAULT_VALIDATION_DEBOUNCE_MS = 150;

export interface EditorValidationState {
  readonly errorCount: number;
  readonly hasExecutableErrors: boolean;
  readonly isValidating: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly warningCount: number;
}

export function useEditorValidation(
  debounceMs = DEFAULT_VALIDATION_DEBOUNCE_MS,
): EditorValidationState {
  const graph = useEditorStore((store) => store.graph);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>(
    () => validateExecutable(graph).issues,
  );
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    setIsValidating(true);

    const timeoutId = window.setTimeout(() => {
      setIssues(validateExecutable(graph).issues);
      setIsValidating(false);
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, graph]);

  return useMemo(() => {
    const errorCount = issues.filter(
      (issue) => issue.severity === "error",
    ).length;
    const warningCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;

    return {
      errorCount,
      hasExecutableErrors: errorCount > 0,
      isValidating,
      issues,
      warningCount,
    };
  }, [isValidating, issues]);
}
