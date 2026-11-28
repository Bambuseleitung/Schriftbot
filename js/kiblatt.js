// KI-Hilfe beim „PDF ausfüllen“ (Beta): Gemini mit dem eigenen Schlüssel füllt das ganze Blatt aus oder ein
// einzelnes Feld. Das geöffnete Blatt geht immer mit; weiteres Material (PDF, Foto, Text) hängt man einmal an,
// es bleibt auf dem Gerät (IndexedDB) und wird per Häkchen für jedes Blatt wiederverwendet.
import { hasKey, saveKey as saveGeminiKey, forgetKey, generate, textPart, filePart, partsBytes, MAX_BYTES } from './gemini.js';
import { loadKey, saveKey } from './storage.js';
import { ask, info, askLongText, choose } from './dialog.js';

const STORE = 'ki-material';
const RULES = 'Schreibe auf Deutsch, so knapp wie eine Schülerin oder ein Schüler es von Hand täte. Keine Emojis, kein Markdown, keine Aufzählungszeichen mit Sternchen.';
const FILL = 'Du hilfst, ein Arbeitsblatt auszufüllen. Du bekommst die Seiten als Bilder und optional Material. ' +
  'Finde jede Aufgabe, die eine schriftliche Antwort braucht, und die freie Stelle dafür (Linie, Lücke oder Kasten), die noch leer ist. ' +
  'Antworte nur mit einem JSON-Array: [{"page": Seitennummer ab 1, "box_2d": [ymin, xmin, ymax, xmax], "text": "Antwort"}]. ' +
  'box_2d ist die freie Stelle für die Antwort (nicht die Frage), normiert auf 0 bis 1000 der Seite. Nutze das Material, wenn es passt. ' + RULES;
const FIELD = 'Du hilfst, eine einzelne Stelle auf einem Arbeitsblatt auszufüllen. Du bekommst die Seite als Bild, die Lage der Stelle ' +
  '(box_2d: ymin, xmin, ymax, xmax, normiert 0 bis 1000) und optional Material. Antworte nur mit dem Text, der an diese Stelle gehört. ' + RULES;

const kindOf = mime => (mime === 'application/pdf' ? 'pdf' : mime.startsWith('image/') ? 'image' : 'text');
const ICON = { pdf: 'i-file', image: 'i-image', text: 'i-clipboard' };
const uid = () => Math.random().toString(36).slice(2, 10);

