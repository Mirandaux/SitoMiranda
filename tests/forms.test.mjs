import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as sprint } from '../src/pages/api/contact-fit-sprint.js';
import { POST as matrix } from '../src/pages/api/download-matrix.js';
import { guardFormRequest } from '../src/lib/form-guard.js';
const payload = { nome: '<b>Nome</b>', azienda: '<a href="bad">Azienda</a>', email: 'audit@example.invalid', decisione: 'Altro', problema: '<img src=x>Problema di prova', privacy_consent: true };
const request = (body) => new Request('https://example.test/api/contact-fit-sprint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('consent validation, escaped email and delivery-only matrix', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.BREVO_API_KEY;
  const previousList = process.env.BREVO_MKT_LIST_ID;
  const calls = [];
  process.env.BREVO_API_KEY = 'test-placeholder';
  process.env.BREVO_MKT_LIST_ID = '99';
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return Response.json({}, { status: 201 }); };
  try {
    for (const consent of [false, 'false', 'true', 1, null]) {
      assert.equal((await sprint({ request: request({ ...payload, privacy_consent: consent }) })).status, 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await sprint({ request: request({ ...payload, marketing_consent: 'false' }) })).status, 200);
    assert(!calls[0].listIds.includes(99));
    assert(calls[1].htmlContent.includes('&lt;b&gt;Nome&lt;/b&gt;'));
    assert(!calls[1].htmlContent.includes('<img src=x>'));
    calls.length = 0;
    await sprint({ request: request({ ...payload, marketing_consent: true }) });
    assert(calls[0].listIds.includes(99));
    calls.length = 0;
    assert.equal((await matrix({ request: request({ email: 'audit@example.invalid' }) })).status, 200);
    assert.deepEqual(calls[0].listIds, []);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of [['BREVO_API_KEY', previousKey], ['BREVO_MKT_LIST_ID', previousList]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('reject cross-origin requests and limit bursts, then allow after expiry', () => {
  const cross = new Request('https://example.test/api/contact', { method: 'POST', headers: { origin: 'https://other.test' } });
  assert.equal(guardFormRequest(cross, 'test-client', 0).status, 403);
  const req = new Request('https://example.test/api/contact', { method: 'POST', headers: { origin: 'https://example.test' } });
  for (let i = 0; i < 10; i++) assert.equal(guardFormRequest(req, 'test-client', 0), null);
  const limited = guardFormRequest(req, 'test-client', 0);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '600');
  assert.equal(guardFormRequest(req, 'test-client', 600001), null);
});
