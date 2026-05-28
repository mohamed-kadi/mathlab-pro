import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo, Server } from 'node:net';
import { evaluateCellValue } from '../src/lib/spreadsheetFormula.ts';

const dbFile = path.join(os.tmpdir(), `mathlab-pro-test-${process.pid}-${Date.now()}.json`);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'mathlab-pro-test-secret';
process.env.MATHLAB_DB_FILE = dbFile;

const { createApp } = await import('../server.ts');

const app = await createApp();
const server = await new Promise<Server>((resolve, reject) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  listener.on('error', reject);
});

function baseUrl() {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function requestJson(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl()}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAuditLog(headers: Record<string, string>, predicate: (logs: any[]) => boolean) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const auditLogs = await requestJson('/api/audit-logs', { headers });
    assert.equal(auditLogs.response.status, 200);
    if (predicate(auditLogs.body)) {
      return auditLogs.body;
    }
    await sleep(25);
  }
  assert.fail('Expected audit log entry was not written.');
}

async function run() {
  const health = await requestJson('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');

  const unauthProjects = await requestJson('/api/projects');
  assert.equal(unauthProjects.response.status, 401);

  const badLogin = await requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'guest@mathlab.edu', password: 'wrong-password' })
  });
  assert.equal(badLogin.response.status, 401);

  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'guest@mathlab.edu', password: 'mathlab-demo-password' })
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.user.email, 'guest@mathlab.edu');
  assert.equal(typeof login.body.token, 'string');
  assert.equal(login.body.token.split('.').length, 3);

  const authHeaders = { Authorization: `Bearer ${login.body.token}` };
  const me = await requestJson('/api/auth/me', { headers: authHeaders });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.email, 'guest@mathlab.edu');

  const cacheStatus = await requestJson('/api/cache/status', { headers: authHeaders });
  assert.equal(cacheStatus.response.status, 200);
  assert.equal(cacheStatus.body.provider, 'memory');
  assert.equal(cacheStatus.body.enabled, true);

  const projects = await requestJson('/api/projects', { headers: authHeaders });
  assert.equal(projects.response.status, 200);
  assert.equal(Array.isArray(projects.body), true);
  assert.equal(projects.body.length, 1);
  const adminProjectId = projects.body[0].id;

  const savedExpressions = await requestJson('/api/saved-expressions', { headers: authHeaders });
  assert.equal(savedExpressions.response.status, 200);
  assert.equal(Array.isArray(savedExpressions.body), true);
  assert.equal(savedExpressions.body.length, 1);

  const createdExpression = await requestJson('/api/saved-expressions', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Quadratic',
      rawExpression: 'x^2 + 2*x + 1',
      latexExpression: 'x^2 + 2x + 1'
    })
  });
  assert.equal(createdExpression.response.status, 200);
  assert.equal(createdExpression.body.userId, 'admin');

  const updatedExpression = await requestJson(`/api/saved-expressions/${createdExpression.body.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Updated Quadratic' })
  });
  assert.equal(updatedExpression.response.status, 200);
  assert.equal(updatedExpression.body.name, 'Updated Quadratic');

  const register = await requestJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: 'test-user',
      email: 'test@example.com',
      password: 'strong-password'
    })
  });
  assert.equal(register.response.status, 200);

  const secondUserHeaders = { Authorization: `Bearer ${register.body.token}` };
  const secondUserProjects = await requestJson('/api/projects', { headers: secondUserHeaders });
  assert.equal(secondUserProjects.response.status, 200);
  assert.deepEqual(secondUserProjects.body, []);

  const secondUserCannotDeleteExpression = await requestJson(`/api/saved-expressions/${createdExpression.body.id}`, {
    method: 'DELETE',
    headers: secondUserHeaders
  });
  assert.equal(secondUserCannotDeleteExpression.response.status, 404);

  const createdProject = await requestJson('/api/projects', {
    method: 'POST',
    headers: secondUserHeaders,
    body: JSON.stringify({ name: 'Private Test Project', description: 'Owned by the second user.' })
  });
  assert.equal(createdProject.response.status, 200);
  assert.equal(createdProject.body.name, 'Private Test Project');

  const secondUserCannotAttachGraphToAdminProject = await requestJson('/api/graph-configurations', {
    method: 'POST',
    headers: secondUserHeaders,
    body: JSON.stringify({
      projectId: adminProjectId,
      name: 'Unauthorized Graph',
      config: { expressions: ['sin(x)'] }
    })
  });
  assert.equal(secondUserCannotAttachGraphToAdminProject.response.status, 404);

  const createdGraph = await requestJson('/api/graph-configurations', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectId: adminProjectId,
      name: 'Admin Graph',
      config: { expressions: ['sin(x)'], viewport: { xMin: -10, xMax: 10 } }
    })
  });
  assert.equal(createdGraph.response.status, 200);
  assert.equal(createdGraph.body.projectId, adminProjectId);

  const updatedGraph = await requestJson(`/api/graph-configurations/${createdGraph.body.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Updated Admin Graph' })
  });
  assert.equal(updatedGraph.response.status, 200);
  assert.equal(updatedGraph.body.name, 'Updated Admin Graph');

  const createdShare = await requestJson('/api/shared-workspaces', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectId: adminProjectId,
      sharedWithEmail: 'test@example.com',
      role: 'viewer'
    })
  });
  assert.equal(createdShare.response.status, 200);
  assert.equal(createdShare.body.sharedWithEmail, 'test@example.com');
  assert.equal(createdShare.body.role, 'viewer');

  const updatedShare = await requestJson(`/api/shared-workspaces/${createdShare.body.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ role: 'editor' })
  });
  assert.equal(updatedShare.response.status, 200);
  assert.equal(updatedShare.body.role, 'editor');

  const outgoingShares = await requestJson('/api/shared-workspaces/outgoing', { headers: authHeaders });
  assert.equal(outgoingShares.response.status, 200);
  assert.equal(outgoingShares.body.length, 1);

  const incomingShares = await requestJson('/api/shared-workspaces/incoming', { headers: secondUserHeaders });
  assert.equal(incomingShares.response.status, 200);
  assert.equal(incomingShares.body.length, 1);
  assert.equal(incomingShares.body[0].projectId, adminProjectId);

  const deletedShare = await requestJson(`/api/shared-workspaces/${createdShare.body.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.equal(deletedShare.response.status, 200);

  const incomingAfterDelete = await requestJson('/api/shared-workspaces/incoming', { headers: secondUserHeaders });
  assert.equal(incomingAfterDelete.response.status, 200);
  assert.deepEqual(incomingAfterDelete.body, []);

  const deletedExpression = await requestJson(`/api/saved-expressions/${createdExpression.body.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.equal(deletedExpression.response.status, 200);

  const deletedGraph = await requestJson(`/api/graph-configurations/${createdGraph.body.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.equal(deletedGraph.response.status, 200);

  const anonymousHistory = await requestJson('/api/history');
  assert.equal(anonymousHistory.response.status, 200);
  assert.deepEqual(anonymousHistory.body, []);

  const savedHistory = await requestJson('/api/history', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ type: 'polynomial', input: 'x^2', output: '2*x' })
  });
  assert.equal(savedHistory.response.status, 200);
  assert.equal(savedHistory.body.userId, 'admin');

  const userHistory = await requestJson('/api/history', { headers: authHeaders });
  assert.equal(userHistory.response.status, 200);
  assert.equal(userHistory.body[0].input, 'x^2');

  const polynomialIntegral = await requestJson('/api/math/polynomial', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ expression: 'x^2 + 2*x + 1', operation: 'integrate', variable: 'x' })
  });
  assert.equal(polynomialIntegral.response.status, 200);
  assert.match(polynomialIntegral.body.output, /x\^3/);
  assert.match(polynomialIntegral.body.output, /x\^2/);

  const polynomialDivision = await requestJson('/api/math/polynomial', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ expression: 'x^2 - 1', operand2: 'x - 1', operation: 'divide', variable: 'x' })
  });
  assert.equal(polynomialDivision.response.status, 200);
  assert.match(polynomialDivision.body.output, /Quotient: x \+ 1/);
  assert.match(polynomialDivision.body.output, /Remainder: 0/);

  const polynomialFactor = await requestJson('/api/math/polynomial', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ expression: 'x^2 - 5*x + 6', operation: 'factor', variable: 'x' })
  });
  assert.equal(polynomialFactor.response.status, 200);
  assert.match(polynomialFactor.body.output, /\(x - 2\)/);
  assert.match(polynomialFactor.body.output, /\(x - 3\)/);

  const algebraFactor = await requestJson('/api/math/algebra', {
    method: 'POST',
    body: JSON.stringify({ expression: 'x^2 + 4*x - 12', operation: 'factor', variable: 'x' })
  });
  assert.equal(algebraFactor.response.status, 200);
  assert.match(algebraFactor.body.output, /\(x - 2\)/);
  assert.match(algebraFactor.body.output, /\(x \+ 6\)/);

  const unsafeExpression = await requestJson('/api/math/polynomial', {
    method: 'POST',
    body: JSON.stringify({ expression: 'import(1)', operation: 'simplify', variable: 'x' })
  });
  assert.equal(unsafeExpression.response.status, 400);
  assert.match(unsafeExpression.body.error, /not allowed/i);

  const invalidMatrix = await requestJson('/api/math/matrix', {
    method: 'POST',
    body: JSON.stringify({ operation: 'determinant', matrixA: [[1, 2, 3], [4, 5, 6]] })
  });
  assert.equal(invalidMatrix.response.status, 400);
  assert.match(invalidMatrix.body.error, /square/i);

  const derivative = await requestJson('/api/math/polynomial', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ expression: 'x^2 + 2*x + 1', operation: 'derivative', variable: 'x' })
  });
  assert.equal(derivative.response.status, 200);
  assert.equal(derivative.response.headers.get('x-mathlab-cache'), 'MISS');
  assert.match(derivative.body.output, /x \+ 1/);

  const cachedDerivative = await requestJson('/api/math/polynomial', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ variable: 'x', operation: 'derivative', expression: 'x^2 + 2*x + 1' })
  });
  assert.equal(cachedDerivative.response.status, 200);
  assert.equal(cachedDerivative.response.headers.get('x-mathlab-cache'), 'HIT');
  assert.equal(cachedDerivative.body.output, derivative.body.output);

  await waitForAuditLog(authHeaders, logs =>
    logs.some(log => log.resource === 'saved-expressions' && log.action === 'create') &&
    logs.some(log => log.resource === 'math.polynomial' && log.action === 'calculate')
  );

  assert.equal(evaluateCellValue({ A1: '2', B1: '3', C1: '=A1+B1*2' }, 'C1'), '8.000');
  assert.equal(evaluateCellValue({ A1: '=process.exit()' }, 'A1'), '#VALUE!');
  assert.equal(evaluateCellValue({ A1: '=Z9+1' }, 'A1'), '#REF!');

  console.log('api smoke tests passed');
}

try {
  await run();
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (!error || (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
        resolve();
      } else {
        reject(error);
      }
    });
  });
  fs.rmSync(dbFile, { force: true });
}
