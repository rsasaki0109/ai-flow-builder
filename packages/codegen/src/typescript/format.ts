import { format } from "prettier";

export async function formatTypeScript(source: string): Promise<string> {
  return format(source, {
    parser: "typescript",
  });
}
