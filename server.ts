import express from "express";
import type { NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import crypto from "crypto";
import type { UserRecord } from "./server/db.js";
import { createRepository, type MathLabRepository } from "./server/repository.js";
import { auditMiddleware } from "./server/audit.js";
import { calculationCacheMiddleware, createCalculationCache } from "./server/cache.js";
import {
  MathValidationError,
  assertSafeExpression,
  calculateEigenvaluesAndVectors,
  dividePolynomialExpressions,
  expandPolynomialExpression,
  factorPolynomialExpression,
  findPolynomialRootsExpression,
  integratePolynomialExpression,
  multiplyPolynomialExpressions,
  normalizeVariableName,
  solveNewtonRaphson,
  solveBisection,
  numericalIntegration,
  evaluateNumericalLimit,
  computeTaylorSeries,
  solveRK4,
  computeStatistics,
  fitCurve
} from "./server/mathEngine.js";
import { generateMathExplanation } from "./server/gemini.js";
import { create, all } from 'mathjs';

const math = create(all);

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const DEMO_PASSWORD = "mathlab-demo-password";
const JWT_SECRET = process.env.JWT_SECRET || "mathlab-pro-local-dev-secret-change-me";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

type AuthUser = Pick<UserRecord, "id" | "username" | "email" | "createdAt">;

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

const registerSchema = z.object({
  username: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

const sheetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  cells: z.record(z.string(), z.string().max(500))
});

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  sheets: z.array(sheetSchema).max(20).optional()
});

const historySchema = z.object({
  type: z.enum(["polynomial", "algebra", "matrix", "numerical", "statistics", "calculus", "ai-explain"]),
  input: z.string().max(4000),
  output: z.string().max(8000),
  latexInput: z.string().max(8000).optional(),
  latexOutput: z.string().max(8000).optional(),
  steps: z.array(z.string().max(4000)).max(200).optional(),
  explanation: z.string().max(10000).optional()
});

const savedExpressionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rawExpression: z.string().trim().min(1).max(4000),
  latexExpression: z.string().trim().max(8000).optional()
});

const savedExpressionUpdateSchema = savedExpressionSchema.partial().refine(
  value => Object.keys(value).length > 0,
  { message: "At least one saved expression field is required." }
);

const graphConfigurationSchema = z.object({
  projectId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional()
});

const graphConfigurationUpdateSchema = graphConfigurationSchema.partial().refine(
  value => Object.keys(value).length > 0,
  { message: "At least one graph configuration field is required." }
);

const shareWorkspaceSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  sharedWithEmail: z.string().trim().email().max(254),
  role: z.enum(["viewer", "editor"]).default("viewer")
});

const shareRoleSchema = z.object({
  role: z.enum(["viewer", "editor"])
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function safeUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  };
}

function signToken(user: UserRecord) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

async function userFromToken(req: Request, repository: MathLabRepository): Promise<AuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = typeof payload === "object" && payload && typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    const user = await repository.findUserById(userId);
    return user ? safeUser(user) : null;
  } catch {
    return null;
  }
}

function requireAuth(repository: MathLabRepository) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = await userFromToken(req, repository);
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.authUser = user;
    return next();
  };
}

function optionalAuth(repository: MathLabRepository) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const user = await userFromToken(req, repository);
    if (user) {
      req.authUser = user;
    }
    return next();
  };
}

function validationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: "Invalid request body.",
    details: error.issues.map(issue => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
}

function mathError(res: Response, error: unknown) {
  return res.status(400).json({
    error: (error as Error).message
  });
}

function parseNumericMatrix(value: unknown, label: string, maxSize = 10) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxSize) {
    throw new MathValidationError(`${label} must have between 1 and ${maxSize} rows.`);
  }

  const width = Array.isArray(value[0]) ? value[0].length : 0;
  if (width === 0 || width > maxSize) {
    throw new MathValidationError(`${label} must have between 1 and ${maxSize} columns.`);
  }

  const matrix = value.map(row => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new MathValidationError(`${label} must be rectangular.`);
    }
    return row.map(cell => Number(cell));
  });

  if (matrix.some(row => row.some(cell => !Number.isFinite(cell)))) {
    throw new MathValidationError(`${label} must contain only finite numbers.`);
  }

  return matrix;
}

