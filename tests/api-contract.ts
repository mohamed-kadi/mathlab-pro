import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo, Server } from "node:net";

interface ContractTarget {
  baseUrl: string;
  close: () => Promise<void>;
}

interface JsonResponse<T = unknown> {
  response: Response;
  body: T;
}

type JsonObject = Record<string, unknown>;

const defaultHeaders = {
  "Content-Type": "application/json"
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function startContractTarget(): Promise<ContractTarget> {
  const externalBaseUrl = process.env.MATHLAB_API_BASE_URL;
  if (externalBaseUrl) {
    return {
      baseUrl: normalizeBaseUrl(externalBaseUrl),
      close: async () => undefined
    };
  }

  const dbFile = path.join(os.tmpdir(), `mathlab-pro-contract-${process.pid}-${Date.now()}.json`);
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "mathlab-pro-contract-test-secret";
  process.env.MATHLAB_DB_FILE = dbFile;
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;

  const { createApp } = await import("../server.ts");
  const app = await createApp();
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (!error || (error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
            resolve();
          } else {
            reject(error);
          }
        });
      });
      fs.rmSync(dbFile, { force: true });
    }
  };
}

async function requestJson<T = unknown>(baseUrl: string, pathname: string, init: RequestInit = {}): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as T : null as T;
  return { response, body };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function assertObject(value: unknown, label: string): asserts value is JsonObject {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);
  assert.equal(Array.isArray(value), false, `${label} must not be an array`);
}

function assertString(value: unknown, label: string): string {
  assert.equal(typeof value, "string", `${label} must be a string`);
  return value as string;
}

function assertBoolean(value: unknown, label: string): boolean {
  assert.equal(typeof value, "boolean", `${label} must be a boolean`);
  return value as boolean;
}

function assertNumber(value: unknown, label: string): number {
  assert.equal(typeof value, "number", `${label} must be a number`);
  assert.equal(Number.isFinite(value), true, `${label} must be finite`);
  return value as number;
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
}

function assertError(body: unknown) {
  assertObject(body, "error body");
  assertString(body.error, "error");
}

function assertSuccess(body: unknown) {
  assertObject(body, "success body");
  assert.equal(body.success, true);
}

function assertUser(value: unknown, email?: string) {
  assertObject(value, "user");
  assertString(value.id, "user.id");
  assertString(value.username, "user.username");
  assertString(value.email, "user.email");
  assertString(value.createdAt, "user.createdAt");
  assert.equal("passwordHash" in value, false, "user must not expose passwordHash");
  if (email) {
    assert.equal(value.email, email);
  }
}

function assertAuthResponse(body: unknown, email: string) {
  assertObject(body, "auth response");
  const token = assertString(body.token, "token");
  assert.equal(token.split(".").length, 3, "token must look like a JWT");
  assertUser(body.user, email);
  return token;
}

function assertMathTextResponse(body: unknown) {
  assertObject(body, "math text response");
  assertString(body.output, "output");
  assertString(body.latexOutput ?? body.latexResult ?? "", "latex output");
  assertArray(body.steps, "steps");
}

function assertMathDataResponse(body: unknown) {
  assertObject(body, "math data response");
  assertString(body.output, "output");
  assertArray(body.steps, "steps");
  assert.notEqual(body.result, undefined, "result must be present");
}

async function waitForAuditLog(baseUrl: string, headers: Record<string, string>, predicate: (logs: JsonObject[]) => boolean) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const auditLogs = await requestJson(baseUrl, "/api/audit-logs", { headers });
    assert.equal(auditLogs.response.status, 200);
    assertArray(auditLogs.body, "audit logs");
    const logs = auditLogs.body as JsonObject[];
    if (predicate(logs)) return logs;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail("Expected audit log entry was not written.");
}

