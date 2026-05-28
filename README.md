# MathLab Pro

MathLab Pro is an interactive symbolic and numerical mathematics workspace. The current implementation is a React 19 + TypeScript frontend served by an Express API, with math operations powered primarily by `mathjs` and optional Gemini-assisted tutoring.

This repository is not yet the full Java/Spring Boot/PostgreSQL architecture from the original product prompt. It is the existing working prototype that will be hardened incrementally.

## Current Capabilities

- Polynomial operations: simplification, differentiation, heuristic integration, multiplication, division rendering, and approximate roots.
- Symbolic algebra: simplification, expansion-style simplification, substitution, and placeholder factorization.
- Matrix calculator: addition, multiplication, determinant, inverse, LU/LUP, QR, eigen approximation, and linear solve.
- Numerical methods: Newton-Raphson, bisection, Simpson integration, and polynomial curve fitting.
- Calculus tools: numerical limits, Taylor series, and RK4 ODE integration.
- Statistics: descriptive statistics and confidence interval calculation.
- Workspace projects: local JSON-backed projects and spreadsheet-style cells.
- Graphing: canvas-based 2D plotting with pan/zoom and traced coordinates.
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
- `GEMINI_API_KEY`: optional key for AI tutoring
- `APP_URL`: deployed application URL

The seeded local demo account is `guest@mathlab.edu` with password `mathlab-demo-password`.

## Development

```bash
npm install
npm run dev
```

The dev server runs the Express API and Vite middleware together.

## Build And Run

```bash
npm run lint
npm run build
npm start
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Data Storage

The prototype stores data in `data/db.json`, which is generated at runtime and ignored by Git. This is suitable for local demos only. Production persistence should move to PostgreSQL with migrations and ownership-aware queries.

## Git Workflow

After the initial repository setup, add your remote and push:

```bash
git remote add origin <your-repository-url>
git push -u origin main
```

## Roadmap

1. Stabilize runtime scripts, docs, Node version, build warnings, and smoke checks.
2. Expand security hardening with CSRF strategy, audit logging, and production secret management.
3. Move from JSON storage to PostgreSQL migrations and repositories.
4. Add focused unit and API tests for each math module.
5. Replace placeholder CAS behavior with robust symbolic operations or a dedicated CAS service.
6. Add Redis caching, rate limiting, audit logging, API docs, and Docker Compose.
7. Evaluate whether to keep the Node backend or rebuild the backend in Java 21/Spring Boot to match the original prompt exactly.
