// Selbsttest für das Arbeitsblatt: node tests/blatt.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { findBlueBlocks, eraseBlue, freeBelow, joinText, detect, layoutField, isBlue, aiFields } from '../js/blatt.js';

// Künstliche Seite: 210 × 297 mm bei 4 Pixeln je mm, schwarzer Aufgabentext, blaue Antworten darunter
const dpmm = 4, W = 210 * dpmm, H = 297 * dpmm;
const img = { data: new Uint8ClampedArray(W * H * 4).fill(255), width: W, height: H };
const BLACK = [20, 20, 20], NAVY = [31, 56, 140];
// „Textzeile“: kurze Striche wie Buchstaben, mit Wortlücken
function textLine(x0, x1, y, color) {
  for (let x = x0 * dpmm; x < x1 * dpmm; x++) {
    if ((x / dpmm) % 9 > 7.5) continue;           // Wortabstand
    if (x % 3 === 2) continue;                    // Buchstabenabstand
    for (let yy = (y - 2) * dpmm; yy < y * dpmm; yy++) {
      const i = (yy * W + x) * 4;
      [img.data[i], img.data[i + 1], img.data[i + 2]] = color;
    }
  }
}
textLine(20, 190, 40, BLACK); textLine(20, 150, 46, BLACK);           // Aufgabe 1
textLine(20, 185, 51, NAVY); textLine(20, 170, 55, NAVY);             // Antwort 1 (2 Zeilen)
textLine(20, 190, 120, BLACK);                                        // Aufgabe 2
textLine(20, 100, 125, NAVY);                                         // Antwort 2 (1 kurze Zeile)
textLine(20, 190, 200, BLACK);                                        // Aufgabe 3

assert.ok(isBlue(...NAVY) && !isBlue(...BLACK));
const blocks = findBlueBlocks(img, dpmm);
assert.equal(blocks.length, 2, 'zwei blaue Antworten');
assert.ok(Math.abs(blocks[0].y / dpmm - 49) <= 1 && Math.abs((blocks[0].y + blocks[0].h) / dpmm - 55) <= 1, 'Block 1 umfasst beide Zeilen');

// Text aus dem PDF: nur blaue Stücke im Block, Zeilen verbunden, Silbentrennung aufgelöst
const items = [
  { str: 'Befindet sich die Schmidt KG', x: 80, y: 46 * dpmm, w: 400, h: 8 },        // schwarz → nicht übernehmen
  { str: 'Nein, nicht auto-', x: 80, y: 51 * dpmm, w: 300, h: 8 },
  { str: 'matisch. Siehe', x: 80, y: 55 * dpmm, w: 200, h: 8 },
  { str: '§ 286 BGB.', x: 290, y: 55 * dpmm, w: 100, h: 8 },
];
const { fields, clean } = detect(img, dpmm, items);
assert.equal(fields.length, 2);
assert.equal(fields[0].text, 'Nein, nicht automatisch. Siehe § 286 BGB.');
// Blau ist weg, Schwarz bleibt
const px = (im, x, y) => [...im.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)];
assert.deepEqual(px(clean, 21 * dpmm, 51 * dpmm - 1), [255, 255, 255]);
assert.deepEqual(px(clean, 21 * dpmm, 40 * dpmm - 1), BLACK);
assert.deepEqual(px(img, 21 * dpmm, 51 * dpmm - 1), NAVY, 'Original bleibt unverändert');
// Feld 1 reicht bis kurz vor Aufgabe 2, Feld 2 bis kurz vor Aufgabe 3; beide bis zum rechten Textrand
assert.ok(fields[0].y + fields[0].h < 118 && fields[0].y + fields[0].h > 110, `Feld 1 endet bei ${(fields[0].y + fields[0].h).toFixed(1)} mm`);
assert.ok(fields[1].y + fields[1].h < 198 && fields[1].y + fields[1].h > 190);
assert.ok(fields[1].x + fields[1].w >= 189, 'kurze Antwort darf bis zum Rand schreiben');
// freeBelow findet die nächste Zeile
assert.equal(Math.round(freeBelow(clean, 20 * dpmm, 190 * dpmm, 60 * dpmm) / dpmm), 118);

// Ohne PDF-Text (Foto): Felder entstehen trotzdem, nur leer
assert.equal(detect(img, dpmm).fields[0].text, '');

// Absatz bei großer Lücke, „30-Tage“ behält den Strich
assert.equal(joinText([
  { str: 'Die 30-', x: 0, y: 10, w: 50, h: 8 }, { str: 'Tage-Regel.', x: 0, y: 20, w: 50, h: 8 },
  { str: 'Ende.', x: 0, y: 30, w: 50, h: 8 }, { str: 'Neu.', x: 0, y: 60, w: 50, h: 8 },
]), 'Die 30-Tage-Regel. Ende.\nNeu.');

