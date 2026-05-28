import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { readDb, writeDb, cloneDefaultDatabase } from './db.js';
import type { CalculationHistoryRecord, ProjectRecord, UserRecord } from './db.js';

export interface MathLabRepository {
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByEmailOrUsername(email: string, username: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUserPasswordHash(userId: string, passwordHash: string): Promise<void>;
  listProjectsByUser(userId: string): Promise<ProjectRecord[]>;
  createProject(project: ProjectRecord): Promise<ProjectRecord>;
  updateProject(userId: string, projectId: string, updates: Partial<Pick<ProjectRecord, 'name' | 'description' | 'sheets' | 'updatedAt'>>): Promise<ProjectRecord | null>;
  deleteProject(userId: string, projectId: string): Promise<boolean>;
  listHistoryByUser(userId: string): Promise<CalculationHistoryRecord[]>;
  createHistory(item: CalculationHistoryRecord): Promise<CalculationHistoryRecord>;
}

class JsonRepository implements MathLabRepository {
  private ensureSeeded() {
    const db = readDb();
    if (!db.users || !db.projects || !db.calculationHistory) {
      writeDb(cloneDefaultDatabase());
    }
  }

  async findUserById(id: string) {
    this.ensureSeeded();
    return readDb().users.find(user => user.id === id) || null;
  }

