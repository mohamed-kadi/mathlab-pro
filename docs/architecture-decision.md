# Architecture Decision: Production Backend Direction

## Status

Accepted.

## Decision

MathLab Pro will use the current Node/Express backend as a working prototype and reference implementation, while the production backend target is Java 21 with Spring Boot.

The React + TypeScript frontend remains the primary client. Backend migration will be contract-first: the API contract in `docs/openapi.yaml` defines the behavior that both the existing Node backend and the future Java backend must satisfy.

## Target Architecture

- Frontend: React + TypeScript.
- Production backend: Java 21, Spring Boot, Maven.
- API style: REST with versionable `/api` routes, documented by OpenAPI.
- Authentication: Spring Security, JWT bearer tokens, BCrypt password hashing.
- Persistence: PostgreSQL with Flyway migrations.
- Cache: Redis for repeated calculations and high-cost math workflows.
- Math libraries: Symja for symbolic algebra, Apache Commons Math for numerical methods/statistics, EJML for matrix operations.
- Realtime path: Spring WebSocket/STOMP for live calculations and future collaboration.
- Testing: API contract tests first, then Java unit/integration tests once endpoints are ported.

## Rationale

The original product prompt is backend-heavy and explicitly calls for Java 21, Spring Boot, PostgreSQL, Redis, JWT security, WebSockets, and robust math libraries. Java/Spring Boot is a better long-term fit for the production backend because it provides strong structure around security, persistence, validation, observability, and testable service boundaries.

The current Node backend is useful because it already proves the frontend workflows, API behavior, storage model, and math UX. It should remain in place until the Java backend reaches feature parity.

## Migration Plan

1. Maintain the current Node backend as the runnable prototype.
2. Treat `docs/openapi.yaml` as the backend contract.
3. Use portable API contract tests that can run against either backend.
4. Scaffold `backend-java/` with Spring Boot, Maven, security, health, OpenAPI, PostgreSQL, Redis, and test foundations.
5. Port endpoints incrementally in this order:
   - Health and authentication.
   - Projects, saved expressions, history, graph configurations, and sharing.
   - Cache status and audit logs.
   - Math endpoints.
   - WebSocket/live calculation workflows.
6. Point the frontend at the Java backend once contract tests pass.
7. Retire the Node backend after Java parity is reached.

## Consequences

- We should avoid large Node-specific unit test investment unless it protects current migration work.
- We should prioritize OpenAPI, contract tests, and Java service tests.
- Frontend work should depend on stable API contracts, not Node implementation details.
- The repository can temporarily contain both backends during migration.
