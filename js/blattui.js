// Modul 4: Arbeitsblatt. PDF oder Foto öffnen, blaue Antworten werden erkannt, vom Blatt entfernt und
// an derselben Stelle in Handschrift gesetzt. Felder lassen sich verschieben, in der Größe ziehen und neu aufziehen.
import { detect, layoutField, eraseBlue, aiFields } from './blatt.js';
import { importFile } from './pdfimport.js';
import { current, options, inkColor } from './schreiben.js';
import { drawPage } from './render.js';
import { buildPdf, buildPng, shareFiles } from './export.js';
import { buildGoodnotes } from './goodnotes.js';
import { loadKey, saveKey } from './storage.js';
import { ask, info as showInfo } from './dialog.js';

const MIN_W = 12, MIN_H = 6; // kleinstes Feld in mm
const newSeed = () => Math.floor(Math.random() * 2 ** 31);
const uid = () => Math.random().toString(36).slice(2, 10);

export function initBlatt(profile) {
  const $ = id => document.getElementById(id);
  const stage = $('sheet-pages'), statusEl = $('sheet-status'), info = $('sheet-info');
  const editor = $('field-editor'), textEl = $('field-text'), autoEl = $('field-auto');
  const sizeEl = $('field-size'), sizeOut = $('field-size-out'), drawBtn = $('sheet-draw');
  const fileInput = $('sheet-file'), shareAgain = $('sheet-share-again');

  let sheet = null;   // { name, pages: [{ blob, w, h, dpmm }] }
  let fields = [];    // [{ id, page, x, y, w, h, text, auto, xHeight, seed, erase }] in mm (erase in Pixeln)
  let clean = [];     // je Seite: Canvas ohne die blauen Antworten, deren Feld noch existiert
  let views = [];     // je Seite: { wrap, canvas, overlay }
  let selected = null, drawMode = false, pending = null;
  const cache = new Map(); // Layout je Feld (ohne Position) → beim Verschieben nicht neu setzen

  // ---------- Laden & Speichern ----------
  let saveTimer;
  const saveFields = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveKey('blatt-felder', fields).catch(() => {}), 300);
  };

  async function restore() {
    try {
      const [s, f] = await Promise.all([loadKey('blatt'), loadKey('blatt-felder')]);
      if (!s?.pages?.length) return;
      sheet = s;
      fields = f || [];
      clean = await Promise.all(sheet.pages.map((_, i) => compose(i)));
      build();
    } catch (err) {
      statusEl.textContent = 'Gespeichertes Blatt konnte nicht geladen werden: ' + err.message;
    }
  }

  // Seite ohne die blauen Antworten der vorhandenen Felder (gelöschtes Feld → blauer Text kommt zurück).
  async function compose(i) {
    const pg = sheet.pages[i];
    const bmp = await createImageBitmap(pg.blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const erase = fields.filter(f => f.page === i && f.erase);
    if (erase.length) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (const f of erase) eraseBlue(img, f.erase);
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  }

  // ---------- Öffnen ----------
  $('sheet-open').addEventListener('click', () => fileInput.click());
  $('sheet-open-empty').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (sheet && !await ask('Das aktuelle Blatt mit seinen Feldern wird ersetzt. Weiter?', { ok: 'Ersetzen' })) return;
    const pages = [], found = [], canvases = [];
    setBusy(true);
    try {
      const total = await importFile(file, async ({ canvas, w, h, dpmm, items, index, count }) => {
        statusEl.textContent = `Lese Seite ${index + 1} von ${count} …`;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = detect(img, dpmm, items);
        for (const f of res.fields) found.push({ id: uid(), page: index, ...f, auto: true, seed: newSeed() });
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        pages.push({ blob, w, h, dpmm });
        ctx.putImageData(new ImageData(res.clean.data, canvas.width, canvas.height), 0, 0);
        canvases.push(canvas);
      });
      sheet = { name: file.name.replace(/\.[^.]+$/, ''), pages };
      fields = found;
      clean = canvases;
      cache.clear();
      selected = null;
      await saveKey('blatt', sheet);
      saveFields();
      build();
      const note = total > pages.length ? ` (nur die ersten ${pages.length} von ${total} Seiten)` : '';
      const empty = found.filter(f => !f.text).length;
      statusEl.textContent = found.length
        ? `${found.length} blaue ${found.length === 1 ? 'Antwort' : 'Antworten'} gefunden und in Handschrift gesetzt${note}.` +
          (empty ? ` ${empty} ohne lesbaren Text (z. B. Foto): Feld antippen und Text eintragen.` : '')
        : `Tippe auf die Stelle im Blatt, an die deine Antwort soll${note}.`;
    } catch (err) {
      statusEl.textContent = 'Datei konnte nicht gelesen werden: ' + err.message;
    } finally {
      setBusy(false);
    }
  });

  function setBusy(on) {
    for (const b of document.querySelectorAll('#view-blatt button')) b.disabled = on;
  }

  // ---------- Ansicht ----------
  function build() {
    stage.replaceChildren();
    views = sheet.pages.map((pg, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'sheet-page';
      wrap.style.aspectRatio = `${pg.w} / ${pg.h}`;
      const canvas = document.createElement('canvas');
      const overlay = document.createElement('div');
      overlay.className = 'sheet-overlay';
      overlay.dataset.page = i;
      wrap.append(canvas, overlay);
      stage.append(wrap);
      return { wrap, canvas, overlay };
    });
    $('sheet-empty').hidden = true;
    $('view-blatt').classList.add('has-sheet');
    stage.hidden = false;
    info.textContent = `${sheet.name} · ${sheet.pages.length} ${sheet.pages.length === 1 ? 'Seite' : 'Seiten'}`;
    renderAll();
    syncEditor();
  }

  const layoutOf = f => {
    const o = options(current());
    const key = JSON.stringify([f.text, f.w, f.h, f.auto, f.xHeight, f.seed, o]);
    let res = cache.get(f.id);
    if (res?.key !== key) {
      res = { key, ...layoutField({ ...f, x: 0, y: 0 }, profile, o, f.seed) };
      cache.set(f.id, res);
    }
    return res;
  };

  const queued = new Set();
  function renderPage(i) {
    if (queued.has(i)) return;
    queued.add(i);
    requestAnimationFrame(() => { queued.delete(i); drawPageView(i); });
  }
  function renderAll() { sheet?.pages.forEach((_, i) => renderPage(i)); }

  function drawPageView(i) {
    const v = views[i], pg = sheet.pages[i];
    const cssW = v.wrap.clientWidth;
    if (!cssW) return; // Tab nicht sichtbar
    const dpr = window.devicePixelRatio || 1;
    v.canvas.width = Math.round(cssW * dpr);
    v.canvas.height = Math.round(cssW * dpr * pg.h / pg.w);
    const ctx = v.canvas.getContext('2d');
    ctx.drawImage(clean[i], 0, 0, v.canvas.width, v.canvas.height);
    const k = v.canvas.width / pg.w, s = current();
    const color = inkColor(s), o = options(s), pen = o.penSize;
    for (const f of fields.filter(f => f.page === i)) {
      ctx.setTransform(k, 0, 0, k, f.x * k, f.y * k);
      drawPage(ctx, { items: layoutOf(f).items }, color, pen, o.pen);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawOverlay(i);
    updateStatus();
  }

  const pct = (v, total) => (v / total * 100) + '%';
  function drawOverlay(i) {
    const { overlay } = views[i], pg = sheet.pages[i];
    overlay.classList.toggle('drawing', drawMode);
    overlay.replaceChildren(...fields.filter(f => f.page === i).map(f => {
      const box = document.createElement('div');
      box.className = 'field-box';
      box.dataset.id = f.id;
      if (f.id === selected) box.classList.add('selected');
      if (layoutOf(f).overflow) box.classList.add('overflow');
      Object.assign(box.style, { left: pct(f.x, pg.w), top: pct(f.y, pg.h), width: pct(f.w, pg.w), height: pct(f.h, pg.h) });
      const tag = document.createElement('span');
      tag.className = 'field-tag';
      tag.textContent = String(fields.indexOf(f) + 1) + (f.text ? '' : ' · Text fehlt');
      const handle = document.createElement('span');
      handle.className = 'field-handle';
      handle.dataset.handle = 'resize';
      box.append(tag, handle);
      return box;
    }));
  }

  function updateStatus() {
    const miss = new Set(), over = [];
    fields.forEach((f, n) => {
      const r = layoutOf(f);
      r.missing.filter(c => c !== ' ').forEach(c => miss.add(c));
      if (r.overflow) over.push(n + 1);
    });
    const notes = [];
    if (miss.size) notes.push(`Noch nicht aufgenommen: ${[...miss].join(' ')}`);
    if (over.length) notes.push(`Zu viel Text für Feld ${over.join(', ')} – Feld größer ziehen`);
    $('sheet-warn').textContent = notes.join(' · ');
  }

  // ---------- Feld bearbeiten ----------
  const sel = () => fields.find(f => f.id === selected);
  function select(id) {
    selected = id;
    textEl.value = sel()?.text || ''; // auch wenn das Textfeld gerade aktiv ist
    syncEditor();
    renderAll();
  }
  function syncEditor() {
    const f = sel();
    editor.hidden = !f;
    $('field-none').hidden = !!f || !sheet;
    if (!f) return;
    $('field-title').textContent = `Feld ${fields.indexOf(f) + 1} · Seite ${f.page + 1}`;
    if (document.activeElement !== textEl) textEl.value = f.text;
    autoEl.checked = f.auto !== false;
    const xh = f.auto !== false ? layoutOf(f).xHeight : f.xHeight || options().xHeight;
    sizeEl.value = xh;
    sizeEl.disabled = f.auto !== false;
    sizeOut.textContent = xh.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' mm' + (f.auto !== false ? ' (automatisch)' : '');
  }
  const changed = f => { saveFields(); renderPage(f.page); };
  let typing;
  textEl.addEventListener('input', () => {
    const f = sel();
    if (!f) return;
    f.text = textEl.value;
    clearTimeout(typing);
    typing = setTimeout(() => { changed(f); requestAnimationFrame(syncEditor); }, 150);
  });
  autoEl.addEventListener('change', () => {
    const f = sel();
    if (!f) return;
    f.auto = autoEl.checked;
    if (!f.auto) f.xHeight = layoutOf(f).xHeight; // mit der passenden Größe weitermachen
    changed(f);
    syncEditor();
  });
  sizeEl.addEventListener('input', () => {
    const f = sel();
    if (!f) return;
    f.xHeight = +sizeEl.value;
    changed(f);
    syncEditor();
  });
  $('field-delete').addEventListener('click', async () => {
    const f = sel();
    if (!f) return;
    fields = fields.filter(x => x !== f);
    cache.delete(f.id);
    selected = null;
    if (f.erase) clean[f.page] = await compose(f.page); // blauer Text erscheint wieder
    saveFields();
    syncEditor();
    renderAll();
  });
  $('field-reroll').addEventListener('click', () => {
    const f = sel();
    if (!f) return;
    f.seed = newSeed();
    changed(f);
  });
  $('sheet-reroll').addEventListener('click', () => {
    fields.forEach(f => { f.seed = newSeed(); });
    saveFields();
    renderAll();
  });
  drawBtn.addEventListener('click', () => setDraw(!drawMode));
  function setDraw(on) {
    drawMode = on;
    drawBtn.setAttribute('aria-pressed', on);
    statusEl.textContent = on ? 'Auf dem Blatt ein Rechteck aufziehen, wo die Antwort hin soll.' : statusEl.textContent;
    views.forEach((_, i) => drawOverlay(i));
  }

  // ---------- Ziehen: verschieben, Größe ändern, neu aufziehen ----------
  let drag = null, tap = null;
  stage.addEventListener('pointerdown', e => {
    tap = null;
    const overlay = e.target.closest('.sheet-overlay');
    if (!overlay || !sheet) return;
    const i = +overlay.dataset.page, pg = sheet.pages[i];
    const rect = overlay.getBoundingClientRect(), mm = rect.width / pg.w;
    const at = ev => [(ev.clientX - rect.left) / mm, (ev.clientY - rect.top) / mm];
    const [x, y] = at(e);
    const box = e.target.closest('.field-box');
    if (drawMode && !e.target.dataset.handle) { // im Textfeld-Modus auch über einem vorhandenen Feld neu aufziehen
      const f = { id: uid(), page: i, x, y, w: 0, h: 0, text: '', auto: true, seed: newSeed() };
      fields.push(f);
      drag = { kind: 'new', f, x0: x, y0: y, at, pg };
      select(f.id);
    } else if (box) {
      const f = fields.find(q => q.id === box.dataset.id);
      drag = { kind: e.target.dataset.handle ? 'resize' : 'move', f, x0: x, y0: y, fx: f.x, fy: f.y, fw: f.w, fh: f.h, at, pg, moved: false };
      if (selected !== f.id) select(f.id);
    } else {
      // Freies Blatt: Wischen scrollt; ein kurzer Tipp legt dort ein Feld an (erst wählt er ein offenes Feld ab)
      if (selected) select(null);
      else tap = { i, x, y, cx: e.clientX, cy: e.clientY, t: Date.now() };
      return;
    }
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const [x, y] = drag.at(e), { f, pg } = drag;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    if (drag.kind === 'new') {
      f.x = clamp(Math.min(x, drag.x0), 0, pg.w); f.y = clamp(Math.min(y, drag.y0), 0, pg.h);
      f.w = Math.min(Math.abs(x - drag.x0), pg.w - f.x); f.h = Math.min(Math.abs(y - drag.y0), pg.h - f.y);
    } else if (drag.kind === 'move') {
      f.x = clamp(drag.fx + x - drag.x0, 0, pg.w - f.w);
      f.y = clamp(drag.fy + y - drag.y0, 0, pg.h - f.h);
    } else {
      f.w = clamp(drag.fw + x - drag.x0, MIN_W, pg.w - f.x);
      f.h = clamp(drag.fh + y - drag.y0, MIN_H, pg.h - f.y);
    }
    drag.moved = true;
    // Während des Ziehens nur den Rahmen bewegen; die Schrift folgt beim Loslassen (bzw. sofort beim Verschieben).
    if (drag.kind === 'move') renderPage(f.page);
    else drawOverlay(f.page);
  });
  const endDrag = e => {
    if (!drag && tap && e?.type === 'pointerup') {
      const t = tap, pg = sheet.pages[t.i];
      tap = null;
      if (Math.hypot(e.clientX - t.cx, e.clientY - t.cy) > 8 || Date.now() - t.t > 500) return; // gewischt, nicht getippt
      const x = Math.max(0, t.x - 2), y = Math.max(0, t.y - 9);
      const f = { id: uid(), page: t.i, x, y, w: Math.min(120, pg.w - x), h: Math.min(14, pg.h - y), text: '', auto: true, seed: newSeed() };
      fields.push(f);
      select(f.id);
      statusEl.textContent = 'Neues Feld: Text links eintragen. Ziehen verschiebt es.';
      changed(f);
      syncEditor();
      textEl.focus();
      return;
    }
    if (!drag) return;
    const { f, kind } = drag;
    drag = null;
    if (kind === 'new') {
      if (f.w < MIN_W || f.h < MIN_H) { // nur getippt → Feld in Standardgröße
        const pg = sheet.pages[f.page];
        f.w = Math.min(120, pg.w - f.x); f.h = Math.min(30, pg.h - f.y);
      }
      setDraw(false);
      statusEl.textContent = 'Neues Feld: Text links eintragen.';
      syncEditor();
      textEl.focus();
    }
    changed(f);
    syncEditor();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);

  new ResizeObserver(() => renderAll()).observe(stage);

  // ---------- Export ----------
  const exportButtons = ['sheet-goodnotes', 'sheet-pdf', 'sheet-png'].map($);
  const jpeg = canvas => new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9))
    .then(b => b.arrayBuffer()).then(b => new Uint8Array(b));

  async function doExport(kind) {
    if (!sheet) return showInfo('Bitte zuerst ein Arbeitsblatt öffnen.');
    const s = current(), o = options(s), color = inkColor(s);
    const miss = new Set(fields.flatMap(f => layoutOf(f).missing).filter(c => c !== ' '));
    if (miss.size && !await ask(`Diese Zeichen hast du noch nicht aufgenommen: ${[...miss].join(' ')}\n\nSie erscheinen im Export als rote Kästchen.`, { title: 'Zeichen fehlen', ok: 'Trotzdem exportieren' })) return;
    const labels = exportButtons.map(b => b.innerHTML);
    exportButtons.forEach(b => { b.disabled = true; b.textContent = '⏳ …'; });
    shareAgain.hidden = true;
    try {
      const pages = sheet.pages.map((pg, i) => ({
        size: [pg.w, pg.h],
        items: fields.filter(f => f.page === i).flatMap(f => layoutOf(f).items.map(it => ({ ...it, x: it.x + f.x, y: it.y + f.y }))),
      }));
      const name = (sheet.name || 'arbeitsblatt').replace(/[^\p{L}\p{N}_-]+/gu, '-');
      let files;
      if (kind === 'png') {
        files = [];
        for (const [i, page] of pages.entries()) {
          const blob = await buildPng({ ...page, backgroundImage: clean[i] }, o, color, false);
          files.push(new File([blob], `${name}-seite-${i + 1}.png`, { type: 'image/png' }));
        }
      } else {
        for (const [i, page] of pages.entries()) page.background = await jpeg(clean[i]);
        if (kind === 'pdf') {
          files = [new File([buildPdf({ pages }, o, color, false)], `${name}.pdf`, { type: 'application/pdf' })];
        } else {
          // Blatt als Papier je Seite, die Schrift als radierbare Striche darüber
          const papers = [];
          for (const page of pages) {
            papers.push(new Uint8Array(await buildPdf({ pages: [{ ...page, items: [] }] }, o, color, false).arrayBuffer()));
          }
          files = [new File([buildGoodnotes({ pages }, o, color, papers, sheet.name)], `${name}.goodnotes`, { type: 'application/octet-stream' })];
        }
      }
      if (!await shareFiles(files)) { pending = files; shareAgain.hidden = false; }
    } catch (err) {
      showInfo('Export fehlgeschlagen: ' + err.message);
    } finally {
      exportButtons.forEach((b, i) => { b.disabled = false; b.innerHTML = labels[i]; });
    }
  }
  $('sheet-goodnotes').addEventListener('click', () => doExport('goodnotes'));
  $('sheet-pdf').addEventListener('click', () => doExport('pdf'));
  $('sheet-png').addEventListener('click', () => doExport('png'));
  shareAgain.addEventListener('click', async () => {
    shareAgain.hidden = true;
    try { await shareFiles(pending); } catch (err) { showInfo('Teilen fehlgeschlagen: ' + err.message); }
    pending = null;
  });

  restore();
  // Schreib-Einstellungen (Tinte, Unordnung …) können sich im anderen Tab geändert haben
  // Text von außen ins gewählte Feld (KI-Tab). Gibt false zurück, wenn kein Feld gewählt ist.
  function insertIntoField(text, mode = 'replace') {
    const f = sel();
    if (!f) return false;
    f.text = mode === 'append' && f.text?.trim() ? f.text.replace(/\s+$/, '') + '\n\n' + text : text;
    textEl.value = f.text;
    changed(f);
    syncEditor();
    return true;
  }
  const selectedField = () => { const f = sel(); return f ? { number: fields.indexOf(f) + 1, page: f.page + 1, text: f.text || '' } : null; };
  // ---------- Für die KI (kiblatt.js) ----------
  // Seiten als JPEG (Base64), längste Seite höchstens 1600 px – reicht zum Lesen und hält die Anfrage klein
  async function pageImages() {
    return Promise.all(clean.map(async c => {
      const k = Math.min(1, 1600 / Math.max(c.width, c.height));
      const t = document.createElement('canvas');
      t.width = Math.round(c.width * k);
      t.height = Math.round(c.height * k);
      const ctx = t.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, t.width, t.height);
      ctx.drawImage(c, 0, 0, t.width, t.height);
      const url = t.toDataURL('image/jpeg', 0.82);
      t.width = t.height = 0;
      return url.slice(url.indexOf(',') + 1);
    }));
  }
  // KI-Antworten als neue Felder anlegen; gibt die Anzahl zurück
  function addAiFields(items) {
    const add = aiFields(items, sheet.pages, fields).map(f => ({ id: uid(), ...f, auto: true, seed: newSeed() }));
    fields.push(...add);
    saveFields();
    renderAll();
    syncEditor();
    return add.length;
  }
  // Gewähltes Feld als Stelle für die KI: Seite ab 1, box_2d 0–1000, bisheriger Text
  function selectedBox() {
    const f = sel();
    if (!f) return null;
    const pg = sheet.pages[f.page], n = v => Math.round(v * 1000);
    return { page: f.page + 1, box_2d: [n(f.y / pg.h), n(f.x / pg.w), n((f.y + f.h) / pg.h), n((f.x + f.w) / pg.w)], text: f.text || '' };
  }
  const ai = { hasSheet: () => !!sheet, sheetName: () => sheet?.name || '', pageImages, addAiFields, selectedBox, setBusy, status: t => { statusEl.textContent = t; } };
  return { render: () => { cache.clear(); renderAll(); syncEditor(); }, insertIntoField, selectedField, ai };
}
