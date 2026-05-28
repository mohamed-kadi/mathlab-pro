# PostgreSQL Migration Path

MathLab Pro can run against a JSON database file for local prototype speed or PostgreSQL when `DATABASE_URL` is configured. This directory documents the PostgreSQL schema and JSON import utility.

## Start PostgreSQL

```bash
docker compose up -d postgres
```

The Postgres container automatically runs `database/migrations/001_initial_schema.sql` the first time its volume is created.

## Export The JSON Database Into PostgreSQL

With Docker Compose:

```bash
docker compose --profile tools run --rm migrate-json
```

From the host:

```bash
DATABASE_URL="postgres://mathlab:mathlab_dev_password@localhost:5432/mathlab_pro" \
MATHLAB_DB_FILE="./data/db.json" \
npm run db:migrate:json
```

Set `MIGRATION_TRUNCATE=true` to clear existing rows before importing:

```bash
MIGRATION_TRUNCATE=true npm run db:migrate:json
```

## Run The App Against PostgreSQL

After importing data, set `DATABASE_URL` for the server:

```bash
DATABASE_URL="postgres://mathlab:mathlab_dev_password@localhost:5432/mathlab_pro" npm run dev
```

With Docker Compose, add `DATABASE_URL` to the `app` service environment or provide it through an `.env` file:

```bash
DATABASE_URL="postgres://mathlab:mathlab_dev_password@postgres:5432/mathlab_pro" docker compose up --build
```

## Schema Notes

- `users` stores account identity and password hashes.
- `saved_expressions`, `projects`, `project_sheets`, `calculation_history`, `graph_configurations`, and `shared_workspaces` model the original prompt's persistence requirements.
- Project sheets store cells as `JSONB` for now because spreadsheet shape is still fluid.
- IDs remain text to preserve existing JSON IDs during migration.

## Current Runtime Coverage

The repository layer and REST API support users, saved expressions, projects, project sheets, calculation history, graph configurations, and shared workspaces for both JSON and PostgreSQL.

## Next Backend Step

Add Redis-backed calculation caching, audit logging, and focused math-module tests.
