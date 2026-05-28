import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo, Server } from "node:net";

type JsonObject = Record<string, unknown>;

interface GoldenCase {
  id: string;
  endpoint: string;
  request: JsonObject;
  expected: {
    status: number;
    outputIncludes?: string[];
    stepsMin?: number;
    numeric?: Array<{ path: string; value: number; tolerance: number }>;
  };
}

function getPath(value: unknown, dottedPath: string) {
  return dottedPath.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    if (typeof current === "object") return (current as JsonObject)[segment];
    return undefined;
  }, value);
}

async function startServer() {
  const dbFile = path.join(os.tmpdir(), `mathlab-pro-golden-${process.pid}-${Date.now()}.json`);
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "mathlab-pro-golden-test-secret";
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
        server.close(error => error ? reject(error) : resolve());
      });
      fs.rmSync(dbFile, { force: true });
    }
  };
}

const corpus = JSON.parse(fs.readFileSync("tests/math-engine-golden.json", "utf8")) as { cases: GoldenCase[] };
const target = await startServer();

try {
  for (const testCase of corpus.cases) {
    const response = await fetch(`${target.baseUrl}${testCase.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testCase.request)
    });
    const body = await response.json() as JsonObject;
    assert.equal(response.status, testCase.expected.status, `${testCase.id} status`);

    if (testCase.expected.outputIncludes) {
      assert.equal(typeof body.output, "string", `${testCase.id} output must be a string`);
      for (const expectedText of testCase.expected.outputIncludes) {
        assert.match(body.output as string, new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${testCase.id} output`);
      }
    }

    if (testCase.expected.stepsMin !== undefined) {
      assert.equal(Array.isArray(body.steps), true, `${testCase.id} steps must be an array`);
      assert.ok((body.steps as unknown[]).length >= testCase.expected.stepsMin, `${testCase.id} steps length`);
    }

    for (const numeric of testCase.expected.numeric || []) {
      const actual = getPath(body, numeric.path);
      assert.equal(typeof actual, "number", `${testCase.id} ${numeric.path} must be numeric`);
      assert.ok(
        Math.abs((actual as number) - numeric.value) <= numeric.tolerance,
        `${testCase.id} ${numeric.path}: expected ${numeric.value}, got ${actual}`
      );
    }
  }

  console.log(`math engine golden tests passed (${corpus.cases.length} cases)`);
} finally {
  await target.close();
}