// Datei → Base64; Fotos verkleinert als JPEG (längste Seite 2000 px)
async function toPart(file) {
  if (file.type === 'application/pdf') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { mime: 'application/pdf', data: btoa(bin) };
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const url = c.toDataURL('image/jpeg', 0.85);
  c.width = c.height = 0;
  return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

// ai: Schnittstelle aus blattui.js; insertIntoField: Text ins gewählte Feld
export function initKiBlatt({ ai, insertIntoField }) {
  const $ = id => document.getElementById(id);
  const list = $('ki-material'), fileInput = $('ki-file'), dlg = $('ki-setup'), keyInput = $('ki-key');
  let material = [];

  // ---------- „NEU“ am Tab, bis man ihn einmal geöffnet hat ----------
  const NEW_KEY = 'neu-pdf-ki-gesehen';
  const hideNew = on => { $('tab-new').toggleAttribute('hidden', on); $('tab-new-sr').hidden = on; }; // SVG: Attribut statt .hidden
  try { hideNew(!!localStorage.getItem(NEW_KEY)); } catch {}
  $('tab-blatt').addEventListener('click', () => { hideNew(true); try { localStorage.setItem(NEW_KEY, '1'); } catch {} });

  // ---------- Material ----------
  const save = () => saveKey(STORE, material).catch(() => info('Das Material konnte nicht gespeichert werden (Speicher voll?).'));
  function render() {
    list.replaceChildren(...material.map(m => {
      const row = document.createElement('div');
      row.className = 'ki-mat';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = m.on;
      box.setAttribute('aria-label', `${m.name} mitschicken`);
      box.addEventListener('change', () => { m.on = box.checked; save(); });
      const name = document.createElement('span');
      name.className = 'ki-mat-name';
      name.textContent = m.name;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn ghost';
      del.setAttribute('aria-label', `${m.name} entfernen`);
      del.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg>';
      del.addEventListener('click', async () => {
        if (!await ask(`„${m.name}“ aus dem Material entfernen?`, { ok: 'Entfernen', danger: true })) return;
        material = material.filter(x => x !== m);
        save();
        render();
      });
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<use href="#${ICON[m.kind]}"/>`;
      const label = document.createElement('label');
      label.append(box, icon, name);
      row.append(label, del);
      return row;
    }));
  }
  loadKey(STORE).then(v => { material = Array.isArray(v) ? v : []; render(); }).catch(() => {});

  $('ki-attach').addEventListener('click', async () => {
    const what = await choose('', [{ label: 'PDF oder Foto', value: 'file', primary: true }, { label: 'Text einfügen', value: 'text' }], { title: 'Material anhängen' });
    if (what === 'file') fileInput.click();
    if (what === 'text') {
      const t = await askLongText('Text als Material', { placeholder: 'z. B. Notizen, Aufgabenstellung oder Merksätze' });
      if (t) { material.push({ id: uid(), name: t.name, kind: 'text', text: t.text, on: true }); save(); render(); }
    }
  });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    for (const file of files) {
      if (file.size > 10e6) { info(`„${file.name}“ ist größer als 10 MB und kann nicht mitgeschickt werden.`); continue; }
      // Schon angehängt? Dann nicht doppelt
      if (material.some(m => m.name === file.name && m.size === file.size)) continue;
      try {
        const { mime, data } = await toPart(file);
        material.push({ id: uid(), name: file.name, kind: kindOf(mime), mime, data, size: file.size, on: true });
      } catch (err) {
        info(`„${file.name}“ konnte nicht gelesen werden: ${err.message}`);
      }
    }
    save();
    render();
  });
  const materialParts = () => material.filter(m => m.on).flatMap(m => (m.kind === 'text'
    ? [textPart(`Material „${m.name}“:\n${m.text}`)]
    : [textPart(`Material „${m.name}“:`), filePart(m.mime, m.data)]));

  // ---------- Schlüssel ----------
  const openSetup = () => {
    keyInput.value = '';
    $('ki-setup-status').textContent = '';
    $('ki-delete').hidden = !hasKey();
    dlg.showModal();
  };
  $('ki-key-menu').addEventListener('click', openSetup);
  $('ki-more').addEventListener('click', openSetup);
  $('ki-save').addEventListener('click', async () => {
    const key = keyInput.value.trim(), st = $('ki-setup-status');
    if (!key) { st.textContent = 'Bitte zuerst den Schlüssel einfügen.'; return keyInput.focus(); }
    st.textContent = 'Prüfe den Schlüssel bei Google …';
    try {
      await saveGeminiKey(key);
      dlg.close();
      info('Fertig – die KI-Hilfe ist eingerichtet.');
    } catch (err) { st.textContent = err.message; }
  });
  $('ki-delete').addEventListener('click', async () => {
    if (!await ask('Den Gemini-Schlüssel von diesem Gerät löschen?', { ok: 'Löschen', danger: true })) return;
    forgetKey();
    dlg.close();
  });

  // ---------- Ausfüllen ----------
  async function run(label, work) {
    if (!hasKey()) return openSetup();
    if (!ai.hasSheet()) return info('Öffne zuerst ein PDF oder Foto.');
    ai.setBusy(true);
    ai.status(label);
    try {
      ai.status(await work());
    } catch (err) {
      ai.status('');
      info(err.message);
    } finally {
      ai.setBusy(false);
    }
  }
  async function sheetParts(onlyPage) {
    const imgs = await ai.pageImages();
    return imgs.flatMap((data, i) => (onlyPage && onlyPage !== i + 1 ? [] : [textPart(`Arbeitsblatt „${ai.sheetName()}“, Seite ${i + 1}:`), filePart('image/jpeg', data)]));
  }
  $('ki-fill').addEventListener('click', () => run('Gemini liest das Blatt …', async () => {
    const parts = [...await sheetParts(), ...materialParts()];
    if (partsBytes(parts) > MAX_BYTES) throw new Error('Blatt und Material sind zusammen zu groß (über 15 MB). Nimm weniger Material mit.');
    const items = await generate({ system: FILL, parts, json: true, temperature: 0.3 });
    const n = ai.addAiFields(items);
    return n ? `${n} ${n === 1 ? 'Antwort' : 'Antworten'} eingetragen (Beta) – bitte prüfen und Felder bei Bedarf verschieben.`
      : 'Keine freie Stelle gefunden. Tippe auf eine Stelle und nutze „KI-Antwort“.';
  }));
  const field = how => run('Gemini schreibt …', async () => {
    const f = ai.selectedBox();
    if (!f) throw new Error('Tippe zuerst ein Feld an.');
    if (how !== 'neu' && how !== 'antwort' && !f.text.trim()) throw new Error('Das Feld ist noch leer.');
    const task = how === 'kuerzer' ? `Kürze die bisherige Antwort deutlich: „${f.text}“`
      : how === 'neu' ? `Schreibe eine andere Antwort als bisher${f.text.trim() ? `: „${f.text}“` : '.'}` : 'Schreibe die Antwort.';
    const parts = [...await sheetParts(f.page), ...materialParts(), textPart(`Stelle: Seite ${f.page}, box_2d ${JSON.stringify(f.box_2d)}. ${task}`)];
    insertIntoField(await generate({ system: FIELD, parts, temperature: how === 'neu' ? 0.9 : 0.4 }));
    return 'Antwort eingetragen (Beta) – bitte prüfen.';
  });
  $('field-ki').addEventListener('click', () => field('antwort'));
  $('field-ki-short').addEventListener('click', () => field('kuerzer'));
  $('field-ki-new').addEventListener('click', () => field('neu'));
}
