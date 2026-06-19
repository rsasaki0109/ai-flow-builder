# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@11.0.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/codegen/package.json packages/codegen/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/flow-core/package.json packages/flow-core/package.json
COPY packages/flow-engine/package.json packages/flow-engine/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN mkdir -p /app/data \
  && APP_ROOT=/app DATABASE_URL=file:/app/data/build.db AI_PROVIDER=disabled LOG_LEVEL=silent pnpm db:migrate \
  && APP_ROOT=/app DATABASE_URL=file:/app/data/build.db AI_PROVIDER=disabled LOG_LEVEL=silent pnpm build \
  && rm -rf /app/data

FROM base AS runner

ENV NODE_ENV=production \
    APP_ROOT=/app \
    COREPACK_HOME=/app/.cache/node/corepack \
    DATABASE_URL=file:/app/data/ai-flow-builder.db \
    AI_PROVIDER=disabled \
    AI_REQUEST_TIMEOUT_MS=45000 \
    FLOW_RUN_TIMEOUT_MS=60000 \
    LOG_LEVEL=info \
    PORT=3000

RUN groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app --home-dir /app app

COPY --from=builder --chown=app:app /app /app

RUN mkdir -p /app/data /app/.cache/node/corepack \
  && corepack prepare pnpm@11.0.0 --activate \
  && chown -R app:app /app

USER app

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||'3000'; fetch('http://127.0.0.1:'+port+'/api/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "pnpm db:migrate && pnpm --filter @ai-flow-builder/web start"]
