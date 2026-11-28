# DeineSchrift

**Getippten Text in deine eigene Handschrift verwandeln.** DeineSchrift nimmt deine Handschrift einmal mit dem Apple Pencil (oder Finger/Maus) auf und schreibt danach jeden Text darin – als eigene Seiten oder direkt in ein Formular. Das Ergebnis gibst du als GoodNotes-Datei, PDF oder PNG weiter.

**Ausprobieren:** https://deineschrift.de/ · [Anleitung & häufige Fragen](https://deineschrift.de/anleitung)

- Kostenlos, ohne Anmeldung, ohne Cookies und Tracking
- Optimiert für Safari auf dem iPad, läuft in jedem aktuellen Browser (Handy unten mit Tab-Leiste, heller und dunkler Modus)
- Funktioniert nach dem ersten Öffnen komplett offline
- Reines HTML/CSS/JavaScript, ohne Build-Schritt
- Deine Daten bleiben auf deinem iPad (es gibt keinen Server)

---

## 1. Auf GitHub Pages veröffentlichen

Du brauchst nur ein kostenloses GitHub-Konto. Alles geht im Browser, auch auf dem iPad.

1. Auf [github.com](https://github.com) anmelden und oben rechts **＋ → New repository** wählen.
2. Name z. B. `handschrift-tool`, Sichtbarkeit **Public** (GitHub Pages ist für private Repos nur mit Bezahl-Konto möglich), dann **Create repository**.
3. Auf der leeren Repo-Seite **uploading an existing file** anklicken.
4. Alle Dateien und Ordner dieses Projekts hineinziehen:
   ```
   index.html
   anleitung.html
   datenschutz.html
   manifest.webmanifest
   sw.js
   sitemap.xml
   robots.txt
   llms.txt
   LICENSE
   README.md
   demo/         (optional, die Demo-Schrift)
   css/
   icons/
   js/
   vendor/       (mit vendor/pdfjs/ – wird zum Öffnen von Arbeitsblättern gebraucht)
   tests/        (optional, wird für die App nicht gebraucht)
   ```
   Wichtig: die Ordnerstruktur muss erhalten bleiben (`js/app.js`, nicht nur `app.js`).
5. Unten **Commit changes** klicken.
6. Im Repo **Settings → Pages** öffnen. Bei **Source** „Deploy from a branch“ wählen, bei **Branch** `main` und `/ (root)`, dann **Save**.
7. Nach etwa einer Minute steht oben auf der Seite die Adresse, z. B.
   `https://DEIN-NAME.github.io/handschrift-tool/`

## 1b. Vor dem Veröffentlichen

- **Beispielschrift** (empfohlen): Damit Besucher DeineSchrift sofort ausprobieren können, legst du eine Beispiel-Schrift bei.
  1. In DeineSchrift ein Profil mit der Beispielschrift aufnehmen (alle Zeichen, auch „ “ und Satzzeichen) und die Stil-Vorlage wählen, die Besucher zuerst sehen sollen.
  2. **Eigene Schrift → Teilen** und die Datei sichern.
  3. Sie im Repo als **`demo/demo-schrift.json`** hochladen und `VERSION` in `sw.js` hochzählen.

  Neue Besucher bekommen dann beim ersten Öffnen die Schrift „Marie · natürlich“ und starten im Tab „Schreiben“ mit leerem Textfeld; das Blatt zeigt einen kurzen Beispielsatz. Im Tab „Aufnahme“ steht stattdessen „Eigene Schrift aufnehmen“. Fehlt die Datei, startet Schriftbot wie bisher in der Aufnahme.
- **Vorschaubild**: `icons/og.png` (1200 × 630) erscheint, wenn jemand den Link teilt. Sobald die Demo-Schrift da ist, lohnt sich ein echtes Bild mit Handschrift.
- **Datenschutz**: `datenschutz.html` nennt als Kontakt GitHub Issues. Je nach Lage kann eine Anschrift nötig sein – im Zweifel rechtlich prüfen lassen.
- **Suchmaschinen**: Die Adresse in der [Google Search Console](https://search.google.com/search-console) und bei [Bing Webmaster Tools](https://www.bing.com/webmasters) anmelden und dort `sitemap.xml` einreichen. `robots.txt` liegt im Hauptordner und wirkt, weil die Seite auf der eigenen Domain im Wurzelverzeichnis läuft.
- **Hosting (Cloudflare Pages)**: Siehe Abschnitt 1c. Die Domain `deineschrift.de` bleibt bei GoDaddy registriert (Cloudflare nimmt keine .de-Domains zur Übertragung an), nur die DNS-Verwaltung liegt bei Cloudflare.
- **Umzug**: Unter der neuen Adresse ist der Browser-Speicher leer. Vorher **Alles sichern**, danach **Importieren**. Zieht die Seite erneut um, die Adresse in `index.html`, `anleitung.html`, `datenschutz.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `CNAME` und `ios/` ersetzen.

## 1c. Auf Cloudflare veröffentlichen (statt GitHub Pages)

Die Seite besteht nur aus fertigen Dateien, jeder Dateihoster reicht. Bei Cloudflare ist das kostenlos (hier als Worker mit statischen Dateien, `deineschrift.ada-atakul1.workers.dev`):

1. **Konto** auf [cloudflare.com](https://dash.cloudflare.com/sign-up) anlegen, **Domain hinzufügen** → `deineschrift.de` → Free-Plan. Cloudflare nennt zwei Nameserver.
2. Bei GoDaddy (Domain → DNS → Nameserver → „Eigene Nameserver verwenden“) diese beiden eintragen. Die Domain bleibt dort registriert (Cloudflare nimmt keine .de-Domains zur Übertragung an), nur die DNS-Verwaltung zieht um.
3. **Code automatisch von GitHub holen** (empfohlen): Beim Worker `deineschrift` unter **Settings → Builds → Connect** das Repo wählen (Cloudflare-GitHub-App erlauben), **Production branch** `main` (bis zum Mergen der Entwicklungs-Branch), **Build command** leer, **Deploy command** `npx wrangler deploy`. Die Dateien `wrangler.jsonc` und `.assetsignore` im Repo sagen, was veröffentlicht wird. Danach veröffentlicht jeder Push auf `main` die Seite neu. (Alternative ohne Git: `schriftbot-site.zip` im Dashboard hochladen.)
4. Beim Worker unter **Settings → Domains & Routes → Add → Custom domain** `deineschrift.de` und `www.deineschrift.de` eintragen. Bestehende alte DNS-Einträge (GitHub) vorher in der Cloudflare-DNS-Liste löschen.
5. **Update:** `VERSION` in `sw.js` hochzählen und nach `main` pushen, fertig.

Cloudflare entfernt `.html` aus Adressen: `anleitung.html` wird zu `/anleitung`. Die Seiten verweisen deshalb ohne Endung. Die Datei `_headers` (Sicherheits-Header) wird mit veröffentlicht; `tests/`, `tools/`, `ios/`, `.github/` und `README.md` nicht (siehe `.assetsignore`).

## 2. Auf dem iPad installieren

1. Die Adresse in **Safari** öffnen (nicht in Chrome – nur Safari kann Apps zum Home-Bildschirm hinzufügen).
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App ab jetzt immer über das neue Symbol starten. So läuft sie im Vollbild, offline, und Safari löscht ihre Daten deutlich seltener.
4. Unter **Eigene Schrift → Eingabe & Speicher** sollte „✅ Offline-Modus bereit“ stehen.

## 2b. Als iPad-App mit Claude (optional)

> Nur für dich selbst: Die App wird per Sideloading installiert. Für den App Store bräuchte es ein Apple-Entwicklerkonto, und eine Hülle um eine Webseite lehnt Apple meist ab (Richtlinie 4.2).

Im Ordner `ios/` liegt eine richtige iPad-App: links deine Handschrift-App, im Tab **Claude** das echte claude.ai mit deinem normalen Login (Dateien anhängen, Projekte, Verlauf – alles wie gewohnt). Tippst du unter einer Claude-Antwort auf Claudes **Kopieren**-Knopf, fragt die App: **In deine Handschrift übernehmen?** → **Text ersetzen** oder **Anhängen**, und springt in den Tab „Schreiben“. Exporte gehen über das Teilen-Menü an GoodNotes.

**App bekommen:** Bei jeder Änderung in `ios/` baut GitHub sie automatisch (Tab **Actions** → „iPad-App bauen“ → im Lauf unter **Artifacts** „Schriftbot-ipa“ herunterladen und entpacken). Von Hand starten: Actions → „iPad-App bauen“ → **Run workflow**.

**Installieren** (braucht einen Windows-PC oder Mac):

1. [Sideloadly](https://sideloadly.io) installieren, iPad per Kabel verbinden.
2. `Schriftbot.ipa` in Sideloadly ziehen, deine Apple-ID eingeben, **Start**.
3. Auf dem iPad: **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** einschalten (iPad startet neu), dann **Einstellungen → Allgemein → VPN & Geräteverwaltung** → deine Apple-ID → **Vertrauen**.
4. Mit einer kostenlosen Apple-ID läuft die App 7 Tage; danach in Sideloadly noch einmal installieren (deine Daten bleiben). Mit einem bezahlten Entwicklerkonto ein Jahr. AltStore kann das Erneuern automatisch übernehmen.

Gut zu wissen:

- Die App lädt die Handschrift-App von deineschrift.de: beim ersten Start braucht sie Internet, danach geht sie offline; Updates kommen automatisch mit.
- Bei Claude mit **E-Mail-Code** anmelden. Die Google-Anmeldung blockiert Google in Apps.
- Die App hat ihren eigenen Speicher (getrennt von Safari): Handschriften einmal per **Alles sichern** / **Importieren** übertragen.
- Die App liest nur die Zwischenablage, wenn du in Claude etwas kopierst – nicht den Chat selbst.

## 3. So benutzt du die App

### Handschrift aufnehmen (Bereich „Eigene Schrift“)

- Links wählst du das Zeichen, rechts schreibst du es mit dem Pencil in die drei Kästchen (= drei Varianten, damit die Schrift später lebendig wirkt).
- **Grundlinie** (dunkle Linie): Hier steht die Schrift. **x-Höhe** (blau gestrichelt): So hoch sind Kleinbuchstaben wie a, n, o. **Oberlänge / Unterlänge**: für b, d, h, k bzw. g, j, p, y.
- **Leerzeichen**: einen waagerechten Strich ziehen, so lang wie dein normaler Wortabstand.
- **Verbundene Paare** (ch, sch, ei …): so schreiben, wie du sie wirklich verbindest. Eigene Paare fügst du unten links hinzu.
- Farben in der Liste: weiß = fehlt, gelb = 1–2 Varianten, grün = fertig.
- **Nächstes fehlendes** springt zum nächsten unvollständigen Zeichen.
- **Kästchen an meine Schrift anpassen** (links oben): Misst, wie groß du Kleinbuchstaben wirklich schreibst, und verkleinert Kästchen und Hilfslinien passend. Deine Aufnahmen bleiben gleich groß und das PDF auch (die Schriftgröße im Schreiben-Tab wird ausgeglichen). Gilt auch für die Aufnahme als Text.
- Ohne Apple Pencil zeichnen Finger und Maus. Sobald du einmal mit dem Pencil schreibst, zählt nur noch er – Finger und Handballen werden dann ignoriert, damit du die Hand ablegen kannst. Umstellen: **Profil → Eingabe & Speicher**.

- Unter den Kästchen zeigt **„So sieht es im Text aus“** Beispielwörter mit dem aktuellen Zeichen in deiner Schrift. So fällt ein zu großer oder schiefer Buchstabe sofort auf.
- Beim Wechsel zum nächsten Zeichen rückt die App jede Variante mittig unter die Vorlage. Liegt ein Buchstabe nur knapp neben der Grundlinie, setzt sie ihn genau darauf.

Tipp: Schreib in normaler Größe und Geschwindigkeit, nicht „schön“. Je natürlicher die Aufnahme, desto echter das Ergebnis.

### Schneller: als Text aufnehmen

Oben links auf **Als Text** umschalten. Statt jedes Zeichen einzeln schreibst du einen kurzen Text (5 Seiten) über eine blasse Vorlage. Er enthält alle Buchstaben, Umlaute, ß, alle verbundenen Paare, Ziffern und Satzzeichen.

- Buchstaben **einzeln** schreiben, nur **gelb hinterlegte Gruppen verbunden**.
- Die Strichfarbe wechselt je Zeichen – so siehst du, welchem Zeichen ein Strich zugeordnet wird.
- **Übernehmen** speichert die Seite und blättert weiter. Gespeichert wird immer in eine freie Variante; vorhandene Aufnahmen werden nie überschrieben.
- Die Abstände zwischen deinen Wörtern werden automatisch als Leerzeichen übernommen.
- Text dreimal schreiben = drei Varianten für jedes Zeichen. Einzelne Zeichen kannst du jederzeit unter **Einzeln** nachbessern.

### Mitgelieferte Schriften

Unter **Schrift** (Leiste über der Vorschau) stehen zwölf echte Handschriften zur Auswahl, von ordentlich bis unordentlich. Sie stammen aus der freien Sammlung [UJIpenchars2](https://doi.org/10.24432/C5FG8S) (F. Prat, M. Castro, D. Llorens, A. Marzal, J. Vilar; Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de)): 60 Personen haben dort jedes Zeichen zweimal einzeln auf ein Tablet geschrieben.

- Für DeineSchrift umgerechnet: Grundlinie und x-Höhe je Person bestimmt, Ä/Ö aus den Punkten des Ü ergänzt, „/ + =“ einfach nachgebildet; ß wird als „ss“ geschrieben. Werkzeug: `tools/uji-schriften.py`.
- Es sind Einzelbuchstaben: Die Schrift wirkt wie ordentliche Druck-Handschrift, „Buchstaben verbinden“ hat hier keine Wirkung.
- Eine Schrift wird erst beim Auswählen geladen (Internet nötig) und liegt danach offline bereit.

### Text umwandeln (Bereich „Schreiben“ – hier startet die App)

- Links Text eingeben oder einfügen (darunter Wörter, Seiten und fehlende Zeichen), rechts erscheint die A4-Vorschau.
- **Leiste über der Seite**: Schrift (Galerie mit Schriftprobe; Stil, Papier und Tinte gelten für alle Schriften), Stil **Ordentlich / Normal / Locker**, **Papier** und **Tinte** als Aufklapp-Menüs, **Feineinstellungen** (Regler-Symbol) und **Neu würfeln**. Esc oder ein Tipp daneben schließt ein Menü.
- **Unter der Seite**: blättern („Seite 1 von 3“) und zoomen; 100 % zeigt die ganze Seite, ein Tipp auf die Prozentzahl setzt zurück.
- **Standard** beim ersten Öffnen: Stil Ordentlich, schwarze Tinte, liniertes weißes Papier.
- Beim allerersten Öffnen steht eine Seite Beispieltext im Feld, damit die Vorschau sofort etwas zeigt. Gibt es noch keine Schrift, erklärt ein Hinweis über der Vorschau den nächsten Schritt.
- **Exportieren** (oben rechts) öffnet ein Fenster: Format **GoodNotes, PDF oder Bild** und Hintergrund **Mit Papier** oder **Nur Schrift** (PNG mit durchsichtigem Hintergrund, PDF ohne Linien; die Vorschau zeigt dann ein Schachbrettmuster).
- **Hell/Dunkel**: Mond- bzw. Sonnen-Knopf oben rechts; Standard ist hell, die Wahl merkt sich das Gerät.
- **Leeren** über dem Textfeld: löscht den ganzen Text nach einer Rückfrage. Direkt danach holt **Gelöschten Text wiederherstellen** ihn zurück (bis du neu tippst).
- **Papier**: die GoodNotes-Vorlagen Blanko, Liniert breit, Liniert schmal, Kariert und Gepunktet, jeweils in **Weiß, Gelb oder Dunkel** (Papierfarbe). Jede Zeile steht genau auf einer Linie, Karolinie oder Punktreihe (bei Kariert und Gepunktet anfangs jede zweite Reihe, änderbar über „Zeilenabstand“). Für dunkles Papier gibt es weiße Tinte.
- **Stil-Vorlage**: Sehr ordentlich, Ordentlich, Normal, Locker, Unordentlich oder Sehr unordentlich (alle unter **Feineinstellungen**). Unter **Regler der Vorlage** lässt sich jeder Wert ändern: Deine Werte bleiben für genau diese Vorlage gespeichert („Angepasst“), **Vorlage zurücksetzen** holt die Originalwerte zurück.
- Feineinstellungen (gehören zur gewählten Vorlage):
  - **Buchstaben verbinden**: wie oft verbundene Paare statt Einzelbuchstaben genutzt werden.
  - **Unregelmäßigkeit** (bis 150 %): kleine Drehungen, Größen- und Abstandsunterschiede, leichte Schräglage.
  - **Durchgestrichene Wörter**: wie oft ein Wort erst falsch angefangen (Buchstabendreher oder falscher Buchstabe), durchgestrichen und daneben richtig geschrieben wird. „aus“ = nie; bei 100 % etwa alle paar Sätze mehrmals. Verschreiber nutzen nur aufgenommene Zeichen, **Neu würfeln** verteilt sie neu. In GoodNotes ist der Streichstrich ein eigener, radierbarer Strich.
  - **Kleine Korrekturen**: Ab und zu wird ein Buchstabe nachgezogen, oder ein Wort wird erst vergessen und dann klein über der Zeile mit einem **^** eingefügt.
  - **Nachlassen zum Ende**: Je weiter der Text, desto größer, schräger, weiter und unordentlicher wird die Schrift – wie am Ende eines langen Briefs.
  - **Wellige Zeilen**: Zeilen schwanken leicht, der Druck wechselt von Wort zu Wort und lässt zum Zeilenende nach.
  - **Unruhige Zeilenränder**: Zeilenanfänge rücken mal etwas ein, Zeilen brechen rechts mal früher um – wie beim echten Schreiben.
  - **Strichdicke**: dünner oder kräftiger (40–250 %), gilt für Vorschau und alle Exporte.
- **Tintenfarbe**: feste Farben oder der Regenbogen-Knopf mit dem **Farbton**-Regler für jede beliebige Tintenfarbe.
- **Schriftgröße, Zeilenabstand, Rand** nach Geschmack. **Rand** verschiebt den ganzen Text, **Zeilen versetzen** rückt jede Zeile für sich etwas nach links oder rechts (Standard 20 %).
- **Neu würfeln**: andere Mischung der Varianten.
- **Größen angleichen**: Bringt zu kleine oder zu große Buchstaben auf die typische Größe deiner übrigen Buchstaben (getrennt nach Kleinbuchstaben, Oberlängen, Großbuchstaben und Ziffern). Deine Proportionen bleiben, nur Ausreißer über 15 % werden korrigiert. i, j, t, Umlaute und Satzzeichen bleiben unberührt. Vor dem Übernehmen zeigt die App, welche Zeichen sich ändern. **Angleichen rückgängig** geht, bis du die App schließt.
- Fehlende Zeichen werden **rot markiert** und unter dem Textfeld aufgelistet.
- Der Abstand zwischen Buchstaben richtet sich nach ihrer Form: Ein o rückt unter das Dach eines T, schräge Schrift wird nicht zu breit.

## 4. Backup – wichtig!

Deine Handschriften liegen nur im Speicher von Safari auf diesem iPad. Wird die App gelöscht oder Safari-Daten entfernt, sind sie weg.

- **Eigene Schrift → Alles sichern** packt alle eigenen Handschriften und das Aussehen (Stil, Tinte, Papier) in eine `.json`-Datei. Im Teilen-Menü „In Dateien sichern“ wählen, am besten in iCloud Drive. Mitgelieferte Schriften sind nicht dabei, sie lassen sich jederzeit neu laden.
- **Teilen** schickt die gerade aufgenommene Handschrift als Datei, z. B. per AirDrop oder Nachricht.
- **Importieren** liest eine solche Datei ein. Die Handschriften kommen **neu dazu**, vorhandene bleiben unangetastet (gleiche Namen werden durchnummeriert). Auf einem neuen Gerät ersetzt der Import die leere Start-Handschrift und übernimmt auch das Aussehen. Ältere Sicherungen funktionieren weiter; Profile, die nur die Schrift eines anderen benutzten, werden dabei übersprungen.
- In der Datei stehen nur Schriften und Stil-Einstellungen – keine Texte und keine Geräte-Einstellungen.
- Ein **roter Punkt am Tab „Eigene Schrift“** und ein Hinweis oben erinnern dich, wenn das letzte Backup älter als 7 Tage ist.
- Auf iPad/iPhone erscheint außerdem der Hinweis **„Zum Home-Bildschirm hinzufügen“**: In Safari darf eine normale Website ihre Daten nach 7 Tagen ohne Nutzung verlieren, als Home-Bildschirm-App nicht. Die Home-Bildschirm-App hat einen eigenen Speicher – vorher sichern, dort importieren.

## 5. Updates einspielen

1. Geänderte Dateien in GitHub hochladen (gleiche Stelle, überschreiben).
2. In `sw.js` die Zeile `const VERSION = 'v55';` hochzählen (z. B. auf `'v56'`). **Ohne diesen Schritt sieht das iPad die alten Dateien.**
3. App auf dem iPad öffnen. Nach ein paar Sekunden erscheint „Eine neue Version ist bereit“ → **Neu laden**.

## 6. Probleme lösen

| Problem | Lösung |
|---|---|
| Pencil schreibt nicht | Mit dem Pencil direkt ins Kästchen schreiben. |
| Finger zeichnet nicht mehr | Nach dem ersten Pencil-Strich zählt nur noch der Pencil. Eigene Schrift → Eingabe & Speicher → „Finger und Maus zum Schreiben erlauben“. |
| Alte Version wird angezeigt | App ganz schließen (von unten wischen) und neu öffnen, ggf. zweimal. |
| Teilen-Menü zeigt GoodNotes nicht | Im Teilen-Menü ganz nach rechts wischen → „Mehr“ → GoodNotes aktivieren. |
| Zeichen fehlen rot im PDF | Die markierten Zeichen im Tab „Aufnahme“ nachtragen. |
| Handschrift ist weg | Eigene Schrift → Importieren und das letzte Backup wählen. |

## 7. Für Entwickler

Projektstruktur:

```
index.html              Oberfläche (Tabs, auf dem Handy unten), Icons, Meta-Daten und strukturierte Daten (JSON-LD)
anleitung.html          Anleitung, Vergleich, häufige Fragen (HowTo/FAQ als JSON-LD) – für Menschen und Suchmaschinen
datenschutz.html        Datenschutz, Marken, Lizenzen
css/app.css             Gestaltung, Touch-Größen, heller und dunkler Modus
css/seite.css           Gestaltung der Textseiten
sitemap.xml, llms.txt   für Suchmaschinen und KI-Suchen
icons/og.png            Vorschaubild für geteilte Links
demo/demo-schrift.json  (optional) Demo-Schrift für den ersten Start, siehe 1b
js/app.js               Start, Navigation, Offline/Updates, Hinweise (Home-Bildschirm, Sicherung)
js/demo.js              Demo-Schrift beim ersten Start anlegen
js/tutorial.js          Kurze Einführung (erster Start und ?-Knopf)
js/aufnahme.js          Modul 1: Pencil-Aufnahme
js/schreiben.js         Modul 2: Textfeld, Vorschau, Einstellungen, Export-Knöpfe
js/blatt.js             Arbeitsblatt: blaue Antworten finden/entfernen, Felder, Einpassen
js/blattui.js           Tab Blatt: Felder verschieben, aufziehen, bearbeiten, Export
js/pdfimport.js         PDF (pdf.js) und Fotos einlesen, 200 dpi
js/layout.js            Satz: Paare, Varianten, Unordnung, Umbruch, Seiten, Linien
js/render.js            Zeichnen auf Canvas (Vorschau, PNG)
js/paper.js             GoodNotes-Papiervorlagen (Maße, Farben)
js/stil.js              Stil-Vorlagen, Anpassungen je Vorlage, Farbton
js/profilwahl.js        Schrift-Galerie; eigene Handschriften anlegen, wechseln, umbenennen, löschen
js/sammlung.js          Datei mit mehreren Handschriften: Backup, Teilen
js/dialog.js            Eigene Dialoge (Bestätigen, Hinweis, Eingabe, Auswahl)
js/einfuegen.js         Eingefügten Text bereinigen und einsetzen
js/export.js            PDF (Vektor), PNG, Teilen
js/goodnotes.js         .goodnotes-Notizbuch (ZIP + Protobuf, Kugelschreiber-Striche)
js/ink.js               Strichumrisse mit Druck (perfect-freehand)
js/profile.js           Zeichensatz, Profil-Format, Import-Prüfung
js/profil.js            Eigene Schrift: Backup, Teilen, Import, Eingabe (Finger/Maus)
js/vorschau.js          Schriftprobe „Hallo“ für die Galerie (vorschau-daten.js: tools/vorschau.mjs)
js/storage.js           IndexedDB und Einstellungen
sw.js                   Service Worker (Offline-Cache)
ios/                    iPad-App (SwiftUI + WKWebView): Handschrift-App, echtes claude.ai, Übernehmen, Teilen
.github/workflows/ios.yml  baut die iPad-App als .ipa (GitHub Actions, macOS)
vendor/                 perfect-freehand 1.2.2, jsPDF 2.5.2 (beide MIT), pdf.js 4.10.38 (Apache-2.0, wird erst beim ersten Blatt geladen), Feather-Lizenz
LICENSE                 MIT
tests/                  Selbsttests
```

Profil-Format: Koordinaten sind in x-Höhen normiert (Grundlinie y = 0, x-Höhe y = −1), jeder Punkt ist `[x, y, Druck, ms]`.

Selbsttests (Node.js ≥ 18):

```
node tests/profile.test.mjs
node tests/layout.test.mjs
node tests/export.test.mjs
node tests/goodnotes.test.mjs
node tests/textplan.test.mjs
node tests/blatt.test.mjs
node tests/paper.test.mjs
node tests/stil.test.mjs
node tests/storage.test.mjs
node tests/sammlung.test.mjs
node tests/einfuegen.test.mjs
```

Lokal starten (Service Worker braucht `localhost` oder HTTPS):

```
python -m http.server 8765
```

Dann `http://localhost:8765` öffnen. Neue Dateien müssen in `sw.js` in der Liste `FILES` eingetragen werden.
