import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs
  .readFileSync(new URL('../src/auth/client.ts', import.meta.url), 'utf8')
  .replace("import { auth } from './firebase';", 'const auth = globalThis.__testAuth;')
  .replace('import.meta.env.VITE_API_BASE_URL', "''");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('auth client refreshes once, bounds retries, and rejects changed sessions', async () => {
  const originalFetch = globalThis.fetch;
  const refreshes = [];
  globalThis.__testAuth = {
    currentUser: {
      uid: 'fan-1',
      getIdToken: async (refresh) => {
        refreshes.push(refresh);
        return refresh ? 'new-token' : 'token';
      },
    },
  };
  const client = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  try {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, ...options });
      return requests.length === 1
        ? { status: 401, ok: false }
        : { ok: true, json: async () => ({ id: 1 }) };
    };
    assert.deepEqual(await client.accountRequest('POST'), { id: 1 });
    assert.deepEqual(refreshes, [false, true]);
    assert.equal(requests[0].url, '/api/v1/users/me');
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[1].headers.Authorization, 'Bearer new-token');
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return { status: 401, ok: false };
    };
    await assert.rejects(client.accountRequest(), /session has expired/);
    assert.equal(attempts, 2);
    globalThis.fetch = async () => {
      globalThis.__testAuth.currentUser = null;
      return { ok: true, json: async () => ({ id: 1 }) };
    };
    await assert.rejects(client.accountRequest(), /session changed/);
    await assert.rejects(client.accountRequest(), /sign in again/);
    assert.match(client.authMessage({ code: 'auth/popup-blocked' }), /Allow popups/);
    assert.match(
      client.authMessage({ code: 'auth/account-exists-with-different-credential' }),
      /originally used/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__testAuth;
  }
});
