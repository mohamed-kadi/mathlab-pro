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

  const projects = await requestJson('/api/projects', { headers: authHeaders });
  assert.equal(projects.response.status, 200);
  assert.equal(Array.isArray(projects.body), true);
  assert.equal(projects.body.length, 1);

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

  const createdProject = await requestJson('/api/projects', {
    method: 'POST',
    headers: secondUserHeaders,
    body: JSON.stringify({ name: 'Private Test Project', description: 'Owned by the second user.' })
  });
  assert.equal(createdProject.response.status, 200);
  assert.equal(createdProject.body.name, 'Private Test Project');

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

  const derivative = await requestJson('/api/math/polynomial', {
    method: 'POST',
    body: JSON.stringify({ expression: 'x^2 + 2*x + 1', operation: 'derivative', variable: 'x' })
  });
  assert.equal(derivative.response.status, 200);
  assert.match(derivative.body.output, /x \+ 1/);

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
