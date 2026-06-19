import { aiTextGenerateExecutor } from "./ai-text-generate.js";
import { inputTextExecutor } from "./input-text.js";
import { outputTextExecutor } from "./output-text.js";
import { textTemplateExecutor } from "./text-template.js";

export { aiTextGenerateExecutor } from "./ai-text-generate.js";
export { inputTextExecutor } from "./input-text.js";
export { outputTextExecutor } from "./output-text.js";
export { textTemplateExecutor } from "./text-template.js";

export const deterministicNodeExecutors = [
  inputTextExecutor,
  textTemplateExecutor,
  outputTextExecutor,
] as const;

export const builtInNodeExecutors = [
  ...deterministicNodeExecutors,
  aiTextGenerateExecutor,
] as const;
