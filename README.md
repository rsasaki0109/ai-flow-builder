# AI Flow Builder

AI Flow Builder is a web-first visual programming platform for building small AI and text-processing flows. The MVP centers every feature on a shared Flow IR, so the editor, validation, execution engine, AI planning pipeline, persistence, and future code generation all work against the same domain model instead of React Flow internals.

This repository is in active MVP development. It is intended for local development and trusted single-user deployments while the v0.1.0 feature set is being completed.

## Play Online

A static GitHub Pages playground is available at:

https://rsasaki0109.github.io/ai-flow-builder/

The playground runs fully in the browser with a fake AI provider. It does not use the Next.js API, SQLite persistence, OpenAI, or server-side execution.

## MVP Scope

The target MVP supports:

- Browser-based flow editing with four built-in node kinds: text input, text template, AI text generation, and text output.
- Flow storage in SQLite/libSQL through a modular Next.js monolith.
- Deterministic graph validation with separate storage and executable checks.
- Server-side flow execution without arbitrary JavaScript, Python, shell, HTTP, or database query nodes.
- AI-assisted flow planning through a provider abstraction with disabled, fake, and OpenAI adapters.
- Deterministic TypeScript code generation from Flow IR in a later MVP task.

Current implementation status:

- Core Flow IR, node specs, validation, layout, persistence, CRUD APIs, editor shell, inspector, autosave, conflict handling, execution engine, run API/panel, AI provider abstraction, OpenAI adapter, and FlowPlan schema/prompt foundations are implemented.
- Code generation UI/API, AI generation service/UI, final E2E suite, Docker packaging, and full OSS docs are still in progress.

## Tech Stack

- Node.js 24 and pnpm 11
- TypeScript with strict compiler settings
- Next.js App Router and React
- React Flow via `@xyflow/react`
- Zustand for editor state
- Zod for domain, API, AI, and config validation
- Drizzle ORM with SQLite/libSQL
- Vitest for unit and integration tests
- OpenAI official TypeScript SDK behind an adapter boundary

## Quick Start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

The default configuration runs with AI disabled and stores data in `./data/ai-flow-builder.db`.

## Environment

The app reads environment variables only through `apps/web/src/server/config.ts`.

| Variable                | Default                          | Notes                                        |
| ----------------------- | -------------------------------- | -------------------------------------------- |
| `NODE_ENV`              | `development`                    | `development`, `test`, or `production`       |
| `APP_ROOT`              | `.`                              | Base path for relative `file:` database URLs |
| `DATABASE_URL`          | `file:./data/ai-flow-builder.db` | Local SQLite/libSQL file URL                 |
| `AI_PROVIDER`           | `disabled`                       | `disabled`, `fake`, or `openai`              |
| `OPENAI_API_KEY`        | unset                            | Required only when `AI_PROVIDER=openai`      |
| `OPENAI_MODEL`          | unset                            | Required only when `AI_PROVIDER=openai`      |
| `AI_REQUEST_TIMEOUT_MS` | `45000`                          | Timeout for AI planning calls                |
| `FLOW_RUN_TIMEOUT_MS`   | `60000`                          | Timeout for flow execution                   |
| `LOG_LEVEL`             | `info`                           | Server log level                             |

For deterministic local or CI AI behavior:

```bash
AI_PROVIDER=fake pnpm dev
```

## Quality Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check
pnpm --filter @ai-flow-builder/web build
```

The repository requires Node.js 24. Running these commands on older Node versions may emit engine warnings.

## Architecture

AI Flow Builder is a modular monolith:

- `apps/web` contains the Next.js UI, API route handlers, server config, and application services.
- `packages/flow-core` contains Flow IR schemas, node specs, validation, and graph utilities.
- `packages/flow-engine` contains deterministic node executors and flow execution.
- `packages/ai` contains provider-neutral AI contracts, fake/disabled providers, OpenAI adapter, FlowPlan schema, and prompts.
- `packages/db` contains Drizzle schema and repository implementations.
- `packages/codegen` is reserved for deterministic TypeScript generation.

Important boundaries:

- React Flow types are not persisted.
- Route handlers do not contain business logic or SQL.
- Environment variables are not read outside server config.
- LLM output is treated as untrusted and must pass schema and graph validation.
- Generated code is for display, copy, or download only. The app does not execute generated code.

## Security and Deployment Notes

The MVP has no authentication, multi-user workspace, RBAC, or sharing model. Do not expose it directly to the public internet without adding an authentication layer.

AI prompts and flow inputs may be sent to the configured AI provider when AI features are enabled. Use `AI_PROVIDER=disabled` for no external AI calls, or `AI_PROVIDER=fake` for deterministic local testing.

## License

Apache-2.0 is the intended repository license for the MVP. The license file will be added as part of the OSS release-preparation tasks.
