# MathLab Pro

[![CI](https://github.com/mohamed-kadi/mathlab-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/mohamed-kadi/mathlab-pro/actions/workflows/ci.yml)

MathLab Pro is a usable full-stack symbolic and numerical mathematics workspace today. The default runtime is a React 19 + TypeScript frontend served by the current TypeScript API, with math operations powered primarily by `mathjs` and optional AI-assisted tutoring.

Production readiness is still in progress. The Spring Boot backend in [backend](backend/README.md) is the production backend target and is being built to match the OpenAPI contract before it replaces the current API runtime.

Architecture direction and API contract:

- [Architecture Decision](docs/architecture-decision.md)
- [OpenAPI Contract](docs/openapi.yaml)
- [Math Engine Specification](docs/math-engine-spec.md)
- [Production Readiness Checklist](docs/production-readiness.md)

## Current Capabilities

- Polynomial operations: simplification, differentiation, exact univariate integration, multiplication, long division, factorization, and roots up to quadratic degree.
- Symbolic algebra: simplification, polynomial expansion/factorization, and guarded variable substitution.
- Matrix calculator: addition, multiplication, determinant, inverse, LU/LUP, QR, eigen approximation, and linear solve.
- Numerical methods: Newton-Raphson, bisection, Simpson integration, and polynomial curve fitting.
- Calculus tools: numerical limits, Taylor series, and RK4 ODE integration.
- Statistics: descriptive statistics and confidence interval calculation.
- Workspace persistence: saved expressions, projects, graph configurations, shared workspaces, audit history, cache status, and spreadsheet-style cells.
- Graphing: canvas-based 2D plotting with pan/zoom and traced coordinates.
- Calculation caching: repeated math API calls use an in-process cache locally or Redis when `REDIS_URL` is configured.
- Audit logging: successful auth, workspace, and authenticated calculation actions are recorded for the current user.
- Math safety: expression length, parse complexity, allowed symbols/functions, finite numeric inputs, and matrix dimensions are validated server-side.
- AI tutoring: provider-backed explanations when `AI_PROVIDER_API_KEY` is configured, with offline fallback text otherwise.

## Requirements

- Node.js `>=20.19.0`
- npm `>=10.0.0`
- Java 21 and Maven 3.9+ for the Spring Boot backend in `backend/`

Use the pinned local version with:

```bash
nvm use
```

## Environment

Create a local env file for the current TypeScript API from the example:

```bash
cp .env.example .env.local
```

Useful variables:

- `NODE_ENV`: `development` or `production`
- `PORT`: server port, defaults to `3000`
- `HOST`: bind host, defaults to `0.0.0.0`
- `JWT_SECRET`: long random secret used to sign access tokens
- `JWT_EXPIRES_IN`: token lifetime, defaults to `7d`
- `REDIS_URL`: optional Redis endpoint for calculation caching
- `CALCULATION_CACHE_TTL_SECONDS`: cache lifetime for repeated calculation responses, defaults to `900`
- `AI_PROVIDER_BASE_URL`: optional OpenAI-compatible chat completions endpoint for AI tutoring
- `AI_PROVIDER_API_KEY`: optional key for AI tutoring
- `AI_PROVIDER_MODEL`: optional model name for AI tutoring
- `APP_URL`: deployed application URL

The Spring Boot backend has its own example file:

```bash
cp backend/.env.example backend/.env
```

Use `backend/.env.example` as the source for shell, Docker, or deployment variables. Maven does not automatically load `backend/.env` unless your shell or runtime environment exports those values.

The seeded local demo account is `guest@mathlab.edu` with password `mathlab-demo-password`.

## Development

```bash
npm install
npm run dev
```

The dev server runs the Express API and Vite middleware together.

## Tests

```bash
npm test
```

The default test script runs spreadsheet formula unit coverage, deterministic math-engine golden cases, and portable API contract coverage for auth, authorization, project isolation, history persistence, math APIs, cache behavior, audit logging, and AI explanation fallbacks. Without extra configuration, contract tests start the current TypeScript API against an isolated temporary JSON database.

To run the same API contract suite against another backend, such as the Spring Boot service:

```bash
MATHLAB_API_BASE_URL=http://localhost:8080 npm run test:contract
```

## Continuous Integration

GitHub Actions runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `docker compose --profile tools config` on every push to `main` and every pull request.

## Backend Direction

MathLab Pro is moving contract-first toward a Java 21/Spring Boot production backend. The React frontend and API behavior should stay stable while the backend is built endpoint by endpoint. New backend work should use [docs/openapi.yaml](docs/openapi.yaml) as the source contract.

The Spring Boot backend is available under [backend](backend/README.md). It currently includes Spring Security JWT auth, PostgreSQL/Flyway schema, Redis cache configuration, health/cache endpoints, deterministic math endpoints, OpenAPI UI wiring, and MockMvc tests. Run it independently with:

```bash
cd backend
mvn test
mvn spring-boot:run
```

## Build And Run

```bash
npm run lint
npm test
npm run build
npm start
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Docker Compose

```bash
docker compose up --build
```

Compose starts the app on `http://localhost:3000` plus PostgreSQL and Redis services for the persistence and caching roadmap. By default, the app container uses the JSON-backed store at `MATHLAB_DB_FILE` so the demo account works immediately. Set `DATABASE_URL` to switch the runtime repository layer to PostgreSQL.

## Data Storage

The current TypeScript API stores local data in `data/db.json`, which is generated at runtime and ignored by Git. This remains the local fallback for development. When `DATABASE_URL` is set, the server uses PostgreSQL repositories instead. PostgreSQL schema and JSON migration tooling are available in [docs/postgres-migration.md](docs/postgres-migration.md).

```bash
docker compose up -d postgres
DATABASE_URL="postgres://mathlab:mathlab_dev_password@localhost:5432/mathlab_pro" npm run db:migrate:json
```

## Workspace APIs

Authenticated workspace resources are available under `/api/saved-expressions`, `/api/projects`, `/api/graph-configurations`, and `/api/shared-workspaces`. Use `Authorization: Bearer <token>` from `/api/auth/login` or `/api/auth/register`. Operational endpoints for authenticated users are available at `/api/audit-logs` and `/api/cache/status`.

## Git Workflow

After the initial repository setup, add your remote and push:

```bash
git remote add origin <your-repository-url>
git push -u origin main
```

## Roadmap

1. Stabilize runtime scripts, docs, Node version, build warnings, and smoke checks.
2. Expand security hardening with CSRF strategy, audit logging, and production secret management.
3. Maintain portable API contract tests that can run against either backend.
4. Continue hardening the Java 21/Spring Boot backend under `backend/`.
5. Port remaining APIs incrementally against the OpenAPI contract.
6. Add richer frontend editing for saved graph viewport presets and shared workspace permissions.
7. Switch the default runtime to Spring Boot after backend contract parity.
