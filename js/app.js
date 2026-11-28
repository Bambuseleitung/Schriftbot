import {
  loadInto, shareInto, saveProfile, getSettings, createProfile, activeProfile, recProfile, setActiveProfile, setRecProfile,
} from './storage.js';
import { alignAll, progress } from './profile.js';
import { initAufnahme } from './aufnahme.js';
import { initTextAufnahme } from './textaufnahme.js';
import { initProfil } from './profil.js';
import { initSchreiben } from './schreiben.js';
import { initBlatt } from './blattui.js';
import { initKiBlatt } from './kiblatt.js';
import { initProfilwahl } from './profilwahl.js';
import { info } from './dialog.js';
import { cleanPasted } from './einfuegen.js';
import { setupDemo, isDemo, renameDemo } from './demo.js';
import { refreshBuiltins } from './schriften.js';
import { showTutorial } from './tutorial.js';

// Navigation zwischen den Bereichen. Die App startet immer in „Schreiben“.
const tabs = document.querySelectorAll('.tabs [data-view]');

// Zwei Schrift-Objekte: profile = Schrift zum Schreiben (Schreiben, Ausfüllen), own = eigene Handschrift in der Aufnahme.
// Sind beide dieselbe Handschrift, teilen sie sich die Buchstaben (Aufgenommenes erscheint sofort beim Schreiben).
const profile = {}, own = {};

// Gleitende Markierung hinter dem gewählten Tab (iPad); auf dem Handy per CSS ausgeblendet
const tabBar = document.querySelector('.tabs');
const indicator = document.createElement('span');
indicator.className = 'tab-indicator';
indicator.setAttribute('aria-hidden', 'true');
tabBar.prepend(indicator);
function moveIndicator() {
  const t = tabBar.querySelector('[aria-selected="true"]');
  if (!t || !t.offsetWidth) return;
  indicator.style.width = t.offsetWidth + 'px';
  indicator.style.transform = `translateX(${t.offsetLeft}px)`;
}
new ResizeObserver(moveIndicator).observe(tabBar);

let currentView = null;
function showView(name) {
  // Beim Tabwechsel frisch geschriebene Zeichen ausrichten, damit „Schreiben“ sie schon gerade sieht.
  for (const p of new Set([profile, own])) if (p.glyphs && alignAll(p)) saveProfile(p);
  for (const tab of tabs) {
    const active = tab.dataset.view === name;
    tab.setAttribute('aria-selected', active);
    const view = document.getElementById('view-' + tab.dataset.view);
    view.hidden = !active;
    // Sanft einblenden, wenn ein anderer Bereich gewählt wird
    if (active && currentView && currentView !== name) {
      view.classList.remove('view-enter');
      void view.offsetWidth;
      view.classList.add('view-enter');
    }
  }
  currentView = name;
  // „Exportieren“ in der Kopfzeile gehört zum Schreiben (Ausfüllen hat eigene Export-Knöpfe)
  document.getElementById('export-open').hidden = name !== 'schreiben';
  moveIndicator();
}

// Hell/Dunkel: Schalter in der Kopfzeile, Standard hell, wird auf dem Gerät gemerkt
const themeBtn = document.getElementById('theme-btn');
function applyTheme(dark) {
  const root = document.documentElement;
  if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#23292c' : '#ffffff');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
  const label = dark ? 'Helles Design' : 'Dunkles Design';
  themeBtn.querySelector('span').textContent = label;
  themeBtn.querySelector('use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
}
applyTheme(document.documentElement.dataset.theme === 'dark');
themeBtn.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  applyTheme(dark);
});
document.addEventListener('animationend', e => { if (e.target.classList?.contains('view-enter')) e.target.classList.remove('view-enter'); });

for (const tab of tabs) tab.addEventListener('click', () => showView(tab.dataset.view));
// Pfeiltasten in der Tab-Leiste (Tastatur, VoiceOver)
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const visible = [...tabs].filter(t => !t.hidden);
  const k = visible.indexOf(document.activeElement);
  if (k < 0) return;
  const next = visible[(k + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
  next.focus();
  showView(next.dataset.view);
});

