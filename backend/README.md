# MathLab Pro Backend

This is the Spring Boot production backend for MathLab Pro. It runs alongside the current TypeScript API until it reaches OpenAPI contract parity.

## Stack

- Java 21
- Spring Boot 3.5.x
- Maven
- Spring Security with JWT bearer tokens
- PostgreSQL with Flyway migrations
- Redis configuration for calculation caching
- Spring WebSocket foundation
- Springdoc OpenAPI UI
- Apache Commons Math and EJML for deterministic math operations
- JUnit/MockMvc tests

## Local Commands

Copy the environment template if you want a local reference file:

```bash
cp .env.example .env
```

Maven does not automatically load `.env`; export those values in your shell or provide them through your runtime environment when needed.

```bash
mvn test
mvn spring-boot:run
```

The default runtime profile expects PostgreSQL. Tests use H2 with JPA schema generation so they do not require local infrastructure.

## Implemented

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/cache/status`
- `GET|POST /api/history`
- `/api/saved-expressions`
- `/api/projects`
- `/api/graph-configurations`
- `/api/shared-workspaces`
- `GET /api/audit-logs`
- `/api/math/polynomial`, `/api/math/algebra`, `/api/math/matrix`, `/api/math/numerical`, `/api/math/calculus`, `/api/math/statistics`, and `/api/math/ai-explain`
- Global validation/error responses
- JWT issuance and resource server verification
- Authenticated math audit logging
- Canonical calculation cache headers for deterministic math endpoints

The root contract remains `../docs/openapi.yaml`. To run the portable contract suite against a running Spring backend:

```bash
MATHLAB_API_BASE_URL=http://localhost:8080 npm run test:contract
```

To start an isolated H2-backed Spring contract target and run the contract suite automatically from the repository root:

```bash
npm run test:contract:spring
```
