# ADR-0006: Localized DB Integration Lib Check Exception

## Status

Accepted

## Context

The project keeps `skipLibCheck: false` in the shared TypeScript base config. After adding Drizzle ORM for the SQLite/libSQL persistence layer, `tsc` checks Drizzle declaration files for optional database drivers that this MVP does not use, including MySQL, SingleStore, and Gel paths. With the current stable Drizzle package and TypeScript configuration, those external declarations fail before the application DB schema is checked.

The Next.js web app also imports the DB package from its server composition root, so the same external Drizzle declarations are loaded during the web package typecheck.

## Decision

`packages/db/tsconfig.json` and `apps/web/tsconfig.json` set `skipLibCheck: true` locally. The exception is limited to the packages that import the Drizzle-backed DB integration. Application source still uses strict TypeScript settings, and other packages inherit the root `skipLibCheck: false` setting.

## Consequences

- DB and web source files remain typechecked.
- External Drizzle declaration failures do not block the MVP.
- The exception should be revisited when Drizzle and TypeScript are upgraded.
