import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { readDb, writeDb, cloneDefaultDatabase } from './db.js';
import type {
  CalculationHistoryRecord,
  GraphConfigurationRecord,
  ProjectRecord,
  SavedExpressionRecord,
  SharedWorkspaceRecord,
  UserRecord
} from './db.js';

export interface MathLabRepository {
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByEmailOrUsername(email: string, username: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUserPasswordHash(userId: string, passwordHash: string): Promise<void>;
  listSavedExpressionsByUser(userId: string): Promise<SavedExpressionRecord[]>;
  createSavedExpression(expression: SavedExpressionRecord): Promise<SavedExpressionRecord>;
  updateSavedExpression(userId: string, expressionId: string, updates: Partial<Pick<SavedExpressionRecord, 'name' | 'rawExpression' | 'latexExpression'>>): Promise<SavedExpressionRecord | null>;
  deleteSavedExpression(userId: string, expressionId: string): Promise<boolean>;
  listProjectsByUser(userId: string): Promise<ProjectRecord[]>;
  findProjectByUser(userId: string, projectId: string): Promise<ProjectRecord | null>;
  createProject(project: ProjectRecord): Promise<ProjectRecord>;
  updateProject(userId: string, projectId: string, updates: Partial<Pick<ProjectRecord, 'name' | 'description' | 'sheets' | 'updatedAt'>>): Promise<ProjectRecord | null>;
  deleteProject(userId: string, projectId: string): Promise<boolean>;
  listHistoryByUser(userId: string): Promise<CalculationHistoryRecord[]>;
  createHistory(item: CalculationHistoryRecord): Promise<CalculationHistoryRecord>;
  listGraphConfigurationsByUser(userId: string): Promise<GraphConfigurationRecord[]>;
  createGraphConfiguration(config: GraphConfigurationRecord): Promise<GraphConfigurationRecord>;
  updateGraphConfiguration(userId: string, graphId: string, updates: Partial<Pick<GraphConfigurationRecord, 'name' | 'projectId' | 'config' | 'updatedAt'>>): Promise<GraphConfigurationRecord | null>;
  deleteGraphConfiguration(userId: string, graphId: string): Promise<boolean>;
  listSharedWorkspacesForOwner(userId: string): Promise<SharedWorkspaceRecord[]>;
  listSharedWorkspacesForRecipient(userId: string): Promise<SharedWorkspaceRecord[]>;
  upsertSharedWorkspace(share: SharedWorkspaceRecord): Promise<SharedWorkspaceRecord>;
  updateSharedWorkspaceRole(ownerUserId: string, shareId: string, role: SharedWorkspaceRecord['role']): Promise<SharedWorkspaceRecord | null>;
  deleteSharedWorkspace(ownerUserId: string, shareId: string): Promise<boolean>;
}

class JsonRepository implements MathLabRepository {
  private ensureSeeded() {
    const db = readDb();
    const defaults = cloneDefaultDatabase();
    const mutableDb = db as unknown as Record<string, unknown>;
    let changed = false;
    for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
      if (!Array.isArray(db[key])) {
        mutableDb[key] = defaults[key];
        changed = true;
      }
    }
    if (changed) {
      writeDb(db);
    }
  }

