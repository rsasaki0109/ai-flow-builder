import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";
import { isSafeIdentifierName, isTypeScriptReservedWord } from "./literals.js";

const DEFAULT_IDENTIFIER_FALLBACK = "value";
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const ASCII_TOKEN_PATTERN = /[A-Za-z0-9]+/g;

const NODE_KIND_FALLBACKS: Readonly<Record<FlowNodeKind, string>> = {
  "ai.text.generate": "aiGenerate",
  "core.input.text": "textInput",
  "core.output.text": "textOutput",
  "core.text.template": "textTemplate",
};

export class UniqueNameAllocator {
  private readonly usedNames: Set<string>;

  public constructor(reservedNames: readonly string[] = []) {
    this.usedNames = new Set(reservedNames);
  }

  public allocate(preferredName: string, fallbackName = "value"): string {
    const baseName = toSafeIdentifier(preferredName, fallbackName);
    let candidate = baseName;
    let suffix = 2;

    while (this.usedNames.has(candidate)) {
      candidate = `${baseName}${suffix}`;
      suffix += 1;
    }

    this.usedNames.add(candidate);
    return candidate;
  }
}

export function createUniqueNameAllocator(
  reservedNames: readonly string[] = [],
): UniqueNameAllocator {
  return new UniqueNameAllocator(reservedNames);
}

export function toSafeIdentifier(
  value: string,
  fallbackName = DEFAULT_IDENTIFIER_FALLBACK,
): string {
  const fallbackIdentifier = normalizeFallbackIdentifier(fallbackName);
  const identifier = lowerCamelCase(extractAsciiTokens(value));
  const withFallbackPrefix =
    identifier.length > 0
      ? prefixIfStartsWithDigit(identifier, fallbackIdentifier)
      : fallbackIdentifier;
  const safeIdentifier = isTypeScriptReservedWord(withFallbackPrefix)
    ? `${withFallbackPrefix}Value`
    : withFallbackPrefix;

  return isSafeIdentifierName(safeIdentifier)
    ? safeIdentifier
    : fallbackIdentifier;
}

export function createStableNodeVariableNames(
  nodes: readonly FlowNode[],
  reservedNames: readonly string[] = [],
): ReadonlyMap<FlowNode["id"], string> {
  const namesByNodeId = new Map<FlowNode["id"], string>();
  const allocator = createUniqueNameAllocator(reservedNames);
  const sortedNodes = [...nodes].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const node of sortedNodes) {
    namesByNodeId.set(
      node.id,
      allocator.allocate(node.label, NODE_KIND_FALLBACKS[node.kind]),
    );
  }

  return namesByNodeId;
}

function normalizeFallbackIdentifier(value: string): string {
  if (isSafeIdentifierName(value)) {
    return value;
  }

  const identifier = lowerCamelCase(extractAsciiTokens(value));
  const candidate =
    identifier.length > 0
      ? prefixIfStartsWithDigit(identifier, DEFAULT_IDENTIFIER_FALLBACK)
      : DEFAULT_IDENTIFIER_FALLBACK;

  return isTypeScriptReservedWord(candidate) ? `${candidate}Value` : candidate;
}

function extractAsciiTokens(value: string): readonly string[] {
  return (
    value
      .normalize("NFKD")
      .replace(COMBINING_MARKS_PATTERN, "")
      .match(ASCII_TOKEN_PATTERN) ?? []
  );
}

function lowerCamelCase(tokens: readonly string[]): string {
  return tokens
    .map((token, index) =>
      index === 0 ? token.toLowerCase() : capitalizeToken(token),
    )
    .join("");
}

function capitalizeToken(token: string): string {
  const lowerToken = token.toLowerCase();

  return `${lowerToken.charAt(0).toUpperCase()}${lowerToken.slice(1)}`;
}

function prefixIfStartsWithDigit(value: string, fallbackName: string): string {
  return /^\d/.test(value)
    ? `${fallbackName}${capitalizeIdentifier(value)}`
    : value;
}

function capitalizeIdentifier(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
