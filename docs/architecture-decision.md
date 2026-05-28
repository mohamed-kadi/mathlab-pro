# Architecture Decision: Production Backend Direction

## Status

Accepted.

## Decision

MathLab Pro will keep the current TypeScript API as the working application runtime while the production backend target is implemented in Java 21 with Spring Boot.

The React + TypeScript frontend remains the primary client. Backend migration is contract-first: the API contract in `docs/openapi.yaml` defines the behavior that both backend runtimes must satisfy.

## Target Architecture

- Frontend: React + TypeScript.
- Production backend: Java 21, Spring Boot, Maven, under `backend/`.
- API style: REST with versionable `/api` routes, documented by OpenAPI.
- Authentication: Spring Security, JWT bearer tokens, BCrypt password hashing.
- Persistence: PostgreSQL with Flyway migrations.
- Cache: Redis for repeated calculations and high-cost math workflows.
- Math libraries: Symja for symbolic algebra and Apache Commons Math for matrix operations, numerical methods, and statistics.
- Realtime path: Spring WebSocket/STOMP for live calculations and future collaboration.
- Testing: API contract tests first, then Java unit/integration tests once endpoints are ported.

## Rationale

The original product prompt is backend-heavy and explicitly calls for Java 21, Spring Boot, PostgreSQL, Redis, JWT security, WebSockets, and robust math libraries. Java/Spring Boot is a better long-term fit for the production backend because it provides strong structure around security, persistence, validation, observability, and testable service boundaries.

The current TypeScript API is useful because it already supports the frontend workflows, API behavior, storage model, and math UX. It should remain in place until the Spring Boot backend reaches feature parity.

## Migration Plan

1. Maintain the current TypeScript API as the runnable application backend.
2. Treat `docs/openapi.yaml` as the backend contract.
3. Use portable API contract tests that can run against either backend.
4. Continue hardening `backend/` with Spring Boot, Maven, security, health, OpenAPI, PostgreSQL, Redis, and test foundations.
5. Port endpoints incrementally in this order:
   - Health and authentication.
   - Projects, saved expressions, history, graph configurations, and sharing.
   - Cache status and audit logs.
   - Math endpoints.
   - WebSocket/live calculation workflows.
6. Point the frontend at the Spring Boot backend once contract tests pass.
7. Remove the duplicate TypeScript API paths after Spring Boot parity is reached.

## Consequences

- We should avoid large runtime-specific unit test investment unless it protects current migration work.
- We should prioritize OpenAPI, contract tests, and Java service tests.
- Frontend work should depend on stable API contracts, not Node implementation details.
- The repository can temporarily contain both backends during migration.
