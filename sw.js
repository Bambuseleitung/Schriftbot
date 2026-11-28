// Bei jeder Änderung an den Dateien VERSION hochzählen, sonst sieht das iPad die alte Version.
const VERSION = 'v56';
const CACHE = 'handschrift-' + VERSION;
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/blatt.js',
  'js/blattui.js',
  'js/pdfimport.js',
  'js/paper.js',
  'js/stil.js',
  'js/profilwahl.js',
  'js/sammlung.js',
  'js/einfuegen.js',
  'js/dialog.js',
  'js/demo.js',
  'js/schriften.js',
  'js/vorschau.js',
  'js/vorschau-daten.js',
  'js/gemini.js',
  'js/kiblatt.js',
  'js/tutorial.js',
  'js/aufnahme.js',
  'js/export.js',
  'js/goodnotes.js',
  'js/ghost.js',
  'js/ink.js',
  'js/pen.js',
  'js/textaufnahme.js',
  'js/textplan.js',
  'js/layout.js',
  'js/render.js',
  'js/schreiben.js',
  'js/profil.js',
  'js/profile.js',
  'js/storage.js',
  'vendor/perfect-freehand.mjs',
  'vendor/jspdf.umd.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' am Browser-Cache vorbei: GitHub Pages lässt Dateien 10 Minuten cachen,
  // sonst landet in der neuen Version womöglich der alte Code.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst bei Bedarf geladen und dann für offline gemerkt: pdf.js (3 MB, nur fürs Blatt) und die Seiten
// Anleitung/Datenschutz. Die Demo-Schrift kommt immer frisch, wenn online (sie wird nur beim ersten Start gebraucht).
const LAZY = /\/(vendor\/pdfjs\/|anleitung(\.html)?$|datenschutz(\.html)?$|impressum(\.html)?$|gemini-schluessel(\.html)?$|css\/seite\.css$|icons\/|schriften\/)/;
const FRESH = /\/demo\//;

// Cache zuerst, damit die App offline sofort startet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (FRESH.test(url.pathname)) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && LAZY.test(url.pathname)) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  })));
});
