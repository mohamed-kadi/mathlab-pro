# PostgreSQL Migration Path

MathLab Pro currently runs against a JSON database file for local prototype speed. This directory adds the PostgreSQL schema and migration utility that will be used when the runtime repository layer is switched to PostgreSQL.

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

## Schema Notes

- `users` stores account identity and password hashes.
- `saved_expressions`, `projects`, `project_sheets`, `calculation_history`, `graph_configurations`, and `shared_workspaces` model the original prompt's persistence requirements.
- Project sheets store cells as `JSONB` for now because spreadsheet shape is still fluid.
- IDs remain text to preserve existing JSON IDs during migration.

## Next Backend Step

Replace direct `readDb()` / `writeDb()` usage with a repository interface and add a PostgreSQL implementation behind `DATABASE_URL`. Keep the JSON implementation as a local fallback until the PostgreSQL path has equivalent API coverage.
