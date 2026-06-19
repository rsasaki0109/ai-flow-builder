const IDENTIFIER_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const TYPESCRIPT_RESERVED_WORDS = new Set([
  "abstract",
  "any",
  "as",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "never",
  "new",
  "null",
  "number",
  "object",
  "of",
  "package",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unique",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export function toTypeScriptStringLiteral(value: string): string {
  const serialized = JSON.stringify(value);

  return serialized
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function toTypeScriptPropertyKey(value: string): string {
  return isSafeIdentifierName(value) ? value : toTypeScriptStringLiteral(value);
}

export function isSafeIdentifierName(value: string): boolean {
  return (
    IDENTIFIER_NAME_PATTERN.test(value) && !TYPESCRIPT_RESERVED_WORDS.has(value)
  );
}

export function isTypeScriptReservedWord(value: string): boolean {
  return TYPESCRIPT_RESERVED_WORDS.has(value);
}