  async findUserByEmail(email: string) {
    this.ensureSeeded();
    return readDb().users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserByEmailOrUsername(email: string, username: string) {
    this.ensureSeeded();
    return readDb().users.find(user =>
      user.email.toLowerCase() === email.toLowerCase() ||
      user.username.toLowerCase() === username.toLowerCase()
    ) || null;
  }

  async createUser(user: UserRecord) {
    const db = readDb();
    db.users.push(user);
    writeDb(db);
  }

  async updateUserPasswordHash(userId: string, passwordHash: string) {
    const db = readDb();
    const user = db.users.find(candidate => candidate.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
      writeDb(db);
    }
  }

  async listProjectsByUser(userId: string) {
    this.ensureSeeded();
    return readDb().projects.filter(project => project.userId === userId);
  }

  async createProject(project: ProjectRecord) {
    const db = readDb();
    db.projects.push(project);
    writeDb(db);
    return project;
  }

  async updateProject(userId: string, projectId: string, updates: Partial<Pick<ProjectRecord, 'name' | 'description' | 'sheets' | 'updatedAt'>>) {
    const db = readDb();
    const idx = db.projects.findIndex(project => project.id === projectId && project.userId === userId);
    if (idx === -1) return null;

    db.projects[idx] = {
      ...db.projects[idx],
      name: updates.name !== undefined ? updates.name : db.projects[idx].name,
      description: updates.description !== undefined ? updates.description : db.projects[idx].description,
      sheets: updates.sheets !== undefined ? updates.sheets : db.projects[idx].sheets,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    writeDb(db);
    return db.projects[idx];
  }

  async deleteProject(userId: string, projectId: string) {
    const db = readDb();
    const before = db.projects.length;
    db.projects = db.projects.filter(project => !(project.id === projectId && project.userId === userId));
    if (db.projects.length === before) return false;
    writeDb(db);
    return true;
  }

  async listHistoryByUser(userId: string) {
    this.ensureSeeded();
    return readDb()
      .calculationHistory
      .filter(item => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createHistory(item: CalculationHistoryRecord) {
    const db = readDb();
    db.calculationHistory.push(item);
    writeDb(db);
    return item;
  }
}

class PostgresRepository implements MathLabRepository {
  private pool: Pool;
  private initialized: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async ensureSchema() {
    if (!this.initialized) {
      const migrationPath = path.join(process.cwd(), 'database', 'migrations', '001_initial_schema.sql');
      this.initialized = fs.promises
        .readFile(migrationPath, 'utf-8')
        .then(sql => this.pool.query(sql).then(() => undefined));
    }
    return this.initialized;
  }

  private mapUser(row: any): UserRecord {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  private async projectRows(userId: string, projectId?: string) {
    await this.ensureSchema();
    const projectResult = await this.pool.query(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM projects
        WHERE user_id = $1
          AND ($2::text IS NULL OR id = $2)
        ORDER BY updated_at DESC, created_at DESC
      `,
      [userId, projectId || null]
    );

    const projectIds = projectResult.rows.map(row => row.id);
    if (projectIds.length === 0) return [];

    const sheetResult = await this.pool.query(
      `
        SELECT id, project_id, name, cells
        FROM project_sheets
        WHERE project_id = ANY($1::text[])
        ORDER BY created_at ASC
      `,
      [projectIds]
    );

    const sheetsByProject = new Map<string, ProjectRecord['sheets']>();
    for (const sheet of sheetResult.rows) {
      const collection = sheetsByProject.get(sheet.project_id) || [];
      collection.push({
        id: sheet.id,
        name: sheet.name,
        cells: sheet.cells || {}
      });
      sheetsByProject.set(sheet.project_id, collection);
    }

    return projectResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      sheets: sheetsByProject.get(row.id) || [],
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }

  async findUserById(id: string) {
    await this.ensureSchema();
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async findUserByEmail(email: string) {
    await this.ensureSchema();
    const result = await this.pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async findUserByEmailOrUsername(email: string, username: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      'SELECT * FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($2)',
      [email, username]
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async createUser(user: UserRecord) {
    await this.ensureSchema();
    await this.pool.query(
      `
        INSERT INTO users (id, username, email, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [user.id, user.username, user.email, user.passwordHash, user.createdAt]
    );
  }

  async updateUserPasswordHash(userId: string, passwordHash: string) {
    await this.ensureSchema();
    await this.pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
  }

  async listProjectsByUser(userId: string) {
    return this.projectRows(userId);
  }

  async createProject(project: ProjectRecord) {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [project.id, project.userId, project.name, project.description, project.createdAt, project.updatedAt]
      );
      await this.replaceSheets(client, project);
      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProject(userId: string, projectId: string, updates: Partial<Pick<ProjectRecord, 'name' | 'description' | 'sheets' | 'updatedAt'>>) {
    await this.ensureSchema();
    const existing = (await this.projectRows(userId, projectId))[0];
    if (!existing) return null;

    const nextProject: ProjectRecord = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      description: updates.description !== undefined ? updates.description : existing.description,
      sheets: updates.sheets !== undefined ? updates.sheets : existing.sheets,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          UPDATE projects
          SET name = $3, description = $4, updated_at = $5
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId, nextProject.name, nextProject.description, nextProject.updatedAt]
      );
      if (updates.sheets !== undefined) {
        await client.query('DELETE FROM project_sheets WHERE project_id = $1', [projectId]);
        await this.replaceSheets(client, nextProject);
      }
      await client.query('COMMIT');
      return nextProject;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProject(userId: string, projectId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    return (result.rowCount || 0) > 0;
  }

  async listHistoryByUser(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        SELECT id, user_id, type, input, output, latex_input, latex_output, steps, explanation, created_at
        FROM calculation_history
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id || undefined,
      type: row.type,
      input: row.input,
      output: row.output,
      latexInput: row.latex_input || undefined,
      latexOutput: row.latex_output || undefined,
      steps: row.steps || [],
      explanation: row.explanation || '',
      createdAt: new Date(row.created_at).toISOString()
    }));
  }

  async createHistory(item: CalculationHistoryRecord) {
    await this.ensureSchema();
    await this.pool.query(
      `
        INSERT INTO calculation_history (id, user_id, type, input, output, latex_input, latex_output, steps, explanation, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
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
        item.createdAt
      ]
    );
    return item;
  }

  private async replaceSheets(client: PoolClient, project: ProjectRecord) {
    for (const sheet of project.sheets) {
      await client.query(
        `
          INSERT INTO project_sheets (id, project_id, name, cells, created_at, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        `,
        [
          sheet.id,
          project.id,
          sheet.name,
          JSON.stringify(sheet.cells || {}),
          project.createdAt,
          project.updatedAt
        ]
      );
    }
  }
}

export function createRepository(): MathLabRepository {
  if (process.env.DATABASE_URL) {
    return new PostgresRepository(process.env.DATABASE_URL);
  }
  return new JsonRepository();
}
