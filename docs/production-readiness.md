# Production Readiness Checklist

MathLab Pro is useful today for local development, demos, and feature validation through the current TypeScript API. It is not ready for public production deployment until the items below are complete and verified.

## Ready Today

- React workspace, graphing, math modules, auth flows, projects, saved expressions, history, cache status, and AI fallback behavior are runnable locally.
- JSON storage works by default for development.
- PostgreSQL repositories and JSON migration tooling exist for the current API.
- Docker Compose starts the app, PostgreSQL, and Redis.
- CI runs lint, unit tests, contract tests, build, Docker Compose validation, and Spring backend tests.
- The Spring Boot backend has JWT auth, PostgreSQL/Flyway, Redis configuration, health/cache endpoints, workspace/history/graph/share/audit endpoints, math cache headers, AI explanation fallback, OpenAPI UI wiring, and MockMvc tests.
- Deterministic math-engine golden cases cover the current API and the Spring backend library-backed math slice.
- The portable API contract suite passes against the Spring Boot backend when run against a live H2-backed contract instance.

## Required Before Production

- Add the Spring Boot contract target to CI.
- Complete remaining advanced symbolic math gaps before making the Java backend the only runtime.
- Switch the default application runtime to Spring Boot only after contract parity.
- Add production Docker image and Compose/Kubernetes deployment path for the Spring Boot backend.
- Replace local JSON fallback in production with PostgreSQL-only persistence and tested migrations.
- Add secret management for JWT, database credentials, Redis, and AI provider keys.
- Finalize CORS, CSRF strategy, secure headers, request size limits, and rate limiting at the backend and proxy layers.
- Persist audit logs, add retention policy, and expose admin-safe query boundaries.
- Add observability: structured logs, metrics, health/readiness probes, tracing hooks, and alertable error rates.
- Add backup and restore procedures for PostgreSQL.
- Add Nginx/TLS production configuration and documented environment-specific config.
- Add dependency scanning and container scanning in CI.
- Add load tests for large expressions, matrix operations, cache pressure, and concurrent auth/workspace traffic.
- Add frontend error-boundary coverage and browser smoke tests for core workflows.

## Near-Term Phase Plan

1. Add the Spring Boot contract target to CI and keep both runtimes contract-checked.
2. Expand math modules with Symja-backed symbolic algebra while keeping Apache Commons Math and EJML behind service-layer boundaries.
3. Make Spring Boot the default backend after CI parity and deployment packaging are complete.
4. Harden production deployment with secrets, Nginx/TLS, observability, backups, and rate limiting.
5. Add browser smoke tests and load tests before any public launch.
