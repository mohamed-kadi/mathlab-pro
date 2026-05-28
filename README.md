# MathLab Pro

[![CI](https://github.com/mohamed-kadi/mathlab-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/mohamed-kadi/mathlab-pro/actions/workflows/ci.yml)

MathLab Pro is an interactive symbolic and numerical mathematics workspace. The current implementation is a React 19 + TypeScript frontend served by an Express API, with math operations powered primarily by `mathjs` and optional Gemini-assisted tutoring.

This repository is not yet the full Java/Spring Boot/PostgreSQL architecture from the original product prompt. It is the existing working prototype that will be hardened incrementally.

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
- AI tutoring: Gemini-backed explanations when `GEMINI_API_KEY` is configured, with offline fallback text otherwise.

## Requirements

- Node.js `>=20.19.0`
- npm `>=10.0.0`

Use the pinned local version with:

```bash
nvm use
```

## Environment

Create a local env file from the example:

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
- `GEMINI_API_KEY`: optional key for AI tutoring
- `APP_URL`: deployed application URL

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

The current test script runs smoke/integration coverage for auth, authorization, project isolation, history persistence, math APIs, and spreadsheet formula safety against an isolated temporary JSON database.

## Continuous Integration

GitHub Actions runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `docker compose --profile tools config` on every push to `main` and every pull request.

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

The prototype stores data in `data/db.json`, which is generated at runtime and ignored by Git. This remains the local fallback. When `DATABASE_URL` is set, the server uses PostgreSQL repositories instead. PostgreSQL schema and JSON migration tooling are available in [docs/postgres-migration.md](docs/postgres-migration.md).

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
3. Add focused unit tests for each math module beyond the API smoke suite.
4. Expand CAS coverage beyond quadratic univariate polynomials or add a dedicated CAS service.
5. Add OpenAPI documentation and deployment automation.
6. Add richer frontend editing for saved graph viewport presets and shared workspace permissions.
7. Evaluate whether to keep the Node backend or rebuild the backend in Java 21/Spring Boot to match the original prompt exactly.
