import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';
import type { DatabaseSchema } from '../server/db.ts';

const databaseUrl = process.env.DATABASE_URL;
const dbFile = process.env.MATHLAB_DB_FILE
  ? path.resolve(process.env.MATHLAB_DB_FILE)
  : path.join(process.cwd(), 'data', 'db.json');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Example: postgres://mathlab:password@localhost:5432/mathlab_pro');
}

if (!fs.existsSync(dbFile)) {
  throw new Error(`JSON database file not found: ${dbFile}`);
}

const migrationFile = new URL('../database/migrations/001_initial_schema.sql', import.meta.url);
const schemaSql = fs.readFileSync(migrationFile, 'utf-8');
const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8')) as DatabaseSchema;

function timestamp(value?: string) {
  return value || new Date().toISOString();
}

function generatedId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

const client = new Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query('BEGIN');
  await client.query(schemaSql);

  if (process.env.MIGRATION_TRUNCATE === 'true') {
    await client.query(`
      TRUNCATE
        shared_workspaces,
        audit_logs,
        graph_configurations,
        calculation_history,
        project_sheets,
        projects,
        saved_expressions,
        users
      CASCADE
    `);
  }

  for (const user of db.users || []) {
    await client.query(
      `
        INSERT INTO users (id, username, email, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash
      `,
      [user.id, user.username, user.email, user.passwordHash, timestamp(user.createdAt)]
    );
  }

  for (const expression of db.savedExpressions || []) {
    await client.query(
      `
        INSERT INTO saved_expressions (id, user_id, name, raw_expression, latex_expression, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          raw_expression = EXCLUDED.raw_expression,
          latex_expression = EXCLUDED.latex_expression
      `,
      [
        expression.id,
        expression.userId,
        expression.name,
        expression.rawExpression,
        expression.latexExpression,
        timestamp(expression.createdAt)
      ]
    );
  }

  for (const project of db.projects || []) {
    await client.query(
      `
        INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at
      `,
      [
        project.id,
        project.userId,
        project.name,
        project.description,
        timestamp(project.createdAt),
        timestamp(project.updatedAt)
      ]
    );

    for (const sheet of project.sheets || []) {
      await client.query(
        `
          INSERT INTO project_sheets (id, project_id, name, cells, created_at, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            cells = EXCLUDED.cells,
            updated_at = EXCLUDED.updated_at
        `,
        [
          sheet.id,
          project.id,
          sheet.name,
          JSON.stringify(sheet.cells || {}),
          timestamp(project.createdAt),
          timestamp(project.updatedAt)
        ]
      );
    }
  }

  for (const item of db.calculationHistory || []) {
    await client.query(
      `
        INSERT INTO calculation_history (id, user_id, type, input, output, latex_input, latex_output, steps, explanation, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          input = EXCLUDED.input,
          output = EXCLUDED.output,
          latex_input = EXCLUDED.latex_input,
          latex_output = EXCLUDED.latex_output,
          steps = EXCLUDED.steps,
          explanation = EXCLUDED.explanation
      `,
      [
        item.id,
        item.userId || null,
        item.type,
        item.input,
        item.output,
        item.latexInput || null,
        item.latexOutput || null,
        JSON.stringify(item.steps || []),
        item.explanation || '',
        timestamp(item.createdAt)
      ]
    );
  }

  for (const graphConfig of db.graphConfigurations || []) {
    await client.query(
      `
        INSERT INTO graph_configurations (id, user_id, project_id, name, config, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          config = EXCLUDED.config,
          updated_at = EXCLUDED.updated_at
      `,
      [
        graphConfig.id || generatedId('graph'),
        graphConfig.userId,
        graphConfig.projectId || null,
        graphConfig.name || 'Untitled Graph',
        JSON.stringify(graphConfig.config || graphConfig),
        timestamp(graphConfig.createdAt),
        timestamp(graphConfig.updatedAt)
      ]
    );
  }

  for (const workspace of db.sharedWorkspaces || []) {
    await client.query(
      `
        INSERT INTO shared_workspaces (id, project_id, owner_user_id, shared_with_user_id, role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (project_id, shared_with_user_id) DO UPDATE SET
          role = EXCLUDED.role
      `,
      [
        workspace.id || generatedId('share'),
        workspace.projectId,
        workspace.ownerUserId,
        workspace.sharedWithUserId,
        workspace.role || 'viewer',
        timestamp(workspace.createdAt)
      ]
    );
  }

  for (const auditLog of db.auditLogs || []) {
    await client.query(
      `
        INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          action = EXCLUDED.action,
          resource = EXCLUDED.resource,
          resource_id = EXCLUDED.resource_id,
          metadata = EXCLUDED.metadata,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent
      `,
      [
        auditLog.id,
        auditLog.userId || null,
        auditLog.action,
        auditLog.resource,
        auditLog.resourceId || null,
        JSON.stringify(auditLog.metadata || {}),
        auditLog.ipAddress || null,
        auditLog.userAgent || null,
        timestamp(auditLog.createdAt)
      ]
    );
  }

  await client.query('COMMIT');

  console.log(`Migrated JSON database into PostgreSQL from ${dbFile}`);
  console.log(`Users: ${db.users?.length || 0}`);
  console.log(`Saved expressions: ${db.savedExpressions?.length || 0}`);
  console.log(`Projects: ${db.projects?.length || 0}`);
  console.log(`History items: ${db.calculationHistory?.length || 0}`);
  console.log(`Audit logs: ${db.auditLogs?.length || 0}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
