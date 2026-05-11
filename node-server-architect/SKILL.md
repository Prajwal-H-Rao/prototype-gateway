---
name: node-server-architect
description: "Production-grade Node.js backend scaffolding and code review. Use when Codex needs to create or refactor a Node.js server (Express/Fastify/Koa/Nest) with TypeScript: (1) design a clean directory/module structure, (2) verify/improve TypeScript setup, (3) enforce formatting + linting, and (4) review code for performance/efficiency and security risks."
---

# Node Server Architect

## Overview

Create a scalable Node.js server layout and tighten up TypeScript/tooling, then run a focused review for performance, reliability, and security issues.

## Workflow (use in order)

### 1) Snapshot the project
- Detect package manager: `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`.
- Detect framework: look in `package.json` deps for `express`, `fastify`, `@nestjs/*`, `koa`.
- Detect TypeScript: `tsconfig.json` and `src/**/*.ts`.
- Note runtime constraints: `package.json#engines`, `.nvmrc`, Dockerfile, deployment target (serverless vs long-running).

### 2) Choose the "best default" structure (module-first)
Default to module-first unless the repo already has a strong layer-first convention.

Recommended tree (keep names consistent; create only what you need):

```
src/
  main.ts                # process bootstrap + server start
  app.ts                 # framework instance, global middleware
  config/                # env parsing + config objects
  modules/
    health/
      health.route.ts
      health.controller.ts
    users/
      users.route.ts
      users.controller.ts
      users.service.ts
      users.repo.ts
      users.schema.ts    # validation schema(s)
  shared/
    http/                # request/response helpers
    errors/              # error types + mapping
    logger/              # logger setup (e.g. pino)
    security/            # CORS/rate-limit/helmet config, helpers
    util/                # tiny pure helpers only
  types/
tests/
scripts/
```

Rules of thumb:
- Keep `src/main.ts` as the composition root (wiring only; no business logic).
- Keep each `src/modules/<name>/` self-contained; avoid cross-module imports except via `shared/`.
- Prefer "one direction" imports: `modules/*` may import `shared/*`, not vice versa.

### 3) Scaffold or refactor safely
- Never delete/rename large swaths without explicit user request.
- If starting fresh (or doing a big restructure), use `node-server-architect/scripts/scaffold_node_server.ps1`.
- If refactoring an existing repo, move incrementally and keep `main.ts` bootstrapping stable.

### 4) Verify TypeScript + formatting toolchain
Goal: `typecheck`, `lint`, and `format` must be deterministic in CI.

TypeScript checks:
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true` (when feasible), `exactOptionalPropertyTypes: true` (when feasible).
- Ensure `rootDir`/`outDir` make sense (common: `src` -> `dist`) and that build emits to `dist/`.
- Prefer `moduleResolution` aligned to your runtime (NodeNext for ESM, or Node for CJS).

Formatting/linting checks:
- Prefer Prettier + ESLint (TypeScript ESLint) with no formatting rule conflicts.
- Ensure scripts exist in `package.json`: `format`, `lint`, `typecheck`, and optionally `test`.
- Use `node-server-architect/scripts/project_report.ps1` to print a quick "what's missing" report.

### 5) Review code: performance, reliability, security
Use `node-server-architect/references/review_checklist.md` as the default checklist.

Review approach:
- Start with entrypoints (`main.ts`, server setup) then global middleware, then hottest request paths.
- Look for security footguns first (authz, validation, SSRF, path traversal, unsafe deserialization).
- Then performance: sync I/O in handlers, unbounded concurrency, missing timeouts, N+1 calls, accidental sequential awaits.

If the repo has tests/CI:
- Prefer `npm|pnpm|yarn run typecheck`, then `lint`, then targeted tests.
- Don't add new heavy dependencies just to satisfy the review unless the user asks.

### 6) Security posture defaults (when scaffolding)
If the user asks for "production ready defaults", prefer:
- Centralized request validation (schema-based) at route boundaries.
- Safe error mapping (no stack traces in prod responses).
- Request size limits and timeouts.
- CORS allowlist (not `*` for credentialed requests).
- Rate limiting on auth endpoints and expensive routes.
- Structured logging with redaction of secrets/PII.

## Bundled resources
- `node-server-architect/scripts/scaffold_node_server.ps1`: creates the module-first folder layout (no installs).
- `node-server-architect/scripts/project_report.ps1`: prints a tooling/TS/formatting status report.
- `node-server-architect/references/review_checklist.md`: performance + security checklist for Node servers.