  private decorateShare(share: SharedWorkspaceRecord): SharedWorkspaceRecord {
    const db = readDb();
    const project = db.projects.find(candidate => candidate.id === share.projectId);
    const owner = db.users.find(candidate => candidate.id === share.ownerUserId);
    const recipient = db.users.find(candidate => candidate.id === share.sharedWithUserId);
    return {
      ...share,
      projectName: project?.name,
      ownerEmail: owner?.email,
      ownerUsername: owner?.username,
      sharedWithEmail: recipient?.email,
      sharedWithUsername: recipient?.username
    };
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

  async listSavedExpressionsByUser(userId: string) {
    this.ensureSeeded();
    return readDb()
      .savedExpressions
      .filter(expression => expression.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSavedExpression(expression: SavedExpressionRecord) {
    const db = readDb();
    db.savedExpressions.push(expression);
    writeDb(db);
    return expression;
  }

  async updateSavedExpression(userId: string, expressionId: string, updates: Partial<Pick<SavedExpressionRecord, 'name' | 'rawExpression' | 'latexExpression'>>) {
    const db = readDb();
    const idx = db.savedExpressions.findIndex(expression => expression.id === expressionId && expression.userId === userId);
    if (idx === -1) return null;

    db.savedExpressions[idx] = {
      ...db.savedExpressions[idx],
      name: updates.name !== undefined ? updates.name : db.savedExpressions[idx].name,
      rawExpression: updates.rawExpression !== undefined ? updates.rawExpression : db.savedExpressions[idx].rawExpression,
      latexExpression: updates.latexExpression !== undefined ? updates.latexExpression : db.savedExpressions[idx].latexExpression
    };
    writeDb(db);
    return db.savedExpressions[idx];
  }

  async deleteSavedExpression(userId: string, expressionId: string) {
    const db = readDb();
    const before = db.savedExpressions.length;
    db.savedExpressions = db.savedExpressions.filter(expression => !(expression.id === expressionId && expression.userId === userId));
    if (db.savedExpressions.length === before) return false;
    writeDb(db);
    return true;
  }

  async listProjectsByUser(userId: string) {
    this.ensureSeeded();
    return readDb().projects.filter(project => project.userId === userId);
  }

  async findProjectByUser(userId: string, projectId: string) {
    this.ensureSeeded();
    return readDb().projects.find(project => project.id === projectId && project.userId === userId) || null;
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

  async listGraphConfigurationsByUser(userId: string) {
    this.ensureSeeded();
    return readDb()
      .graphConfigurations
      .filter(config => config.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createGraphConfiguration(config: GraphConfigurationRecord) {
    const db = readDb();
    db.graphConfigurations.push(config);
    writeDb(db);
    return config;
  }

  async updateGraphConfiguration(userId: string, graphId: string, updates: Partial<Pick<GraphConfigurationRecord, 'name' | 'projectId' | 'config' | 'updatedAt'>>) {
    const db = readDb();
    const idx = db.graphConfigurations.findIndex(config => config.id === graphId && config.userId === userId);
    if (idx === -1) return null;

    db.graphConfigurations[idx] = {
      ...db.graphConfigurations[idx],
      name: updates.name !== undefined ? updates.name : db.graphConfigurations[idx].name,
      projectId: updates.projectId !== undefined ? updates.projectId : db.graphConfigurations[idx].projectId,
      config: updates.config !== undefined ? updates.config : db.graphConfigurations[idx].config,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    writeDb(db);
    return db.graphConfigurations[idx];
  }

  async deleteGraphConfiguration(userId: string, graphId: string) {
    const db = readDb();
    const before = db.graphConfigurations.length;
    db.graphConfigurations = db.graphConfigurations.filter(config => !(config.id === graphId && config.userId === userId));
    if (db.graphConfigurations.length === before) return false;
    writeDb(db);
    return true;
  }

  async listSharedWorkspacesForOwner(userId: string) {
    this.ensureSeeded();
    return readDb()
      .sharedWorkspaces
      .filter(share => share.ownerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(share => this.decorateShare(share));
  }

  async listSharedWorkspacesForRecipient(userId: string) {
    this.ensureSeeded();
    return readDb()
      .sharedWorkspaces
      .filter(share => share.sharedWithUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(share => this.decorateShare(share));
  }

  async upsertSharedWorkspace(share: SharedWorkspaceRecord) {
    const db = readDb();
    const idx = db.sharedWorkspaces.findIndex(candidate =>
      candidate.projectId === share.projectId && candidate.sharedWithUserId === share.sharedWithUserId
    );
    if (idx === -1) {
      db.sharedWorkspaces.push(share);
      writeDb(db);
      return this.decorateShare(share);
    }

    db.sharedWorkspaces[idx] = {
      ...db.sharedWorkspaces[idx],
      role: share.role
    };
    writeDb(db);
    return this.decorateShare(db.sharedWorkspaces[idx]);
  }

  async updateSharedWorkspaceRole(ownerUserId: string, shareId: string, role: SharedWorkspaceRecord['role']) {
    const db = readDb();
    const idx = db.sharedWorkspaces.findIndex(share => share.id === shareId && share.ownerUserId === ownerUserId);
    if (idx === -1) return null;

    db.sharedWorkspaces[idx] = {
      ...db.sharedWorkspaces[idx],
      role
    };
    writeDb(db);
    return this.decorateShare(db.sharedWorkspaces[idx]);
  }

  async deleteSharedWorkspace(ownerUserId: string, shareId: string) {
    const db = readDb();
    const before = db.sharedWorkspaces.length;
    db.sharedWorkspaces = db.sharedWorkspaces.filter(share => !(share.id === shareId && share.ownerUserId === ownerUserId));
    if (db.sharedWorkspaces.length === before) return false;
    writeDb(db);
    return true;
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

  private mapSavedExpression(row: any): SavedExpressionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      rawExpression: row.raw_expression,
      latexExpression: row.latex_expression,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  private mapGraphConfiguration(row: any): GraphConfigurationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id || undefined,
      name: row.name,
      config: row.config || {},
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapSharedWorkspace(row: any): SharedWorkspaceRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      ownerUserId: row.owner_user_id,
      sharedWithUserId: row.shared_with_user_id,
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
      projectName: row.project_name || undefined,
      ownerEmail: row.owner_email || undefined,
      ownerUsername: row.owner_username || undefined,
      sharedWithEmail: row.shared_with_email || undefined,
      sharedWithUsername: row.shared_with_username || undefined
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

  async listSavedExpressionsByUser(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        SELECT id, user_id, name, raw_expression, latex_expression, created_at
        FROM saved_expressions
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    );
    return result.rows.map(row => this.mapSavedExpression(row));
  }

  async createSavedExpression(expression: SavedExpressionRecord) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        INSERT INTO saved_expressions (id, user_id, name, raw_expression, latex_expression, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, name, raw_expression, latex_expression, created_at
      `,
      [
        expression.id,
        expression.userId,
        expression.name,
        expression.rawExpression,
        expression.latexExpression,
        expression.createdAt
      ]
    );
    return this.mapSavedExpression(result.rows[0]);
  }

  async updateSavedExpression(userId: string, expressionId: string, updates: Partial<Pick<SavedExpressionRecord, 'name' | 'rawExpression' | 'latexExpression'>>) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        UPDATE saved_expressions
        SET
          name = COALESCE($3, name),
          raw_expression = COALESCE($4, raw_expression),
          latex_expression = COALESCE($5, latex_expression)
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, raw_expression, latex_expression, created_at
      `,
      [
        expressionId,
        userId,
        updates.name ?? null,
        updates.rawExpression ?? null,
        updates.latexExpression ?? null
      ]
    );
    return result.rows[0] ? this.mapSavedExpression(result.rows[0]) : null;
  }

  async deleteSavedExpression(userId: string, expressionId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('DELETE FROM saved_expressions WHERE id = $1 AND user_id = $2', [expressionId, userId]);
    return (result.rowCount || 0) > 0;
  }

  async listProjectsByUser(userId: string) {
    return this.projectRows(userId);
  }

  async findProjectByUser(userId: string, projectId: string) {
    return (await this.projectRows(userId, projectId))[0] || null;
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

  async listGraphConfigurationsByUser(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        SELECT id, user_id, project_id, name, config, created_at, updated_at
        FROM graph_configurations
        WHERE user_id = $1
        ORDER BY updated_at DESC, created_at DESC
      `,
      [userId]
    );
    return result.rows.map(row => this.mapGraphConfiguration(row));
  }

  async createGraphConfiguration(config: GraphConfigurationRecord) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        INSERT INTO graph_configurations (id, user_id, project_id, name, config, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        RETURNING id, user_id, project_id, name, config, created_at, updated_at
      `,
      [
        config.id,
        config.userId,
        config.projectId || null,
        config.name,
        JSON.stringify(config.config || {}),
        config.createdAt,
        config.updatedAt
      ]
    );
    return this.mapGraphConfiguration(result.rows[0]);
  }

  async updateGraphConfiguration(userId: string, graphId: string, updates: Partial<Pick<GraphConfigurationRecord, 'name' | 'projectId' | 'config' | 'updatedAt'>>) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        UPDATE graph_configurations
        SET
          name = COALESCE($3, name),
          project_id = COALESCE($4, project_id),
          config = COALESCE($5::jsonb, config),
          updated_at = $6
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, project_id, name, config, created_at, updated_at
      `,
      [
        graphId,
        userId,
        updates.name ?? null,
        updates.projectId ?? null,
        updates.config !== undefined ? JSON.stringify(updates.config) : null,
        updates.updatedAt || new Date().toISOString()
      ]
    );
    return result.rows[0] ? this.mapGraphConfiguration(result.rows[0]) : null;
  }

  async deleteGraphConfiguration(userId: string, graphId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('DELETE FROM graph_configurations WHERE id = $1 AND user_id = $2', [graphId, userId]);
    return (result.rowCount || 0) > 0;
  }

  async listSharedWorkspacesForOwner(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        SELECT
          sw.id,
          sw.project_id,
          sw.owner_user_id,
          sw.shared_with_user_id,
          sw.role,
          sw.created_at,
          p.name AS project_name,
          owner.email AS owner_email,
          owner.username AS owner_username,
          recipient.email AS shared_with_email,
          recipient.username AS shared_with_username
        FROM shared_workspaces sw
        JOIN projects p ON p.id = sw.project_id
        JOIN users owner ON owner.id = sw.owner_user_id
        JOIN users recipient ON recipient.id = sw.shared_with_user_id
        WHERE sw.owner_user_id = $1
        ORDER BY sw.created_at DESC
      `,
      [userId]
    );
    return result.rows.map(row => this.mapSharedWorkspace(row));
  }

  async listSharedWorkspacesForRecipient(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        SELECT
          sw.id,
          sw.project_id,
          sw.owner_user_id,
          sw.shared_with_user_id,
          sw.role,
          sw.created_at,
          p.name AS project_name,
          owner.email AS owner_email,
          owner.username AS owner_username,
          recipient.email AS shared_with_email,
          recipient.username AS shared_with_username
        FROM shared_workspaces sw
        JOIN projects p ON p.id = sw.project_id
        JOIN users owner ON owner.id = sw.owner_user_id
        JOIN users recipient ON recipient.id = sw.shared_with_user_id
        WHERE sw.shared_with_user_id = $1
        ORDER BY sw.created_at DESC
      `,
      [userId]
    );
    return result.rows.map(row => this.mapSharedWorkspace(row));
  }

  async upsertSharedWorkspace(share: SharedWorkspaceRecord) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        INSERT INTO shared_workspaces (id, project_id, owner_user_id, shared_with_user_id, role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (project_id, shared_with_user_id) DO UPDATE SET
          role = EXCLUDED.role
        RETURNING id
      `,
      [
        share.id,
        share.projectId,
        share.ownerUserId,
        share.sharedWithUserId,
        share.role,
        share.createdAt
      ]
    );
    const [createdOrUpdated] = await this.listSharedWorkspacesForOwner(share.ownerUserId);
    return createdOrUpdated?.id === result.rows[0].id
      ? createdOrUpdated
      : (await this.listSharedWorkspacesForOwner(share.ownerUserId)).find(candidate => candidate.id === result.rows[0].id) || share;
  }

  async updateSharedWorkspaceRole(ownerUserId: string, shareId: string, role: SharedWorkspaceRecord['role']) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        UPDATE shared_workspaces
        SET role = $3
        WHERE id = $1 AND owner_user_id = $2
        RETURNING id
      `,
      [shareId, ownerUserId, role]
    );
    if (!result.rows[0]) return null;
    return (await this.listSharedWorkspacesForOwner(ownerUserId)).find(share => share.id === shareId) || null;
  }

  async deleteSharedWorkspace(ownerUserId: string, shareId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('DELETE FROM shared_workspaces WHERE id = $1 AND owner_user_id = $2', [shareId, ownerUserId]);
    return (result.rowCount || 0) > 0;
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
