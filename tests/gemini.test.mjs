// Selbsttest für die Gemini-Anbindung (ohne echtes Netz): node tests/gemini.test.mjs
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const calls = [];
let reply = () => ({ status: 200, body: {} });
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  const { status, body } = reply(url);
  return { ok: status < 300, status, json: async () => body };
};
const G = await import('../js/gemini.js');
const answer = text => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } });

assert.equal(G.cleanAnswer('```text\n**wichtig** ist das\n```\n'), 'wichtig ist das');

// Ohne Schlüssel keine Anfrage
await assert.rejects(G.generate({ system: 's', parts: [G.textPart('x')] }), /Noch kein Schlüssel/);
assert.equal(calls.length, 0);

// Schlüssel speichern: prüft bei Google und merkt ein Flash-Modell
reply = () => ({ status: 200, body: { models: [
  { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] } });
await G.saveKey('AIzaTEST');
assert.ok(G.hasKey());
assert.equal(mem.get('gemini-modell'), 'gemini-flash-latest');

// Dateien gehen als inline_data mit, Schlüssel nur im Kopf; JSON-Antwort wird gelesen (auch in Codeblock)
reply = () => answer('```json\n[{"page":1,"box_2d":[1,2,3,4],"text":"Zucker"}]\n```');
const out = await G.generate({ system: 'Füllen', parts: [G.textPart('Seite 1:'), G.filePart('image/jpeg', 'QUJD')], json: true });
assert.deepEqual(out, [{ page: 1, box_2d: [1, 2, 3, 4], text: 'Zucker' }]);
const c = calls.at(-1), body = JSON.parse(c.init.body);
assert.ok(!c.url.includes('AIzaTEST'), 'Schlüssel nicht in der Adresse');
assert.equal(c.init.headers['x-goog-api-key'], 'AIzaTEST');
assert.deepEqual(body.contents[0].parts[1], { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } });
assert.equal(body.generationConfig.responseMimeType, 'application/json');
assert.equal(body.systemInstruction.parts[0].text, 'Füllen');

// Zu große Anhänge werden vor dem Senden abgelehnt
calls.length = 0;
await assert.rejects(G.generate({ system: 's', parts: [G.filePart('application/pdf', 'A'.repeat(21e6))] }), /zu groß/);
assert.equal(calls.length, 0);

// Tageslimit beim Flash-Modell: einmal mit Lite, das danach gemerkt wird
reply = url => (url.includes('gemini-flash-latest:') ? { status: 429, body: { error: { message: 'quota' } } } : answer('ok'));
assert.equal(await G.generate({ system: 's', parts: [G.textPart('x')] }), 'ok');
assert.equal(mem.get('gemini-modell'), 'gemini-flash-lite-latest');

// Überlastet (503): zweimal warten und wiederholen, dann mit dem anderen Modell; Erfolg dort
G.RETRY_MS[0] = G.RETRY_MS[1] = 1;
mem.set('gemini-modell', 'gemini-flash-latest');
calls.length = 0;
reply = url => (url.includes('gemini-flash-latest:') ? { status: 503, body: { error: { message: 'overloaded' } } } : answer('geschafft'));
assert.equal(await G.generate({ system: 's', parts: [G.textPart('x')] }), 'geschafft');
assert.deepEqual(calls.map(k => k.url.match(/models\/([^:]+)/)[1]), ['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
// Beide Modelle überlastet: verständliche Meldung mit Fehlercode
reply = () => ({ status: 503, body: { error: { message: 'overloaded' } } });
await assert.rejects(G.generate({ system: 's', parts: [G.textPart('x')] }), /überlastet \(Fehler 503\)/);
mem.set('gemini-modell', 'gemini-flash-latest');

// Verständliche Fehler, kaputtes JSON
reply = () => ({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
await assert.rejects(G.generate({ system: 's', parts: [G.textPart('x')] }), /Schlüssel ist ungültig/);
reply = () => answer('[{"page":1, "box');
await assert.rejects(G.generate({ system: 's', parts: [G.textPart('x')], json: true }), /unvollständig/);
reply = () => ({ status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } });
await assert.rejects(G.generate({ system: 's', parts: [G.textPart('x')] }), /Inhaltsfilter/);

G.forgetKey();
assert.ok(!G.hasKey());
console.log('OK – Gemini');
