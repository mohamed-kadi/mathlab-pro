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

## Implemented First

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/cache/status`
- Global validation/error responses
- JWT issuance and resource server verification

The root contract remains `../docs/openapi.yaml`. The portable contract test suite in the repository root can target this backend once enough endpoints have been ported:

```bash
MATHLAB_API_BASE_URL=http://localhost:8080 npm run test:contract
```