// Erster Start: Demo-Schrift anlegen, falls mitgeliefert (demo/demo-schrift.json)
await setupDemo();
await refreshBuiltins(); // z. B. neues ß in schon geladenen mitgelieferten Schriften
const demo = isDemo();

renameDemo();

// Start immer in „Schreiben“; nur nach „Eigene Schrift aufnehmen“ (Neuladen) direkt in die Aufnahme
let start = 'schreiben';
try { start = sessionStorage.getItem('startView') || start; sessionStorage.removeItem('startView'); } catch {}
showView(document.getElementById('view-' + start) ? start : 'schreiben');

// Schrift zum Schreiben laden: dieselbe wie in der Aufnahme → gemeinsame Buchstaben
async function loadFont(id) {
  if (id === recProfile()?.id) shareInto(profile, own); else await loadInto(profile, id);
  if (alignAll(profile)) saveProfile(profile); // ältere Aufnahmen nachträglich ausrichten
}
try {
  if (!recProfile()) createProfile({ name: 'Meine Schrift' }); // z. B. nach dem Umzug nur mitgelieferte Schriften
  await loadInto(own, recProfile().id);
  if (alignAll(own)) saveProfile(own);
  await loadFont(activeProfile().id);
} catch (err) {
  info('Die Schrift konnte nicht geladen werden: ' + err.message +
    '\n\nTipp: App schließen und neu öffnen. Falls das nicht hilft, unter „Eigene Schrift“ eine Sicherung importieren.');
  throw err;
}
let schreiben;
const aufnahme = initAufnahme(own, () => schreiben.sync()); // Schriftgröße im Schreiben-Tab nachziehen
initTextAufnahme(own, aufnahme.refresh);
schreiben = initSchreiben(profile, aufnahme.refresh); // rendert neu, sobald der Tab sichtbar wird
initProfil(own);
// Früher gab es eine KI mit API-Schlüssel: einen gespeicherten Schlüssel vom Gerät löschen.
try { localStorage.removeItem('ki'); } catch {}
const blatt = initBlatt(profile);
initKiBlatt({ ai: blatt.ai, insertIntoField: t => blatt.insertIntoField(t) });
// Schrift zum Schreiben wechseln (sofort, ohne Neuladen); das Aussehen bleibt
async function chooseFont(id) {
  setActiveProfile(id);
  await loadFont(id);
  schreiben.sync();
  blatt.render();
  wahl.render();
}
// Andere eigene Handschrift aufnehmen: neu laden und direkt in „Eigene Schrift“ starten (Aufnahme-Stand gehört zur Handschrift)
function chooseRec(id, { force = false } = {}) {
  if (id === recProfile()?.id && !force) return showView('aufnahme');
  setRecProfile(id);
  try { sessionStorage.setItem('startView', 'aufnahme'); } catch {}
  location.reload();
}
const wahl = initProfilwahl({ chooseFont, chooseRec });
// Mitgelieferte Schriften werden erst beim Wählen geladen (je ~0,2 MB), nicht vorab im Hintergrund.

// ?-Knopf: kleines Menü mit Einführung, Anleitung und Hell/Dunkel; schließt mit Esc oder Tipp daneben
const helpBtn = document.getElementById('help-btn'), helpMenu = document.getElementById('help-menu');
const setMenu = open => { helpMenu.hidden = !open; helpBtn.setAttribute('aria-expanded', String(open)); };
// Ein Klick-Handler für alles: so schließt der Knopf auch die Aufklapp-Menüs der Leiste
document.addEventListener('click', e => {
  if (e.target.closest('#help-btn')) setMenu(helpMenu.hidden);
  else if (!e.target.closest('#help-menu') || e.target.closest('.menu-item')) setMenu(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !helpMenu.hidden) { setMenu(false); helpBtn.focus(); } });
document.getElementById('help-tour').addEventListener('click', () => showTutorial({ goTo: showView, demo }));
safetyHint();