// Ein fremdes Rechteck wird nur in seinem Bereich bereinigt
const copy = { ...img, data: new Uint8ClampedArray(img.data) };
eraseBlue(copy, { x: 0, y: 0, w: 10, h: 10 });
assert.deepEqual(px(copy, 21 * dpmm, 51 * dpmm - 1), NAVY);

// Einpassen: langer Text wird kleiner, bleibt im Feld
const p = emptyProfile();
[...'abcdefghijklmnopqrstuvwxyz'].forEach(ch => variantsOf(p, ch).forEach(v => v.push([[0.2, 0, 0.5, 0], [0.9, -1, 0.5, 10]])));
variantsOf(p, ' ')[0].push([[0, 0, 0.5, 0], [1, 0, 0.5, 10]]);
const o = { xHeight: 3, lineHeight: 8.8, spacing: 0.15, connect: 0, chaos: 0, mistakes: 0 };
const field = { x: 20, y: 50, w: 170, h: 30, text: Array(40).fill('hallo welt').join(' ') };
const fit = layoutField(field, p, o);
assert.ok(!fit.overflow && fit.xHeight < 3 && fit.xHeight >= 1.4, `x-Höhe ${fit.xHeight}`);
const glyphs = fit.items.filter(it => it.strokes);
assert.equal(glyphs.length, 40 * 9, 'kein Buchstabe fehlt');
for (const it of glyphs) {
  const xs = it.strokes.flat().map(q => it.x + q[0] * it.s);
  assert.ok(Math.min(...xs) >= field.x - 1e-9 && Math.max(...xs) <= field.x + field.w + 1e-9, `innerhalb der Breite ${Math.min(...xs)}–${Math.max(...xs)}`);
  assert.ok(it.y > field.y && it.y + it.s <= field.y + field.h + 1e-9, 'innerhalb der Höhe');
}
// Kurzer Text bleibt in der eingestellten Größe; ohne Einpassen läuft zu langer Text über
assert.equal(layoutField({ ...field, text: 'hallo' }, p, o).xHeight, 3);
assert.ok(layoutField({ ...field, auto: false, xHeight: 3 }, p, o).overflow);
// Antwort klebt direkt an der Frage: Feld beginnt unter der schwarzen Zeile
const tight = { data: new Uint8ClampedArray(W * H * 4).fill(255), width: W, height: H };
const saved = img.data;
img.data = tight.data;
textLine(20, 190, 240, BLACK); textLine(20, 180, 242.5, NAVY); textLine(20, 150, 246.5, NAVY);
const t = detect(tight, dpmm).fields[0];
assert.ok(t.y >= 240, `Feld beginnt bei ${t.y} mm, unter der Frage (240 mm)`);
img.data = saved;
console.log(`OK – Arbeitsblatt: ${fields.length} Antworten erkannt, eingepasst auf x-Höhe ${fit.xHeight} mm`);

// KI-Antworten → Felder: Umrechnung in mm, Linie wird zum Feld darüber, Überdeckung und Unsinn entfallen
{
  const pages = [{ w: 210, h: 297 }];
  const out = aiFields([
    { page: 1, box_2d: [500, 100, 505, 600], text: 'Zucker' },        // nur eine Linie
    { page: 1, box_2d: [600, 100, 650, 600], text: 'Sauerstoff' },
    { page: 1, box_2d: [601, 110, 640, 590], text: 'doppelt' },       // überdeckt die vorige
    { page: 2, box_2d: [0, 0, 10, 10], text: 'falsche Seite' },
    { page: 1, box_2d: [1, 2], text: 'kaputt' }, { page: 1, box_2d: [700, 100, 750, 600], text: ' ' },
  ], pages, []);
  assert.equal(out.length, 3);
  assert.equal(out[2].text, '', 'Stelle ohne Antwort wird leeres Feld');
  assert.equal(out[0].text, 'Zucker');
  assert.ok(Math.abs(out[0].x - 21) < 1e-9 && Math.abs(out[0].w - 105) < 1e-9, 'x und Breite in mm');
  assert.ok(Math.abs(out[0].y + out[0].h - (297 * 0.5025 + 1)) < 1e-9 && out[0].h === 9, 'flache Stelle: Feld steht auf der Linie, 9 mm hoch');
  assert.equal(aiFields([{ page: 1, box_2d: [600, 100, 650, 600], text: 'x' }], pages, [{ page: 0, ...out[1] }]).length, 0, 'vorhandenes Feld bleibt');
  assert.deepEqual(aiFields('kein Array', pages), []);
  // verpackt und mit Zahlen als Text
  const wrapped = aiFields({ antworten: [{ page: '1', box_2d: ['800', '100', '850', '600'], text: 'ok' }] }, pages);
  assert.equal(wrapped.length, 1);
  assert.equal(wrapped[0].text, 'ok');
}
console.log('OK – KI-Felder');
