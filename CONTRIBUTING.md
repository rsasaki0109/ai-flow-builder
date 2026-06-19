# Contributing

Thanks for taking the time to improve AI Flow Builder. The MVP is intentionally small, so contributions should keep the existing architecture and scope intact.

## Development Setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

For deterministic local AI behavior, run:

```bash
AI_PROVIDER=fake pnpm dev
```

## Project Boundaries

- Keep Flow IR as the persistence and interoperability model.
- Do not persist React Flow internal node or edge types.
- Keep backend logic inside application services and packages, not route handlers.
- Do not add arbitrary JavaScript, Python, shell, HTTP request, database query, file system, browser automation, MCP, or agent tool execution nodes.
- Treat AI output as untrusted. It must pass schema validation, allowlist validation, and graph validation.
- Do not execute generated code inside the application runtime.
- Read environment variables only through `apps/web/src/server/config.ts`.

## Dependencies

Do not add dependencies unless they are necessary for the task. New dependencies should be stable releases and should include a short rationale in the pull request. Avoid canary, alpha, beta, and `latest` dependency ranges.

## Quality Gates

Before opening a pull request, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check
```

When the change affects the web app build or deployment path, also run:

```bash
pnpm --filter @ai-flow-builder/web build
```

When E2E coverage exists for the changed behavior, run:

```bash
AI_PROVIDER=fake pnpm test:e2e
```

## Tests

Every behavior change should include a focused test. Prefer unit tests for Flow IR schemas, validation, graph algorithms, execution, AI normalization, code generation, and error mapping. Use component and E2E tests for user workflows that cannot be covered cleanly at lower levels.

## Pull Requests

Pull requests should describe:

- What changed.
- Why it is in MVP scope.
- What tests were added or updated.
- Which verification commands were run.
- Any security or privacy impact.

Do not include secrets, API keys, local database files, generated logs, or local `.env` files.
