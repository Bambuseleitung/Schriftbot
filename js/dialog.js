// Eigene Dialoge statt alert/confirm/prompt: Die eingebauten sehen auf dem iPad fremd aus. Blatt von unten, per Tastatur und Tipp bedienbar.

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

function sheet(build) {
  const t = document.getElementById('toast');
  if (t) t.hidden = true; // Meldung nicht über das Blatt legen
  return new Promise(resolve => {
    const bg = el('div', { className: 'sheet-bg' });
    const box = el('div', { className: 'sheet' });
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const done = value => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = e => { if (e.key === 'Escape') done(build.cancelValue ?? null); };
    bg.addEventListener('click', e => { if (e.target === bg) done(build.cancelValue ?? null); });
    document.addEventListener('keydown', onKey);
    build(box, done);
    bg.append(box);
    document.body.append(bg);
    (box.querySelector('input, textarea') || box.querySelector('button.primary') || box.querySelector('button'))?.focus();
  });
}

const btn = (text, cls, onClick) => {
  const b = el('button', { className: cls || '', textContent: text });
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};
// Mehrzeilige Meldungen: Absätze an Leerzeilen, Zeilenumbrüche bleiben
const body = text => el('p', { className: 'sheet-msg', textContent: text });

// Ja/Nein-Frage. danger: der Bestätigen-Knopf ist rot (z. B. Löschen).
export function ask(message, { title = '', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  const build = (box, done) => {
    if (title) box.append(el('h2', { textContent: title }));
    box.append(body(message), el('div', { className: 'row' },
      btn(ok, danger ? 'danger-solid' : 'primary', () => done(true)),
      btn(cancel, '', () => done(false))));
  };
  build.cancelValue = false;
  return sheet(build);
}

// Hinweis mit einem OK-Knopf
export function info(message, { title = '', ok = 'OK' } = {}) {
  const build = (box, done) => {
    if (title) box.append(el('h2', { textContent: title }));
    box.append(body(message), el('div', { className: 'row' }, btn(ok, 'primary', () => done(undefined))));
  };
  return sheet(build);
}

// Texteingabe (z. B. Umbenennen). Gibt den Text oder null zurück.
export function askText(title, value = '', { ok = 'Speichern', placeholder = '' } = {}) {
  return sheet((box, done) => {
    const input = el('input', { type: 'text', value, placeholder });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') done(input.value.trim() || null); });
    box.append(el('h2', { textContent: title }), input, el('div', { className: 'row' },
      btn(ok, 'primary', () => done(input.value.trim() || null)),
      btn('Abbrechen', '', () => done(null))));
  });
}

// Mehrere Möglichkeiten; gibt den Wert der gewählten oder null zurück. choices: [{ label, value, primary?, danger? }]
// Längerer Text (mehrere Zeilen), z. B. als Material für die KI. Gibt { name, text } oder null zurück.
export function askLongText(title, { ok = 'Hinzufügen', placeholder = '' } = {}) {
  return sheet((box, done) => {
    const name = el('input', { type: 'text', placeholder: 'Name, z. B. Notizen Photosynthese' });
    const area = el('textarea', { rows: 8, placeholder });
    area.setAttribute('aria-label', 'Text');
    const go = () => (area.value.trim() ? done({ name: name.value.trim() || 'Eingefügter Text', text: area.value.trim() }) : area.focus());
    box.append(el('h2', { textContent: title }), name, area, el('div', { className: 'row' },
      btn(ok, 'primary', go), btn('Abbrechen', '', () => done(null))));
  });
}

export function choose(message, choices, { title = '', preview = '' } = {}) {
  return sheet((box, done) => {
    if (title) box.append(el('h2', { textContent: title }));
    if (preview) box.append(el('div', { className: 'sheet-preview', textContent: preview }));
    if (message) box.append(el('p', { className: 'hint small', textContent: message }));
    box.append(el('div', { className: 'row' },
      ...choices.map(c => btn(c.label, c.danger ? 'danger-solid' : c.primary ? 'primary' : '', () => done(c.value))),
      btn('Abbrechen', '', () => done(null))));
  });
}

// Kurze Meldung unten, verschwindet von selbst
let toastTimer;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', className: 'toast' });
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