// Hinweis oben: erst „Zum Home-Bildschirm“ (sonst darf Safari die Daten löschen), dann „Backup“.
function safetyHint() {
  const $ = id => document.getElementById(id);
  const banner = $('safety-banner');
  const done = progress(own).done;
  if (!done || window.schriftbotNative) return;
  const later = key => { try { return +localStorage.getItem(key) > Date.now(); } catch { return false; } };
  const snooze = (key, days) => { try { localStorage.setItem(key, Date.now() + days * 86400000); } catch {} };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const last = getSettings().lastBackup, days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  let key, days2;
  if (apple && !standalone && !later('hinweis-home')) {
    key = 'hinweis-home'; days2 = 14;
    $('safety-text').textContent = 'Füge DeineSchrift zum Home-Bildschirm hinzu – sonst darf Safari deine Schrift nach 7 Tagen ohne Nutzung löschen.';
    $('safety-action').textContent = 'So geht’s';
    $('safety-action').onclick = () => info(
      '1. Sichere zuerst deine Schrift: Eigene Schrift → „Alles sichern“, z. B. in „Dateien“.\n' +
      '2. Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil) und dann auf „Zum Home-Bildschirm“.\n' +
      '3. Öffne DeineSchrift ab jetzt über das neue Symbol und importiere dort einmal die Sicherung (Eigene Schrift → Importieren).\n\n' +
      'Die App auf dem Home-Bildschirm hat einen eigenen Speicher, deshalb der Umweg über die Sicherung.',
      { title: 'Zum Home-Bildschirm hinzufügen' });
  } else if (done >= 10 && (days == null || days > 7) && !later('hinweis-backup')) {
    key = 'hinweis-backup'; days2 = 3;
    $('safety-text').textContent = days == null ? 'Deine Schrift ist noch nicht gesichert.' : `Deine letzte Sicherung ist ${days} Tage alt.`;
    $('safety-action').textContent = 'Jetzt sichern';
    $('safety-action').onclick = () => { banner.hidden = true; $('export-btn').click(); };
  } else return;
  $('safety-close').onclick = () => { banner.hidden = true; snooze(key, days2); };
  banner.hidden = false;
}

window.schriftbotInsert = (text, mode = 'replace') => {
  schreiben.insertText(cleanPasted(text), mode === 'append' ? 'append' : 'replace');
  showView('schreiben');
};

// PWA: Service Worker für Offline-Betrieb.
const offlineStatus = document.getElementById('status-offline');
if ('serviceWorker' in navigator) {
  // Neue Version installiert → Hinweis statt automatischem Neuladen (könnte mitten im Schreiben stören).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) document.getElementById('update-banner').hidden = false;
  });
  document.getElementById('update-reload').addEventListener('click', () => location.reload());

  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => caches.keys())
    .then(keys => {
      // Version anzeigen, damit man nach einem Update prüfen kann, ob es angekommen ist.
      const v = Math.max(...keys.map(k => +(k.match(/^handschrift-v(\d+)$/)?.[1] || 0)));
      offlineStatus.textContent = `Offline nutzbar · Version v${v}`;
      offlineStatus.className = 'status ok';
    })
    .catch(err => { offlineStatus.textContent = 'Offline-Modus nicht verfügbar: ' + err.message; offlineStatus.className = 'status warn'; });
} else {
  offlineStatus.textContent = 'Dieser Browser unterstützt keinen Offline-Modus.';
  offlineStatus.className = 'status warn';
}

// Safari darf Website-Daten sonst nach längerer Nichtnutzung löschen.
const storageStatus = document.getElementById('status-storage');
if (navigator.storage?.persist) {
  navigator.storage.persist().then(ok => {
    storageStatus.textContent = ok
      ? 'Dauerhafter Speicher aktiv'
      : 'Der Browser kann deine Daten bei Platzmangel oder längerer Nichtnutzung löschen – bitte regelmäßig sichern.';
    storageStatus.className = 'status ' + (ok ? 'ok' : 'warn');
  });
}
