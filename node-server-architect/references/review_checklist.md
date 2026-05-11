# Node.js server review checklist (performance + security)

Use this as a structured pass when reviewing a Node.js backend (TypeScript or JS).

## 1) Attack surface + input handling
- Validate at the boundary (route level): request params/query/body/headers; reject unknown fields where appropriate.
- Never trust `req.body` types: use runtime schemas (Zod/Joi/Yup/class-validator) or manual guards.
- Enforce request size limits (`express.json({ limit })`, Fastify bodyLimit) and parse timeouts where supported.

## 2) Authn/authz correctness
- Check authorization is enforced server-side for every sensitive action (not just “is logged in”).
- Avoid “role in JWT => trusted forever” pitfalls; consider server-side re-checks for high-risk actions.
- Ensure rate limiting on login/OTP/reset flows and other brute-force surfaces.

## 3) SSRF, path traversal, and injection risks
- Any outbound fetch/http client: enforce allowlists, block internal ranges if untrusted URLs are accepted.
- Any filesystem access: ensure paths are resolved against a fixed base dir and reject `..` traversal.
- Any shell/child_process usage: prefer safe APIs; never concatenate untrusted strings into commands.

## 4) Secrets and logging hygiene
- Never log credentials, tokens, cookies, raw Authorization headers, or full request bodies by default.
- Redact sensitive fields centrally (logger configuration) and keep debug logging off in prod.
- Ensure secrets come from env/secret manager, not committed config.

## 5) HTTP hardening defaults
- Disable framework fingerprints (`x-powered-by`) and enable sensible security headers (Helmet or equivalent).
- Configure CORS explicitly (allowlist origins; avoid `*` with credentials).
- Ensure cookie flags for sessions: `HttpOnly`, `Secure`, `SameSite` as appropriate.

## 6) Dependency and supply-chain posture
- Review dependency footprint; remove unused transitive-heavy packages.
- Run audit tooling (`npm audit` / `pnpm audit`) when requested; prioritize exploitable paths.
- Ensure lockfile is committed and CI uses it.

## 7) Performance: event loop and throughput
- Avoid sync I/O (`fs.*Sync`, sync crypto, large JSON stringify/parse) in request paths.
- Look for accidental sequential awaits (e.g., awaiting inside loops); parallelize safely with limits.
- Add timeouts to outbound requests and database calls; use connection pooling.
- Prefer streaming for large payloads (uploads/downloads) instead of buffering.

## 8) Reliability and operability
- Implement graceful shutdown (stop accepting new connections, drain, close DB pools).
- Provide health endpoints (liveness/readiness) and structured logs (request id, latency).
- Use consistent error mapping: internal details in logs, safe messages to clients.

## 9) TypeScript and formatting/tooling
- Ensure `tsconfig.json` is strict; avoid broad `any` and unsafe casts.
- Prefer `eslint` + `prettier` with a single source of formatting truth (no conflicting rules).
- Ensure `typecheck`, `lint`, and tests run in CI deterministically.
