# MathLab Pro Java Backend

This is the production backend scaffold for MathLab Pro. It runs alongside the current Node/Express prototype until it reaches OpenAPI contract parity.

## Stack

- Java 21
- Spring Boot 3.5.x
- Maven
- Spring Security with JWT bearer tokens
- PostgreSQL with Flyway migrations
- Redis configuration for calculation caching
- Spring WebSocket foundation
- Springdoc OpenAPI UI
- JUnit/MockMvc tests

## Local Commands

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
