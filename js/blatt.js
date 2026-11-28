// Arbeitsblatt: blaue Antworten finden und entfernen, freien Platz messen, Text in Felder einpassen.
// Ohne DOM, in Node testbar. Bilder sind { data: RGBA-Bytes, width, height }, dpmm = Pixel je mm.
import { layout } from './layout.js';

// ---------- Farben ----------
// Blaue Tinte/Schrift: deutlich blauer als rot und grün, nicht zu hell.
export const isBlue = (r, g, b) => b > 80 && b - r > 40 && b - g > 12 && r + g + b < 600;
// Kantenpixel blauer Schrift (Kantenglättung auf weißem Grund): leicht bläulich oder fast weiß.
// Beim Entfernen werden beide weiß, sonst bleibt ein blasser Schatten der Schrift stehen.
const isBluish = (r, g, b) => (b - r > 4 && b >= g) || (r > 215 && g > 215 && b > 215);
// Inhalt (Schrift, Linien, Bilder): nicht fast weiß.
const isInk = (r, g, b) => r + g + b < 600;

// ---------- Blaue Blöcke ----------
// Raster aus ~1-mm-Zellen; Zellen mit blauer Schrift werden über kleine Lücken
// (Wortabstand, Zeilenabstand) zu Blöcken verbunden. Ergebnis in Pixeln.
export function findBlueBlocks(img, dpmm, opts = {}) {
  const { gapX = 4, gapY = 2.6, minW = 10, minCells = 12 } = opts; // mm
  const { data, width, height } = img;
  const cell = Math.max(1, Math.round(dpmm));
  const cw = Math.ceil(width / cell), ch = Math.ceil(height / cell);
  const count = new Uint16Array(cw * ch);
  for (let y = 0; y < height; y++) {
    const row = (y / cell | 0) * cw;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isBlue(data[i], data[i + 1], data[i + 2])) count[row + (x / cell | 0)]++;
    }
  }
  const on = Uint8Array.from(count, n => n >= 2);
  // Verbinden: Zellen, die waagerecht ≤ gapX oder senkrecht ≤ gapY auseinander liegen, gehören zusammen.
  const gx = Math.round(gapX * dpmm / cell), gy = Math.round(gapY * dpmm / cell);
  const label = new Int32Array(cw * ch).fill(-1);
  const blocks = [];
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || label[start] >= 0) continue;
    const b = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, cells: 0 };
    const stack = [start];
    label[start] = blocks.length;
    while (stack.length) {
      const c = stack.pop(), cx = c % cw, cy = c / cw | 0;
      b.cells++;
      b.x0 = Math.min(b.x0, cx); b.x1 = Math.max(b.x1, cx);
      b.y0 = Math.min(b.y0, cy); b.y1 = Math.max(b.y1, cy);
      for (let dy = -gy; dy <= gy; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= ch) continue;
        const span = dy === 0 ? gx : 1; // schräg nur direkt daneben, sonst kleben Spalten zusammen
        for (let dx = -span; dx <= span; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= cw) continue;
          const n = ny * cw + nx;
          if (on[n] && label[n] < 0) { label[n] = blocks.length; stack.push(n); }
        }
      }
    }
    blocks.push(b);
  }
  return blocks
    .filter(b => b.cells >= minCells && (b.x1 - b.x0 + 1) * cell >= minW * dpmm)
    .map(b => ({
      x: b.x0 * cell, y: b.y0 * cell,
      w: Math.min(width, (b.x1 + 1) * cell) - b.x0 * cell,
      h: Math.min(height, (b.y1 + 1) * cell) - b.y0 * cell,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

// Blaue (auch kantengeglättete) Pixel im Rechteck weiß färben. Schwarze Schrift darin bleibt.
export function eraseBlue(img, rect, pad = 2) {
  const { data, width, height } = img;
  const x0 = Math.max(0, Math.floor(rect.x - pad)), x1 = Math.min(width, Math.ceil(rect.x + rect.w + pad));
  const y0 = Math.max(0, Math.floor(rect.y - pad)), y1 = Math.min(height, Math.ceil(rect.y + rect.h + pad));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (isBluish(data[i], data[i + 1], data[i + 2])) data[i] = data[i + 1] = data[i + 2] = 255;
    }
  }
}

// Wie weit reicht der freie Platz unter y (Pixel) zwischen x0 und x1? Gibt die y-Position der nächsten
// Zeile mit Inhalt zurück (oder die Bildhöhe).
export function freeBelow(img, x0, x1, y) {
  for (let yy = Math.max(0, Math.ceil(y)); yy < img.height; yy++) if (rowHasInk(img, x0, x1, yy)) return yy;
  return img.height;
}

// Mindestens 3 Schriftpixel in Zeile y zwischen x0 und x1?
function rowHasInk(img, x0, x1, y) {
  const { data, width } = img;
  let n = 0;
  for (let x = Math.max(0, Math.floor(x0)); x < Math.min(width, Math.ceil(x1)); x++) {
    const i = (y * width + x) * 4;
    if (isInk(data[i], data[i + 1], data[i + 2]) && ++n >= 3) return true;
  }
  return false;
}

// Anteil blauer Pixel unter allen Schriftpixeln in einem Rechteck (für Textstücke aus dem PDF).
export function blueShare(img, r) {
  const { data, width, height } = img;
  let blue = 0, ink = 0;
  for (let y = Math.max(0, r.y | 0); y < Math.min(height, r.y + r.h); y++) {
    for (let x = Math.max(0, r.x | 0); x < Math.min(width, r.x + r.w); x++) {
      const i = (y * width + x) * 4, R = data[i], G = data[i + 1], B = data[i + 2];
      if (!isInk(R, G, B)) continue;
      ink++;
      if (isBluish(R, G, B)) blue++;
    }
  }
  return ink ? blue / ink : 0;
}

// ---------- Text aus dem PDF ----------
// items: [{ str, x, y (Grundlinie), w, h }] in Pixeln. Liefert den Fließtext eines Blocks:
// Zeilen werden mit Leerzeichen verbunden, Trennstriche am Zeilenende aufgelöst, große Lücken werden Absätze.
export function joinText(items) {
  const parts = items.filter(it => it.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of parts) {
    const line = lines.at(-1);
    if (line && Math.abs(it.y - line.y) < it.h * 0.5) line.items.push(it);
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  const step = lines.length > 1
    ? [...lines.slice(1).map((l, i) => l.y - lines[i].y)].sort((a, b) => a - b)[(lines.length - 1) >> 1]
    : 0;
  let out = '';
  lines.forEach((line, i) => {
    let text = '';
    line.items.sort((a, b) => a.x - b.x).forEach((it, k) => {
      const prev = line.items[k - 1];
      const gap = prev ? it.x - (prev.x + prev.w) : 0;
      if (prev && gap > it.h * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      text += it.str;
    });
    text = text.replace(/\s+/g, ' ').trim();
    if (!i) { out = text; return; }
    const paragraph = step && line.y - lines[i - 1].y > step * 1.6;
    if (paragraph) out += '\n' + text;
    else if (/\p{Ll}-$/u.test(out) && /^\p{Ll}/u.test(text)) out = out.slice(0, -1) + text; // Silbentrennung
    else if (/-$/.test(out)) out += text;                                                   // „30-Tage“
    else out += ' ' + text;
  });
  return out;
}

// ---------- Felder ----------
// Antwortfeld zu einem blauen Block: beginnt oben am Block, reicht nach unten bis kurz vor den nächsten Inhalt.
// img: Seite ohne blaue Schrift. Ergebnis in mm.
export function fieldFromBlock(block, img, dpmm) {
  const pad = 1 * dpmm;
  const next = freeBelow(img, block.x, block.x + block.w, block.y + block.h + pad);
  const bottom = Math.min(next - 2.5 * dpmm, img.height - 8 * dpmm);
  // Klebt die Antwort an der Frage (übrig gebliebene schwarze Schrift im Block), unterhalb davon beginnen
  let top = Math.max(0, block.y - pad);
  for (let y = Math.floor(block.y + block.h); y >= top; y--) {
    if (rowHasInk(img, block.x, block.x + block.w, y)) { top = y + pad; break; }
  }
  return {
    x: Math.max(0, block.x - pad) / dpmm,
    y: top / dpmm,
    w: Math.min(img.width - block.x + pad, block.w + 2 * pad) / dpmm,
    h: Math.max(block.h + 2 * pad, bottom - top) / dpmm,
  };
}

const MIN_X = 1.4; // kleinste Schrift beim Einpassen (x-Höhe in mm)

// Handschrift für ein Feld setzen. o: Layout-Optionen aus dem Schreiben-Tab (Schriftgröße, Zeilenabstand, Unordnung …).
// Mit field.auto wird die Schrift so weit verkleinert (nie vergrößert), bis der Text ins Feld passt.
// Ergebnis: { items (mm auf der Seite), missing, xHeight, overflow }
export function layoutField(field, profile, o, seed = 1) {
  const ratio = o.lineHeight / o.xHeight;
  const run = xh => {
    const opt = {
      ...o, xHeight: xh, lineHeight: xh * ratio, margin: 0, ruled: false,
      pageW: field.w, pageH: field.h - xh, // Platz für Unterlängen der letzten Zeile
    };
    const r = layout(field.text || '', profile, opt, seed);
    return { r, xh, fits: r.pages.length === 1 };
  };
  const max = field.auto === false ? field.xHeight || o.xHeight : o.xHeight;
  let best = run(max);
  if (!best.fits && field.auto !== false) {
    // Binäre Suche in 0,05-mm-Schritten nach der größten Schrift, die passt
    let lo = Math.round(MIN_X * 20), hi = Math.round(max * 20) - 1;
    let found = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, t = run(mid / 20);
      if (t.fits) { found = t; lo = mid + 1; } else hi = mid - 1;
    }
    best = found || run(MIN_X);
  }
  const items = best.r.pages[0].items.map(it => ({ ...it, x: it.x + field.x, y: it.y + field.y }));
  return { items, missing: best.r.missing, xHeight: best.xh, overflow: !best.fits };
}

// Rechter Rand des Inhalts (Pixel) zwischen y0 und y1: ganz rechts liegende Spalte mit Schrift,
// ohne die äußersten 3 %. So zählt der Textblock über der Antwort, nicht z. B. ein Logo im Kopf.
export function contentRight(img, y0 = 0, y1 = img.height) {
  const { data, width, height } = img;
  const edge = Math.round(width * 0.03);
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(height, Math.ceil(y1));
  for (let x = width - edge - 1; x > edge; x--) {
    let n = 0;
    for (let y = y0; y < y1; y += 2) {
      const i = (y * width + x) * 4;
      if (isInk(data[i], data[i + 1], data[i + 2]) && ++n >= 3) return x + 1;
    }
  }
  return width - edge;
}

const inside = (it, b, m) => {
  const cx = it.x + it.w / 2, cy = it.y - it.h / 2;
  return cx >= b.x - m && cx <= b.x + b.w + m && cy >= b.y - m && cy <= b.y + b.h + m;
};

// Ganze Seite: blaue Antworten finden, ihren Text aus dem PDF lesen (falls vorhanden), sie vom Blatt
// entfernen und daraus Antwortfelder machen. Gibt die Felder (mm) und die bereinigte Seite zurück.
export function detect(img, dpmm, items = []) {
  const blocks = findBlueBlocks(img, dpmm);
  const blueItems = items.filter(it => blueShare(img, { x: it.x, y: it.y - it.h, w: it.w, h: it.h }) > 0.5);
  const clean = { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
  for (const b of blocks) eraseBlue(clean, b);
  const fields = blocks.map(b => {
    const f = fieldFromBlock(b, clean, dpmm);
    const right = contentRight(clean, b.y - 30 * dpmm, b.y + b.h); // Text über der Antwort (und die Antwort selbst)
    f.w = Math.max(f.w, (right - b.x) / dpmm + 1);
    // Nicht in die nächste Antwort darunter hineinragen
    const below = blocks.filter(o => o !== b && o.y > b.y + b.h && o.x < b.x + b.w && o.x + o.w > b.x);
    const limit = Math.min(...below.map(o => (o.y - 1.5 * dpmm) / dpmm));
    if (f.y + f.h > limit) f.h = Math.max(b.h / dpmm + 2, limit - f.y);
    return { ...f, text: joinText(blueItems.filter(it => inside(it, b, dpmm))), erase: b };
  });
  return { fields, clean };
}

// KI-Antworten in Felder umrechnen. items: [{ page (ab 1), box_2d: [ymin, xmin, ymax, xmax] 0–1000, text }]
// (auch in ein Objekt verpackt oder mit Zahlen als Text); leerer Text = Stelle gefunden, Antwort unbekannt → leeres Feld.
// pages: [{ w, h }] in mm, existing: vorhandene Felder. Stellen, die ein vorhandenes Feld überdecken, entfallen.
// Ist die Stelle flach (unter 9 mm, meist nur die Linie), steht das Feld 9 mm hoch auf der Mitte der Stelle,
// damit die Schrift auf der Linie sitzt und nicht durchgestrichen wirkt.
export function aiFields(items, pages, existing = []) {
  const out = [];
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 && w * h > 0.3 * Math.min(a.w * a.h, b.w * b.h);
  };
  const list = Array.isArray(items) ? items : Object.values(items || {}).find(Array.isArray) || [];
  for (const it of list) {
    const pi = Math.round(Number(it?.page ?? 1)) - 1, pg = pages[pi], b = Array.isArray(it?.box_2d) ? it.box_2d.map(Number) : null;
    const text = cleanAnswerText(it?.text);
    if (!pg || !b || b.length !== 4 || !b.every(Number.isFinite)) continue;
    const [y0, x0, y1, x1] = b.map(v => Math.min(1000, Math.max(0, v)) / 1000);
    const flat = (y1 - y0) * pg.h < 9;
    let x = x0 * pg.w, w = (x1 - x0) * pg.w, yb = (flat ? (y0 + y1) / 2 : y1) * pg.h + (flat ? 1 : 0), h = flat ? 9 : (y1 - y0) * pg.h;
    if (w < 12) w = Math.min(60, pg.w - x);
    const f = { page: pi, x, y: Math.max(0, yb - h), w, h: Math.min(h, yb) };
    if (f.w <= 0 || f.h <= 0) continue;
    // Liegt hier schon ein leeres Feld (z. B. von einem früheren Versuch), bekommt es die Antwort; sonst bleibt das vorhandene Feld
    const hit = existing.find(e => e.page === pi && overlap(e, f));
    if (hit) { if (text && !String(hit.text ?? '').trim() && !out.some(o => o.fill === hit.id)) out.push({ fill: hit.id, text }); continue; }
    if (out.some(e => e.page === pi && !e.fill && overlap(e, f))) continue;
    out.push({ ...f, text });
  }
  return out;
}

// KI-Antwort für ein Feld aufräumen: Nummern und Aufzählungszeichen am Zeilenanfang („1.“, „a)“, „-“, „•“),
// Vorsätze wie „Antwort:“, Markdown (**fett**, _kursiv_, `Code`, # Überschrift), umschließende Anführungszeichen,
// Formel-Dollarzeichen und doppelte Leerzeichen. Zeilenumbrüche bleiben.
export function cleanAnswerText(text) {
  let t = String(text ?? '').replace(/\r/g, '').replace(/^```\w*\n?|```$/gm, '');
  t = t.split('\n').map(line => {
    let l = line.trim();
    for (let k = 0; k < 3; k++) {
      l = l.replace(/^(#{1,6}\s+|>\s*|(?:[-–—•*·]|\d{1,3}[.)]|[a-zA-Z][.)]|\(\d{1,3}\)|\([a-zA-Z]\))\s+)/, '')
        .replace(/^(Antwort|Lösung|Loesung|Answer)\s*\d*\s*:\s*/i, '');
    }
    return l.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2').replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1').replace(/\$([^$]+)\$/g, '$1').replace(/\s{2,}/g, ' ');
  }).filter((l, i, all) => l || (i > 0 && i < all.length - 1)).join('\n').trim();
  const q = t.match(/^["„“”'‚‘’«»](.*)["“”'‘’«»]$/s);
  return (q ? q[1] : t).trim();
}