async function runContractSuite(baseUrl: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `contract-primary-${suffix}@example.com`;
  const secondaryEmail = `contract-secondary-${suffix}@example.com`;
  const password = "contract-password-123";

  const health = await requestJson(baseUrl, "/api/health");
  assert.equal(health.response.status, 200);
  assertObject(health.body, "health");
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.service, "mathlab-pro");
  assertString(health.body.timestamp, "health.timestamp");

  const unauthProjects = await requestJson(baseUrl, "/api/projects");
  assert.equal(unauthProjects.response.status, 401);
  assertError(unauthProjects.body);

  const invalidRegister = await requestJson(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "not-an-email", password: "short" })
  });
  assert.equal(invalidRegister.response.status, 400);
  assertError(invalidRegister.body);

  const register = await requestJson(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: `primary-${suffix}`,
      email: primaryEmail,
      password
    })
  });
  assert.equal(register.response.status, 200);
  const primaryToken = assertAuthResponse(register.body, primaryEmail);
  const primaryHeaders = authHeaders(primaryToken);

  const duplicateRegister = await requestJson(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: `primary-${suffix}`,
      email: primaryEmail,
      password
    })
  });
  assert.equal(duplicateRegister.response.status, 400);
  assertError(duplicateRegister.body);

  const badLogin = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: primaryEmail, password: "wrong-password" })
  });
  assert.equal(badLogin.response.status, 401);
  assertError(badLogin.body);

  const login = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: primaryEmail, password })
  });
  assert.equal(login.response.status, 200);
  assertAuthResponse(login.body, primaryEmail);

  const me = await requestJson(baseUrl, "/api/auth/me", { headers: primaryHeaders });
  assert.equal(me.response.status, 200);
  assertObject(me.body, "me");
  assertUser(me.body.user, primaryEmail);

  const cacheStatus = await requestJson(baseUrl, "/api/cache/status", { headers: primaryHeaders });
  assert.equal(cacheStatus.response.status, 200);
  assertObject(cacheStatus.body, "cache status");
  assert.match(assertString(cacheStatus.body.provider, "cache provider"), /^(memory|redis)$/);
  assertBoolean(cacheStatus.body.enabled, "cache enabled");
  assertNumber(cacheStatus.body.ttlSeconds, "cache ttlSeconds");

  const savedExpressions = await requestJson(baseUrl, "/api/saved-expressions", { headers: primaryHeaders });
  assert.equal(savedExpressions.response.status, 200);
  assertArray(savedExpressions.body, "saved expressions");

  const createdExpression = await requestJson(baseUrl, "/api/saved-expressions", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({
      name: "Contract Quadratic",
      rawExpression: "x^2 + 2*x + 1",
      latexExpression: "x^2 + 2x + 1"
    })
  });
  assert.equal(createdExpression.response.status, 200);
  assertObject(createdExpression.body, "created expression");
  const createdExpressionId = assertString(createdExpression.body.id, "created expression id");
  assert.equal(createdExpression.body.name, "Contract Quadratic");

  const updatedExpression = await requestJson(baseUrl, `/api/saved-expressions/${createdExpressionId}`, {
    method: "PUT",
    headers: primaryHeaders,
    body: JSON.stringify({ name: "Updated Contract Quadratic" })
  });
  assert.equal(updatedExpression.response.status, 200);
  assertObject(updatedExpression.body, "updated expression");
  assert.equal(updatedExpression.body.name, "Updated Contract Quadratic");

  const secondRegister = await requestJson(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: `secondary-${suffix}`,
      email: secondaryEmail,
      password
    })
  });
  assert.equal(secondRegister.response.status, 200);
  const secondaryToken = assertAuthResponse(secondRegister.body, secondaryEmail);
  const secondaryHeaders = authHeaders(secondaryToken);

  const secondUserCannotDeleteExpression = await requestJson(baseUrl, `/api/saved-expressions/${createdExpressionId}`, {
    method: "DELETE",
    headers: secondaryHeaders
  });
  assert.equal(secondUserCannotDeleteExpression.response.status, 404);
  assertError(secondUserCannotDeleteExpression.body);

  const projects = await requestJson(baseUrl, "/api/projects", { headers: primaryHeaders });
  assert.equal(projects.response.status, 200);
  assertArray(projects.body, "projects");

  const createdProject = await requestJson(baseUrl, "/api/projects", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({
      name: "Contract Workspace",
      description: "Project created by portable API contract tests.",
      sheets: [
        {
          id: "sheet-contract",
          name: "Inputs",
          cells: {
            A1: "2",
            B1: "3",
            C1: "=A1+B1"
          }
        }
      ]
    })
  });
  assert.equal(createdProject.response.status, 200);
  assertObject(createdProject.body, "created project");
  const createdProjectId = assertString(createdProject.body.id, "created project id");
  assert.equal(createdProject.body.name, "Contract Workspace");

  const updatedProject = await requestJson(baseUrl, `/api/projects/${createdProjectId}`, {
    method: "PUT",
    headers: primaryHeaders,
    body: JSON.stringify({ description: "Updated by contract tests." })
  });
  assert.equal(updatedProject.response.status, 200);
  assertObject(updatedProject.body, "updated project");
  assert.equal(updatedProject.body.description, "Updated by contract tests.");

  const secondUserCannotAttachGraph = await requestJson(baseUrl, "/api/graph-configurations", {
    method: "POST",
    headers: secondaryHeaders,
    body: JSON.stringify({
      projectId: createdProjectId,
      name: "Unauthorized Graph",
      config: { expressions: ["sin(x)"] }
    })
  });
  assert.equal(secondUserCannotAttachGraph.response.status, 404);
  assertError(secondUserCannotAttachGraph.body);

  const createdGraph = await requestJson(baseUrl, "/api/graph-configurations", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({
      projectId: createdProjectId,
      name: "Contract Graph",
      config: { expressions: ["sin(x)"], viewport: { xMin: -10, xMax: 10 } }
    })
  });
  assert.equal(createdGraph.response.status, 200);
  assertObject(createdGraph.body, "created graph");
  const createdGraphId = assertString(createdGraph.body.id, "created graph id");
  assert.equal(createdGraph.body.projectId, createdProjectId);

  const updatedGraph = await requestJson(baseUrl, `/api/graph-configurations/${createdGraphId}`, {
    method: "PUT",
    headers: primaryHeaders,
    body: JSON.stringify({ name: "Updated Contract Graph" })
  });
  assert.equal(updatedGraph.response.status, 200);
  assertObject(updatedGraph.body, "updated graph");
  assert.equal(updatedGraph.body.name, "Updated Contract Graph");

  const createdShare = await requestJson(baseUrl, "/api/shared-workspaces", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({
      projectId: createdProjectId,
      sharedWithEmail: secondaryEmail,
      role: "viewer"
    })
  });
  assert.equal(createdShare.response.status, 200);
  assertObject(createdShare.body, "created share");
  const createdShareId = assertString(createdShare.body.id, "created share id");
  assert.equal(createdShare.body.role, "viewer");

  const updatedShare = await requestJson(baseUrl, `/api/shared-workspaces/${createdShareId}`, {
    method: "PUT",
    headers: primaryHeaders,
    body: JSON.stringify({ role: "editor" })
  });
  assert.equal(updatedShare.response.status, 200);
  assertObject(updatedShare.body, "updated share");
  assert.equal(updatedShare.body.role, "editor");

  const sharedWorkspaces = await requestJson(baseUrl, "/api/shared-workspaces", { headers: primaryHeaders });
  assert.equal(sharedWorkspaces.response.status, 200);
  assertObject(sharedWorkspaces.body, "shared workspaces");
  assertArray(sharedWorkspaces.body.outgoing, "outgoing shared workspaces");
  assertArray(sharedWorkspaces.body.incoming, "incoming shared workspaces");

  const outgoingShares = await requestJson(baseUrl, "/api/shared-workspaces/outgoing", { headers: primaryHeaders });
  assert.equal(outgoingShares.response.status, 200);
  assertArray(outgoingShares.body, "outgoing shares");
  assert.equal(outgoingShares.body.some(share => {
    assertObject(share, "outgoing share");
    return share.id === createdShareId;
  }), true);

  const incomingShares = await requestJson(baseUrl, "/api/shared-workspaces/incoming", { headers: secondaryHeaders });
  assert.equal(incomingShares.response.status, 200);
  assertArray(incomingShares.body, "incoming shares");
  assert.equal(incomingShares.body.some(share => {
    assertObject(share, "incoming share");
    return share.id === createdShareId && share.projectId === createdProjectId;
  }), true);

  const anonymousHistory = await requestJson(baseUrl, "/api/history");
  assert.equal(anonymousHistory.response.status, 200);
  assertArray(anonymousHistory.body, "anonymous history");

  const invalidTokenHistory = await requestJson(baseUrl, "/api/history", {
    headers: authHeaders("invalid.token.value")
  });
  assert.equal(invalidTokenHistory.response.status, 401);
  assertError(invalidTokenHistory.body);

  const savedHistory = await requestJson(baseUrl, "/api/history", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({ type: "polynomial", input: "x^2", output: "2*x" })
  });
  assert.equal(savedHistory.response.status, 200);
  assertObject(savedHistory.body, "saved history");
  assert.equal(savedHistory.body.input, "x^2");

  const userHistory = await requestJson(baseUrl, "/api/history", { headers: primaryHeaders });
  assert.equal(userHistory.response.status, 200);
  assertArray(userHistory.body, "user history");
  assert.equal(userHistory.body.some(item => {
    assertObject(item, "history item");
    return item.input === "x^2";
  }), true);

  const derivative = await requestJson(baseUrl, "/api/math/polynomial", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({ expression: "x^2 + 2*x + 1", operation: "derivative", variable: "x" })
  });
  assert.equal(derivative.response.status, 200);
  assert.match(derivative.response.headers.get("x-mathlab-cache") || "", /^(MISS|HIT)$/);
  assertMathTextResponse(derivative.body);
  assertObject(derivative.body, "derivative response");
  assert.match(assertString(derivative.body.output, "derivative output"), /x \+ 1/);

  const cachedDerivative = await requestJson(baseUrl, "/api/math/polynomial", {
    method: "POST",
    headers: primaryHeaders,
    body: JSON.stringify({ variable: "x", operation: "derivative", expression: "x^2 + 2*x + 1" })
  });
  assert.equal(cachedDerivative.response.status, 200);
  assert.equal(cachedDerivative.response.headers.get("x-mathlab-cache"), "HIT");
  assertObject(cachedDerivative.body, "cached derivative response");
  assert.equal(cachedDerivative.body.output, derivative.body.output);

  const polynomialDivision = await requestJson(baseUrl, "/api/math/polynomial", {
    method: "POST",
    body: JSON.stringify({ expression: "x^2 - 1", operand2: "x - 1", operation: "divide", variable: "x" })
  });
  assert.equal(polynomialDivision.response.status, 200);
  assertMathTextResponse(polynomialDivision.body);
  assertObject(polynomialDivision.body, "polynomial division response");
  assert.match(assertString(polynomialDivision.body.output, "division output"), /Quotient: x \+ 1/);

  const algebraFactor = await requestJson(baseUrl, "/api/math/algebra", {
    method: "POST",
    body: JSON.stringify({ expression: "x^2 + 4*x - 12", operation: "factor", variable: "x" })
  });
  assert.equal(algebraFactor.response.status, 200);
  assertMathTextResponse(algebraFactor.body);
  assertObject(algebraFactor.body, "algebra factor response");
  assert.match(assertString(algebraFactor.body.output, "factor output"), /\(x - 2\)/);

  const unsafeExpression = await requestJson(baseUrl, "/api/math/polynomial", {
    method: "POST",
    body: JSON.stringify({ expression: "import(1)", operation: "simplify", variable: "x" })
  });
  assert.equal(unsafeExpression.response.status, 400);
  assertError(unsafeExpression.body);

  const matrixDeterminant = await requestJson(baseUrl, "/api/math/matrix", {
    method: "POST",
    body: JSON.stringify({ operation: "determinant", matrixA: [[1, 2], [3, 4]] })
  });
  assert.equal(matrixDeterminant.response.status, 200);
  assertMathDataResponse(matrixDeterminant.body);
  assertObject(matrixDeterminant.body, "matrix determinant response");
  assert.match(assertString(matrixDeterminant.body.output, "determinant output"), /Determinant/);

  const invalidMatrix = await requestJson(baseUrl, "/api/math/matrix", {
    method: "POST",
    body: JSON.stringify({ operation: "determinant", matrixA: [[1, 2, 3], [4, 5, 6]] })
  });
  assert.equal(invalidMatrix.response.status, 400);
  assertError(invalidMatrix.body);

  const numericalIntegration = await requestJson(baseUrl, "/api/math/numerical", {
    method: "POST",
    body: JSON.stringify({ method: "integrate", expression: "x^2", a: 0, b: 1 })
  });
  assert.equal(numericalIntegration.response.status, 200);
  assertMathDataResponse(numericalIntegration.body);
  assertObject(numericalIntegration.body, "numerical integration response");
  assert.match(assertString(numericalIntegration.body.output, "numerical integration output"), /Numerical Area/);

  const calculusLimit = await requestJson(baseUrl, "/api/math/calculus", {
    method: "POST",
    body: JSON.stringify({ operation: "limit", expression: "sin(x)/x", center: 0 })
  });
  assert.equal(calculusLimit.response.status, 200);
  assertMathDataResponse(calculusLimit.body);
  assertObject(calculusLimit.body, "calculus limit response");
  assert.match(assertString(calculusLimit.body.output, "calculus limit output"), /Limit/);

  const statistics = await requestJson(baseUrl, "/api/math/statistics", {
    method: "POST",
    body: JSON.stringify({ series: [1, 2, 3, 4, 5] })
  });
  assert.equal(statistics.response.status, 200);
  assertMathDataResponse(statistics.body);
  assertObject(statistics.body, "statistics response");
  assert.match(assertString(statistics.body.output, "statistics output"), /Mean/);

  const missingAiQuery = await requestJson(baseUrl, "/api/math/ai-explain", {
    method: "POST",
    body: JSON.stringify({ category: "calculus" })
  });
  assert.equal(missingAiQuery.response.status, 400);
  assertError(missingAiQuery.body);

  const aiExplain = await requestJson(baseUrl, "/api/math/ai-explain", {
    method: "POST",
    body: JSON.stringify({ query: "Explain the derivative of x^2.", category: "calculus" })
  });
  assert.equal(aiExplain.response.status, 200);
  assertObject(aiExplain.body, "ai explain response");
  assertString(aiExplain.body.explanation, "ai explanation");
  assertArray(aiExplain.body.steps, "ai steps");

  await waitForAuditLog(baseUrl, primaryHeaders, logs =>
    logs.some(log => log.resource === "saved-expressions" && log.action === "create") &&
    logs.some(log => log.resource === "math.polynomial" && log.action === "calculate")
  );

  const deletedShare = await requestJson(baseUrl, `/api/shared-workspaces/${createdShareId}`, {
    method: "DELETE",
    headers: primaryHeaders
  });
  assert.equal(deletedShare.response.status, 200);
  assertSuccess(deletedShare.body);

  const deletedGraph = await requestJson(baseUrl, `/api/graph-configurations/${createdGraphId}`, {
    method: "DELETE",
    headers: primaryHeaders
  });
  assert.equal(deletedGraph.response.status, 200);
  assertSuccess(deletedGraph.body);

  const deletedExpression = await requestJson(baseUrl, `/api/saved-expressions/${createdExpressionId}`, {
    method: "DELETE",
    headers: primaryHeaders
  });
  assert.equal(deletedExpression.response.status, 200);
  assertSuccess(deletedExpression.body);

  const deletedProject = await requestJson(baseUrl, `/api/projects/${createdProjectId}`, {
    method: "DELETE",
    headers: primaryHeaders
  });
  assert.equal(deletedProject.response.status, 200);
  assertSuccess(deletedProject.body);
}

const target = await startContractTarget();

try {
  await runContractSuite(target.baseUrl);
  console.log(`api contract tests passed against ${target.baseUrl}`);
} finally {
  await target.close();
}