function parseNumericVector(value: unknown, expectedLength: number, label: string) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new MathValidationError(`${label} must contain exactly ${expectedLength} values.`);
  }
  const vector = value.map(cell => Number(cell));
  if (vector.some(cell => !Number.isFinite(cell))) {
    throw new MathValidationError(`${label} must contain only finite numbers.`);
  }
  return vector;
}

function assertSquareMatrix(matrix: number[][], label: string) {
  if (matrix.length !== matrix[0].length) {
    throw new MathValidationError(`${label} must be square for this operation.`);
  }
}

function isValidBcryptHash(hash: string) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

async function verifyPassword(user: UserRecord, password: string, repository: MathLabRepository) {
  if (isValidBcryptHash(user.passwordHash)) {
    return bcrypt.compare(password, user.passwordHash);
  }

  if (user.email === "guest@mathlab.edu" && password === DEMO_PASSWORD) {
    const passwordHash = await bcrypt.hash(password, 12);
    await repository.updateUserPasswordHash(user.id, passwordHash);
    return true;
  }

  return false;
}

export async function createApp() {
  const app = express();
  const repository = createRepository();
  const calculationCache = createCalculationCache();
  const authRequired = requireAuth(repository);

  // Middleware
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use("/api/", rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use("/api/auth/", rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use("/api", auditMiddleware(repository));
  app.use("/api/math", optionalAuth(repository));
  app.use("/api/math", calculationCacheMiddleware(calculationCache));

  app.get("/api/health", (_req, res) => {
    return res.json({
      status: "ok",
      service: "mathlab-pro",
      timestamp: new Date().toISOString()
    });
  });

  // --- Auth API ---

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { username, password } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const existing = await repository.findUserByEmailOrUsername(email, username);
    if (existing) {
      return res.status(400).json({ error: "User on this email or username already exists." });
    }

    const newUser = {
      id: "usr-" + crypto.randomUUID(),
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    };

    await repository.createUser(newUser);
    res.locals.auditUserId = newUser.id;

    return res.json({ token: signToken(newUser), user: safeUser(newUser) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const email = normalizeEmail(parsed.data.email);
    const { password } = parsed.data;

    const user = await repository.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or credentials" });
    }

    const passwordMatches = await verifyPassword(user, password, repository);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or credentials" });
    }

    res.locals.auditUserId = user.id;
    return res.json({ token: signToken(user), user: safeUser(user) });
  });

  app.get("/api/auth/me", authRequired, (req: AuthenticatedRequest, res) => {
    return res.json({ user: req.authUser });
  });

  app.get("/api/audit-logs", authRequired, async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 250);
    return res.json(await repository.listAuditLogsByUser(req.authUser!.id, limit));
  });

  app.get("/api/cache/status", authRequired, (_req, res) => {
    return res.json(calculationCache.status());
  });

  // --- Saved Expressions API ---

  app.get("/api/saved-expressions", authRequired, async (req: AuthenticatedRequest, res) => {
    return res.json(await repository.listSavedExpressionsByUser(req.authUser!.id));
  });

  app.post("/api/saved-expressions", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = savedExpressionSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { name, rawExpression, latexExpression } = parsed.data;
    const savedExpression = {
      id: "exp-" + crypto.randomUUID(),
      userId: req.authUser!.id,
      name,
      rawExpression,
      latexExpression: latexExpression || rawExpression,
      createdAt: new Date().toISOString()
    };

    return res.json(await repository.createSavedExpression(savedExpression));
  });

  app.put("/api/saved-expressions/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = savedExpressionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const updatedExpression = await repository.updateSavedExpression(req.authUser!.id, req.params.id, parsed.data);
    if (!updatedExpression) {
      return res.status(404).json({ error: "Saved expression not found" });
    }

    return res.json(updatedExpression);
  });

  app.delete("/api/saved-expressions/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const deleted = await repository.deleteSavedExpression(req.authUser!.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Saved expression not found" });
    }
    return res.json({ success: true });
  });

  // --- Projects Workspace API ---

  app.get("/api/projects", authRequired, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const userProjects = await repository.listProjectsByUser(userId);
    return res.json(userProjects);
  });

  app.post("/api/projects", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const userId = req.authUser!.id;
    const { name, description, sheets } = parsed.data;
    const newProject = {
      id: "proj-" + crypto.randomUUID(),
      userId,
      name: name || "Untitled Workspace Project",
      description: description || "No description provided.",
      sheets: sheets || [{ id: "sheet-" + crypto.randomUUID(), name: "Workspace 1", cells: {} }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return res.json(await repository.createProject(newProject));
  });

  app.put("/api/projects/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { id } = req.params;
    const { name, description, sheets } = parsed.data;

    const updatedProject = await repository.updateProject(req.authUser!.id, id, {
      name,
      description,
      sheets,
      updatedAt: new Date().toISOString()
    });
    if (!updatedProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json(updatedProject);
  });

  app.delete("/api/projects/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const deleted = await repository.deleteProject(req.authUser!.id, id);
    if (!deleted) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.json({ success: true });
  });

  // --- Graph Configurations API ---

  app.get("/api/graph-configurations", authRequired, async (req: AuthenticatedRequest, res) => {
    return res.json(await repository.listGraphConfigurationsByUser(req.authUser!.id));
  });

  app.post("/api/graph-configurations", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = graphConfigurationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const userId = req.authUser!.id;
    const { projectId, name, config } = parsed.data;
    if (projectId && !(await repository.findProjectByUser(userId, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const now = new Date().toISOString();
    const graphConfiguration = {
      id: "graph-" + crypto.randomUUID(),
      userId,
      ...(projectId ? { projectId } : {}),
      name: name || "Untitled Graph",
      config: config || {},
      createdAt: now,
      updatedAt: now
    };

    return res.json(await repository.createGraphConfiguration(graphConfiguration));
  });

  app.put("/api/graph-configurations/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = graphConfigurationUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const userId = req.authUser!.id;
    if (parsed.data.projectId && !(await repository.findProjectByUser(userId, parsed.data.projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updatedGraph = await repository.updateGraphConfiguration(userId, req.params.id, {
      ...parsed.data,
      updatedAt: new Date().toISOString()
    });
    if (!updatedGraph) {
      return res.status(404).json({ error: "Graph configuration not found" });
    }

    return res.json(updatedGraph);
  });

  app.delete("/api/graph-configurations/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const deleted = await repository.deleteGraphConfiguration(req.authUser!.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Graph configuration not found" });
    }
    return res.json({ success: true });
  });

  // --- Shared Workspaces API ---

  app.get("/api/shared-workspaces", authRequired, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const [outgoing, incoming] = await Promise.all([
      repository.listSharedWorkspacesForOwner(userId),
      repository.listSharedWorkspacesForRecipient(userId)
    ]);
    return res.json({ outgoing, incoming });
  });

  app.get("/api/shared-workspaces/outgoing", authRequired, async (req: AuthenticatedRequest, res) => {
    return res.json(await repository.listSharedWorkspacesForOwner(req.authUser!.id));
  });

  app.get("/api/shared-workspaces/incoming", authRequired, async (req: AuthenticatedRequest, res) => {
    return res.json(await repository.listSharedWorkspacesForRecipient(req.authUser!.id));
  });

  app.post("/api/shared-workspaces", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = shareWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const ownerUserId = req.authUser!.id;
    const { projectId, role } = parsed.data;
    const sharedWithEmail = normalizeEmail(parsed.data.sharedWithEmail);

    if (!(await repository.findProjectByUser(ownerUserId, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const recipient = await repository.findUserByEmail(sharedWithEmail);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    if (recipient.id === ownerUserId) {
      return res.status(400).json({ error: "You cannot share a workspace with yourself." });
    }

    const share = {
      id: "share-" + crypto.randomUUID(),
      projectId,
      ownerUserId,
      sharedWithUserId: recipient.id,
      role,
      createdAt: new Date().toISOString()
    };

    return res.json(await repository.upsertSharedWorkspace(share));
  });

  app.put("/api/shared-workspaces/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const parsed = shareRoleSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const updatedShare = await repository.updateSharedWorkspaceRole(req.authUser!.id, req.params.id, parsed.data.role);
    if (!updatedShare) {
      return res.status(404).json({ error: "Shared workspace not found" });
    }

    return res.json(updatedShare);
  });

  app.delete("/api/shared-workspaces/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    const deleted = await repository.deleteSharedWorkspace(req.authUser!.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Shared workspace not found" });
    }
    return res.json({ success: true });
  });

  // --- Calculations History API ---

  app.get("/api/history", async (req, res) => {
    const token = extractBearerToken(req);
    const user = await userFromToken(req, repository);
    if (token && !user) return res.status(401).json({ error: "Invalid or expired token." });
    if (!user) return res.json([]);

    return res.json(await repository.listHistoryByUser(user.id));
  });

  app.post("/api/history", async (req, res) => {
    const parsed = historySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const token = extractBearerToken(req);
    const user = await userFromToken(req, repository);
    if (token && !user) return res.status(401).json({ error: "Invalid or expired token." });

    const { type, input, output, latexInput, latexOutput, steps, explanation } = parsed.data;
    const newItem = {
      id: "hist-" + crypto.randomUUID(),
      ...(user ? { userId: user.id } : {}),
      type,
      input,
      output,
      latexInput: latexInput || input,
      latexOutput: latexOutput || output,
      steps: steps || [],
      explanation: explanation || "",
      createdAt: new Date().toISOString()
    };

    if (user) {
      await repository.createHistory(newItem);
    }
    return res.json(newItem);
  });

  // --- Computational Math Engine APIs ---

  // 1. Polynomial Suite Router
  app.post("/api/math/polynomial", (req, res) => {
    const { operation, operand2 } = req.body;

    try {
      const variable = normalizeVariableName(req.body.variable || 'x');
      const expression = assertSafeExpression(req.body.expression, { variables: [variable] });
      let output = "";
      let latexOutput = "";
      let steps: string[] = [];

      switch (operation) {
        case "simplify": {
          const simplified = math.simplify(expression);
          output = simplified.toString();
          latexOutput = simplified.toTex();
          steps = [`1. Parse individual variable terms of: ${expression}`, `2. Aggregate equivalent exponents.`, `3. Final simplified layout: ${output}`];
          break;
        }
        case "derivative": {
          const derived = math.derivative(expression, variable);
          output = derived.toString();
          latexOutput = `\\frac{d}{d${variable}}\\left[${math.parse(expression).toTex()}\\right] = ${derived.toTex()}`;
          steps = [
            `1. Target function: f(${variable}) = ${expression}`,
            `2. Apply derivative operators term-by-term.`,
            `3. Evaluated result: f'(${variable}) = ${output}`
          ];
          break;
        }
        case "integrate": {
          const integrated = integratePolynomialExpression(expression, variable);
          output = integrated.output;
          latexOutput = integrated.latexOutput;
          steps = integrated.steps;
          break;
        }
        case "divide": {
          if (!operand2) {
            return res.status(400).json({ error: "Operand 2 is required for polynomial division." });
          }
          const safeOperand = assertSafeExpression(operand2, { variables: [variable] });
          const divided = dividePolynomialExpressions(expression, safeOperand, variable);
          output = divided.output;
          latexOutput = divided.latexOutput;
          steps = divided.steps;
          break;
        }
        case "multiply": {
          if (!operand2) {
            return res.status(400).json({ error: "Operand 2 is required for polynomial multiplication." });
          }
          const safeOperand = assertSafeExpression(operand2, { variables: [variable] });
          const multiplied = multiplyPolynomialExpressions(expression, safeOperand, variable);
          output = multiplied.output;
          latexOutput = multiplied.latexOutput;
          steps = multiplied.steps;
          break;
        }
        case "factor": {
          const factored = factorPolynomialExpression(expression, variable);
          output = factored.output;
          latexOutput = factored.latexOutput;
          steps = factored.steps;
          break;
        }
        case "roots": {
          const roots = findPolynomialRootsExpression(expression, variable);
          output = roots.output;
          latexOutput = roots.latexOutput;
          steps = roots.steps;
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported polynomial operation." });
      }

      res.json({ output, latexOutput, steps });
    } catch (e) {
      mathError(res, e);
    }
  });

  // 2. Symbolic Algebra Solver Router
  app.post("/api/math/algebra", (req, res) => {
    const { operation, subValue } = req.body;

    try {
      const variable = normalizeVariableName(req.body.variable || 'x');
      const expression = assertSafeExpression(req.body.expression, {
        variables: Array.from(new Set(['x', 'y', 'z', 'a', 'b', 'c', 't', variable]))
      });
      let output = "";
      let latexOutput = "";
      let steps: string[] = [];

      switch (operation) {
        case "simplify": {
          const result = math.simplify(expression);
          output = result.toString();
          latexOutput = result.toTex();
          steps = [`Evaluate symbolic tree of: ${expression}`, `Reduce constants: ${output}`];
          break;
        }
        case "expand": {
          try {
            const expanded = expandPolynomialExpression(expression, variable);
            output = expanded.output;
            latexOutput = expanded.latexOutput;
            steps = expanded.steps;
          } catch {
            const result = math.simplify(expression);
            output = result.toString();
            latexOutput = result.toTex();
            steps = [`Expanded using symbolic simplification rules for: ${expression}`, `Distributed evaluation complete where supported.`];
          }
          break;
        }
        case "factor": {
          const factored = factorPolynomialExpression(expression, variable);
          output = factored.output;
          latexOutput = factored.latexOutput;
          steps = factored.steps;
          break;
        }
        case "substitute": {
          if (subValue === undefined) {
            return res.status(400).json({ error: "Substitution demands variable name and value parameters." });
          }
          const parsedVal = Number(subValue);
          if (!Number.isFinite(parsedVal)) {
            return res.status(400).json({ error: "Substitution value must be a finite number." });
          }
          const scope: Record<string, number> = {};
          scope[variable] = parsedVal;
          const result = math.evaluate(expression, scope);
          output = result.toString();
          latexOutput = `${math.parse(expression).toTex()} \\Big|_{${variable}=${subValue}} = ${result}`;
          steps = [
            `1. Targeted equation: ${expression}`,
            `2. Substituting ${variable} with value ${subValue}`,
            `3. Evaluated result: ${output}`
          ];
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported algebraic operation." });
      }

      return res.json({ output, latexOutput, steps });
    } catch (e) {
      return mathError(res, e);
    }
  });

  // 3. Matrix Computation Suite Router
  app.post("/api/math/matrix", (req, res) => {
    const { matrixB, operation, vectorB } = req.body;

    try {
      let output = "";
      let latexResult = "";
      let resultData: any = {};
      let steps: string[] = [];

      const matrixA = parseNumericMatrix(req.body.matrixA, "Matrix A");
      const nodeA = math.matrix(matrixA);

      switch (operation) {
        case "add": {
          if (!matrixB) return res.status(400).json({ error: "Matrix B is required for addition." });
          const parsedB = parseNumericMatrix(matrixB, "Matrix B");
          if (parsedB.length !== matrixA.length || parsedB[0].length !== matrixA[0].length) {
            return res.status(400).json({ error: "Matrix addition requires matrices with matching dimensions." });
          }
          const sum = math.add(nodeA, math.matrix(parsedB));
          resultData = sum.toArray();
          output = "Matrix Sum successfully calculated.";
          latexResult = `A + B = \\begin{pmatrix} ${resultData.map((row: any) => row.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
          steps = ["Add each element indexing i,j respectively: A[i][j] + B[i][j]"];
          break;
        }
        case "multiply": {
          if (!matrixB) return res.status(400).json({ error: "Matrix B is required for multiplication." });
          const parsedB = parseNumericMatrix(matrixB, "Matrix B");
          if (matrixA[0].length !== parsedB.length) {
            return res.status(400).json({ error: "Matrix multiplication requires columns(A) to equal rows(B)." });
          }
          const product = math.multiply(nodeA, math.matrix(parsedB));
          resultData = product.toArray();
          output = "Matrix multiplication computed successfully.";
          latexResult = `A \\cdot B = \\begin{pmatrix} ${resultData.map((row: any) => row.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
          steps = ["Multiply and aggregate product row dot-product vectors: Σ A[i][k] * B[k][j]"];
          break;
        }
        case "determinant": {
          assertSquareMatrix(matrixA, "Matrix A");
          const det = math.det(nodeA);
          resultData = { determinant: det };
          output = `Determinant: det(A) = ${det}`;
          latexResult = `\\det(A) = ${det.toFixed(4)}`;
          steps = [
            "1. Transform matrix into upper triangular layout (Gaussian pivot).",
            `2. Compute product of elements along the primary diagonal: ${det}`
          ];
          break;
        }
        case "inverse": {
          assertSquareMatrix(matrixA, "Matrix A");
          const inv = math.inv(nodeA) as any;
          resultData = inv.toArray();
          output = "Inversion matrix generated.";
          latexResult = `A^{-1} = \\begin{pmatrix} ${resultData.map((row: any) => row.map((v: number) => v.toFixed(4)).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
          steps = ["Apply Gaussian Jordan augmented row swaps on [ A | I ]."];
          break;
        }
        case "lu": {
          assertSquareMatrix(matrixA, "Matrix A");
          const mathLup = math.lup(nodeA);
          const lData = (mathLup.L as any).toArray();
          const uData = (mathLup.U as any).toArray();
          resultData = { L: lData, U: uData, P: mathLup.p };
          output = "LU Triangular (LUP) decomposition completed.";
          latexResult = `L = \\begin{pmatrix} ${lData.map((r: any) => r.map((v: any) => v.toFixed(3)).join(" & ")).join(" \\\\ ")} \\end{pmatrix}, \\ U = \\begin{pmatrix} ${uData.map((r: any) => r.map((v: any) => v.toFixed(3)).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
          steps = [
            "Factorize square matrix: P * A = L * U",
            "L represents lower unit triangular coefficients, U represents upper echelon outputs."
          ];
          break;
        }
        case "qr": {
          const mathQr = math.qr(nodeA);
          const qData = (mathQr.Q as any).toArray();
          const rData = (mathQr.R as any).toArray();
          resultData = { Q: qData, R: rData };
          output = "QR Orthogonal-diagonal decomposition computed.";
          latexResult = `Q = \\begin{pmatrix} ${qData.map((r: any) => r.map((v: any) => v.toFixed(3)).join(" & ")).join(" \\\\ ")} \\end{pmatrix}, \\ R = \\begin{pmatrix} ${rData.map((r: any) => r.map((v: any) => v.toFixed(3)).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
          steps = ["Factorize A = Q * R using Gram-Schmidt projection or Householder matrices."];
          break;
        }
        case "eigen": {
          assertSquareMatrix(matrixA, "Matrix A");
          const { eigenvalues, eigenvectors } = calculateEigenvaluesAndVectors(matrixA);
          resultData = { eigenvalues, eigenvectors };
          output = "Eigenvalues and eigenvectors approximation completed.";
          latexResult = `\\lambda \\approx \\left\\{ ${eigenvalues.join(", ")} \\right\\}`;
          steps = [
            "Apply QR eigenvalue diagonalization iterative shifts.",
            "Converge sub-diagonal boundaries step-wise.",
            "Columns corresponding to transformation products approximate eigenvectors."
          ];
          break;
        }
        case "solveLinear": {
          if (!vectorB || !Array.isArray(vectorB)) return res.status(400).json({ error: "Missing Vector inputs for solving system" });
          assertSquareMatrix(matrixA, "Matrix A");
          const parsedVector = parseNumericVector(vectorB, matrixA.length, "Vector b");
          const solution = math.lusolve(nodeA, parsedVector) as any;
          resultData = solution.toArray ? solution.toArray().map((r: any) => r[0]) : solution;
          output = `System solutions: x = [${resultData.map((v: number) => v.toFixed(4)).join(", ")}]`;
          latexResult = `\\mathbf{x} = \\begin{pmatrix} ${resultData.map((v: number) => v.toFixed(4)).join(" \\\\ ")} \\end{pmatrix}`;
          steps = ["Apply LUP forward and backward substitution matrices solving Ax = b."];
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported matrix operation" });
      }

      return res.json({ output, latexResult, result: resultData, steps });
    } catch (e) {
      return mathError(res, e);
    }
  });

  // 4. Numerical Analysis Suite Router
  app.post("/api/math/numerical", (req, res) => {
    const { method, initialGuess, a, b, points, degree } = req.body;

    try {
      let output = "";
      let steps: string[] = [];
      let resultsData: any = {};

      switch (method) {
        case "newton": {
          if (req.body.expression === undefined || initialGuess === undefined) return res.status(400).json({ error: " Newton solver requires expression and initial guess" });
          const expression = assertSafeExpression(req.body.expression, { variables: ['x'] });
          const guess = Number(initialGuess);
          if (!Number.isFinite(guess)) return res.status(400).json({ error: "Initial guess must be a finite number." });
          const nr = solveNewtonRaphson(expression, guess);
          output = `Root approximated: x ≈ ${nr.root.toFixed(7)}`;
          steps = nr.steps;
          resultsData = { root: nr.root };
          break;
        }
        case "bisection": {
          if (req.body.expression === undefined || a === undefined || b === undefined) return res.status(400).json({ error: "Bisection solver requires expression, a, and b boundaries" });
          const expression = assertSafeExpression(req.body.expression, { variables: ['x'] });
          const lower = Number(a);
          const upper = Number(b);
          if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper) {
            return res.status(400).json({ error: "Bisection bounds must be distinct finite numbers." });
          }
          const bisect = solveBisection(expression, lower, upper);
          output = `Root approximated: x ≈ ${bisect.root.toFixed(7)}`;
          steps = bisect.steps;
          resultsData = { root: bisect.root };
          break;
        }
        case "integrate": {
          if (req.body.expression === undefined || a === undefined || b === undefined) return res.status(400).json({ error: "Integration requires expression, a, and b boundaries" });
          const expression = assertSafeExpression(req.body.expression, { variables: ['x'] });
          const lower = Number(a);
          const upper = Number(b);
          if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper) {
            return res.status(400).json({ error: "Integration bounds must be distinct finite numbers." });
          }
          const numInt = numericalIntegration(expression, lower, upper);
          output = `Numerical Area approximated: ${numInt.result.toFixed(8)}`;
          steps = numInt.steps;
          resultsData = { area: numInt.result };
          break;
        }
        case "curvefit": {
          if (!points || !Array.isArray(points)) return res.status(400).json({ error: "Curve fitting requires xy points coordinate array" });
          const currentDegree = degree ? Number(degree) : 1;
          if (!Number.isInteger(currentDegree) || currentDegree < 1 || currentDegree > 6) {
            return res.status(400).json({ error: "Curve fitting degree must be an integer between 1 and 6." });
          }
          if (points.length <= currentDegree || points.length > 100) {
            return res.status(400).json({ error: "Curve fitting requires more points than degree and at most 100 points." });
          }
          const numericPoints = points.map(point => ({ x: Number(point?.x), y: Number(point?.y) }));
          if (numericPoints.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
            return res.status(400).json({ error: "Curve fitting points must contain finite x and y values." });
          }
          const fitResult = fitCurve(numericPoints, currentDegree);
          output = `Equation Fit: y = ${fitResult.equation} (R² = ${fitResult.r2.toFixed(4)})`;
          steps = fitResult.steps;
          resultsData = fitResult;
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported numerical method" });
      }

      return res.json({ output, steps, result: resultsData });
    } catch (e) {
      return mathError(res, e);
    }
  });

  // 5. Calculus Core Suite Router (Limits, Taylor expansion, ODE integration)
  app.post("/api/math/calculus", (req, res) => {
    const { operation, center, degree, x0, y0, xEnd, stepsCount } = req.body;

    try {
      let output = "";
      let latexOutput = "";
      let steps: string[] = [];
      let resultData: any = {};

      switch (operation) {
        case "limit": {
          if (req.body.expression === undefined || center === undefined) return res.status(400).json({ error: "Limit approximation requires expression and target center coordinate" });
          const expression = assertSafeExpression(req.body.expression, { variables: ['x'] });
          if (!Number.isFinite(Number(center))) return res.status(400).json({ error: "Limit center must be a finite number." });
          const limResult = evaluateNumericalLimit(expression, Number(center));
          output = limResult.exists ? `Limit: ${limResult.limit?.toFixed(6)}` : `Limit does not exist. Reason: ${limResult.reason}`;
          latexOutput = `\\lim_{x \\to ${center}} \\left(${math.parse(expression).toTex()}\\right) = ${limResult.exists ? limResult.limit?.toFixed(4) : '\\text{Undefined}'}`;
          steps = limResult.steps;
          resultData = limResult;
          break;
        }
        case "taylor": {
          if (req.body.expression === undefined || center === undefined) return res.status(400).json({ error: "Taylor expansion requires expression and center target value" });
          const expression = assertSafeExpression(req.body.expression, { variables: ['x'] });
          if (!Number.isFinite(Number(center))) return res.status(400).json({ error: "Taylor center must be a finite number." });
          const deg = degree ? Number(degree) : 4;
          if (!Number.isInteger(deg) || deg < 0 || deg > 12) return res.status(400).json({ error: "Taylor degree must be an integer between 0 and 12." });
          const taylor = computeTaylorSeries(expression, Number(center), deg);
          output = `Taylor Polynomial: ${taylor.polynomial}`;
          latexOutput = `T_{${deg}}(x) = ${taylor.latex} + \\mathcal{O}(x^{${deg + 1}})`;
          steps = taylor.steps;
          resultData = taylor;
          break;
        }
        case "ode": {
          if (req.body.expression === undefined || x0 === undefined || y0 === undefined || xEnd === undefined) {
            return res.status(400).json({ error: "Runge-Kutta ODE solver requires dy/dx expression, x0, y0, and xEnd values." });
          }
          const expression = assertSafeExpression(req.body.expression, { variables: ['x', 'y'] });
          const stepsNum = stepsCount ? Number(stepsCount) : 100;
          if (!Number.isInteger(stepsNum) || stepsNum < 1 || stepsNum > 5000) return res.status(400).json({ error: "ODE step count must be an integer between 1 and 5000." });
          if (![x0, y0, xEnd].every(value => Number.isFinite(Number(value)))) return res.status(400).json({ error: "ODE coordinates must be finite numbers." });
          const rk4 = solveRK4(expression, Number(x0), Number(y0), Number(xEnd), stepsNum);
          output = `Integrated dy/dx at x = ${xEnd}: y(${xEnd}) ≈ ${rk4.finalY.toFixed(6)}`;
          latexOutput = `y(${xEnd}) \\approx ${rk4.finalY.toFixed(4)}`;
          steps = rk4.steps;
          resultData = rk4;
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported calculus operation" });
      }

      return res.json({ output, latexOutput, steps, result: resultData });
    } catch (e) {
      return mathError(res, e);
    }
  });

  // 6. Statistics Lab Router (Metrics computation & simple regression)
  app.post("/api/math/statistics", (req, res) => {
    const { series } = req.body;
    if (!series || !Array.isArray(series) || series.length === 0) {
      return res.status(400).json({ error: "Statistics series vector elements missing." });
    }
    if (series.length > 10_000) {
      return res.status(400).json({ error: "Statistics series cannot exceed 10,000 values." });
    }

    const numericSeries = series.map(value => Number(value));
    if (numericSeries.some(value => !Number.isFinite(value))) {
      return res.status(400).json({ error: "Statistics series must contain only finite numbers." });
    }

    try {
      const metrics = computeStatistics(numericSeries);
      if (!metrics) return res.status(400).json({ error: "Failed to evaluate metrics." });

      const output = `Summary: Mean = ${metrics.mean.toFixed(3)}, Standard Deviation = ${metrics.stdDev.toFixed(3)}, Conf. Interval = [${metrics.confidenceInterval95.map(v => v.toFixed(3)).join(", ")}]`;
      const latexResult = `\\mu = ${metrics.mean.toFixed(2)}, \\ \\sigma = ${metrics.stdDev.toFixed(2)}`;
      
      const steps = [
        `1. Recieved numeric elements: size N = ${metrics.n}`,
        `2. Sum terms = ${numericSeries.reduce((s, c) => s + c, 0).toFixed(2)}`,
        `3. Calculated mean: μ = sum / N = ${metrics.mean.toFixed(4)}`,
        `4. Computed variance summing squares (x_i - μ)²: s² = ${metrics.variance.toFixed(4)}`,
        `5. Standard deviation: s = √s² = ${metrics.stdDev.toFixed(4)}`
      ];

      return res.json({ output, latexResult, steps, result: metrics });
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  });

  // 7. Gemini AI Mathematics Interactive Solver
  app.post("/api/math/ai-explain", async (req, res) => {
    const { query, category } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing inquiry raw query parameter." });
    }

    try {
      const explanationResult = await generateMathExplanation(query, category);
      return res.json(explanationResult);
    } catch (e) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  // Serve static assets or run Vite middleware
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || process.env.HOSTNAME || "0.0.0.0";

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
