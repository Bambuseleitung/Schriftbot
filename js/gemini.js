// Google Gemini mit dem eigenen, kostenlosen Schlüssel des Nutzers (Beta).
// Der Schlüssel bleibt nur auf diesem Gerät (localStorage, nicht in Sicherungen); Anfragen gehen direkt vom
// Gerät an Google, nie über DeineSchrift. Anleitung zum Schlüssel: gemini-schluessel.html
const KEY = 'gemini-key', MODEL = 'gemini-modell';
const API = 'https://generativelanguage.googleapis.com/v1beta';
// Bevorzugt die schnellen Flash-Modelle (im kostenlosen Kontingent); Lite als Ausweich bei erreichtem Limit
const PREFER = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
export const MAX_BYTES = 15e6; // Google nimmt höchstens ~20 MB je Anfrage; Luft für Base64 und Text lassen

const store = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};
export const hasKey = () => !!store.get(KEY);
export const forgetKey = () => { store.set(KEY, ''); store.set(MODEL, ''); };

// Verständliche Fehlermeldung zu einer Antwort der Gemini-API
export function errorText(status, message = '') {
  if (status === 400 && /api key|API_KEY/i.test(message)) return 'Der Schlüssel ist ungültig. Prüfe, ob du ihn vollständig kopiert hast.';
  if (status === 400 && /size|too large|exceeds/i.test(message)) return 'Die Dateien sind zu groß für eine Anfrage. Nimm weniger Material mit.';
  if (status === 401 || status === 403) return 'Google lehnt den Schlüssel ab (kein Zugriff). Erstelle in Google AI Studio einen neuen Schlüssel.';
  if (status === 429) return 'Das kostenlose Tageslimit deines Schlüssels ist erreicht. Morgen geht es wieder.';
  if (status >= 500) return 'Gemini ist gerade überlastet. Versuch es in einer Minute noch einmal.';
  return 'Die KI hat nicht geantwortet' + (message ? `: ${message}` : '.');
}

async function request(path, key, body) {
  let res;
  try {
    res = await fetch(`${API}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Object.assign(new Error('Keine Verbindung zu Google. Bist du online?'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(errorText(res.status, data?.error?.message)), { status: res.status });
  return data;
}

// Schlüssel prüfen und ein passendes Modell wählen (Google ändert die Modellnamen von Zeit zu Zeit)
async function chooseModel(key) {
  const data = await request('models?pageSize=200', key);
  const names = (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  return PREFER.find(n => names.includes(n)) || names.find(n => /flash/.test(n) && !/image|tts|audio|live|embed/.test(n)) || names[0];
}
export async function saveKey(key) {
  const model = await chooseModel(key);
  if (!model) throw new Error('Mit diesem Schlüssel ist kein passendes Modell verfügbar.');
  store.set(KEY, key);
  store.set(MODEL, model);
}

// Teile einer Anfrage: Text oder Datei (Base64)
export const textPart = text => ({ text });
export const filePart = (mime, data) => ({ inline_data: { mime_type: mime, data } });
export const partsBytes = parts => parts.reduce((n, p) => n + (p.inline_data ? p.inline_data.data.length * 0.75 : (p.text || '').length), 0);

// Anfrage stellen; json: Antwort als JSON lesen. Gibt Text oder das gelesene JSON zurück.
export async function generate({ system, parts, json = false, temperature = 0.4 }) {
  const key = store.get(KEY);
  if (!key) throw new Error('Noch kein Schlüssel eingetragen.');
  if (partsBytes(parts) > MAX_BYTES) throw new Error('Die Dateien sind zusammen zu groß (über 15 MB). Nimm weniger Material mit.');
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  let model = store.get(MODEL) || PREFER[0];
  const call = mdl => request(`models/${mdl}:generateContent`, key, body);
  let data;
  try {
    data = await call(model);
  } catch (err) {
    // Limit beim großen Modell erreicht oder Modell weg: einmal mit dem anderen versuchen
    if (err.status !== 429 && err.status !== 404) throw err;
    model = err.status === 404 ? await chooseModel(key) : PREFER.find(n => n !== model) || model;
    store.set(MODEL, model);
    data = await call(model);
  }
  const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!out) throw new Error(data.promptFeedback?.blockReason ? 'Google hat die Anfrage abgelehnt (Inhaltsfilter).' : 'Die KI hat keinen Text geliefert.');
  if (!json) return cleanAnswer(out);
  try { return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Die Antwort der KI war unvollständig. Versuch es noch einmal.'); }
}

// Antwort aufräumen: Codeblöcke, Fettdruck und Leerzeilen am Rand entfernen
export function cleanAnswer(text) {
  return String(text || '').replace(/^```\w*\n?|```$/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s+|\s+$/g, '');
}
