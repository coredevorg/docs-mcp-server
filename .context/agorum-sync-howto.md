# agorum-Sync: HOWTO für den nächsten Update-Sync

**Zielgruppe:** Operator (= du), der einen neuen agorum-Doku-Export
in die beiden docs-mcp-server-Instanzen einspielen will.

**Zugehörige Dokumente:**
[agorum-sync-plan.md](agorum-sync-plan.md) (Design-Hintergrund),
[agorum-sync-implementation-log.md](agorum-sync-implementation-log.md) (Rollout-Protokoll 2026-04-12)

---

## TL;DR

```bash
# 1. Neuen Export vom Fetch-Backend ziehen
#    (normalerweise per Cron via ~/Developer/acdocs/update-agorum-docs.sh)
#    → Ergebnis: ~/.acdocs/work/acdocs-live/

# 2. Sync prüfen und ausführen
cd ~/Developer/MCP/docs-mcp-server
npm run sync:agorum -- --dry-run
npm run sync:agorum

# 3. Index auf beiden Hosts refreshen
docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum
ssh root@sourcebot.coredev.org \
  'docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum'
```

Bei typischen Updates läuft das in unter 30 Sekunden durch. Wenn
du nichts davon verstehst oder etwas kaputt geht, lies weiter.

---

## Voraussetzungen

- **SSH-Zugriff** zu `root@sourcebot.coredev.org` funktioniert
  (Key ist hinterlegt, keine Passwort-Abfrage).
- **VPN aktiv** für den direkten Remote-Zugriff auf
  `http://sourcebot.coredev.org:6280`, falls du via Web-UI
  nachsehen willst.
- **Docker-Stack lokal oben.** Check mit
  `docker compose ps`. Wenn nicht, `docker compose start`.
- **Docker-Stack auf sourcebot oben in der Screen-Session.** Check mit
  `ssh root@sourcebot.coredev.org 'screen -ls | grep docsmcp'`.
  Wenn die Session fehlt, siehe Abschnitt "Sourcebot-Stack
  wieder starten" unten.
- **rsync** auf dem Mac installiert (default im macOS vorhanden).

---

## Schritt 1: Neuen Export besorgen

Das Fetch-Backend `acdocs` legt den Live-Export nach
`~/.acdocs/work/acdocs-live/` ab — mit nummerierten Dateinamen
(`0001 - …md`) und einem doppelten Frontmatter-Schema: außen
(`name`, `uuid`, `title`, `generated_at`, …), innen (`name`,
`uuid`, `date`, `link`, `path`, `topic`).

Der Export läuft normalerweise automatisch per Cron über
`~/Developer/acdocs/update-agorum-docs.sh` (das auch Sync und
Refresh gleich mit anstößt). Details sind Sache des
acdocs-Projekts und nicht Teil dieses HOWTOs.

**Kontrolle:** Der Ordner muss existieren und ~1000+
`.md`-Dateien enthalten.

```bash
ls ~/.acdocs/work/acdocs-live/ | wc -l
```

**Hinweis Duplikate:** Ältere Stände des Exporters ließen bei
jedem Lauf Altkopien mit verschobener Nummerierung liegen (gleiche
uuid unter mehreren Dateinamen). Das Sync-Skript löst das selbst
auf — es nimmt pro uuid die Kopie mit dem neuesten `generated_at`
und meldet `Note: ignored N older duplicate copies`. Seit dem Fix
in `acdocs-app` (generate-files räumt vor dem Schreiben alte
`NNNN - *`-Dateien weg, 2026-07-19) sollte N bei 0 liegen; eine
wieder wachsende Zahl deutet auf eine Regression im Exporter hin.

---

## Schritt 2: Sync ausführen

### Dry-Run zuerst

```bash
cd ~/Developer/MCP/docs-mcp-server
npm run sync:agorum -- --dry-run
```

Was passiert dabei:

- Das Skript liest `~/.acdocs/work/acdocs-live/` (überschreibbar
  mit `--source <dir>`).
- Duplikate (gleiche uuid in mehreren Dateien) werden aufgelöst:
  die Kopie mit dem neuesten `generated_at` gewinnt.
- Es normalisiert das Frontmatter im Arbeitsspeicher: die bei
  jedem Fetch-Lauf rauschenden Felder `generated_at` (äußerer
  Block) sowie `date` und `topic` (innerer Block) werden
  entfernt, Rest bleibt 1:1. So bleiben inhaltlich unveränderte
  Dokumente byte-identisch zwischen Syncs.
- Byte-Vergleich mit dem lokalen Ziel
  (`data/docs/agorum/<uuid>.md`).
- rsync läuft als `--dry-run` und zeigt dir die geplanten
  Remote-Transfers, ohne sie auszuführen.

**Erwarteter Output bei einem typischen Update:**

```
=== Local Transform (dry-run) ===
  new:       0      ← oder kleine Zahl, wenn neue Doku dazukam
  updated:   5      ← Anzahl inhaltlich geänderter Dokumente
  deleted:   1      ← wenn eine Seite aus der Doku verschwand
  unchanged: 1069   ← der große Rest

=== rsync (dry-run) ===
  rsync -a --checksum --delete --itemize-changes --dry-run ...
  <fcst.... <uuid1>.md
  <fcst.... <uuid2>.md
  ...
```

**Prüfpunkte:**

- `unchanged`-Zahl sollte **die Mehrheit** sein. Falls alle
  Dateien `updated` sind, stimmt etwas nicht (siehe
  Troubleshooting).
- Die `new`+`updated`+`deleted`-Liste der ersten 5 Einträge sollte
  plausibel aussehen — wenn du dort eine Datei siehst, die zu
  einem Doku-Bereich gehört, bei dem du gar keine Änderung
  erwartest, lohnt sich ein zweiter Blick.

### Echter Sync

Wenn der Dry-Run plausibel aussieht:

```bash
npm run sync:agorum
```

Das ist identisch zum Dry-Run, nur dass jetzt wirklich geschrieben
und transferiert wird. Ausgabe zeigt den finalen Report plus am
Ende die zwei Refresh-Befehle zum Copy-Paste.

---

## Schritt 3: Refresh auslösen

Das Sync-Skript triggert den Refresh **nicht** automatisch. Die
Ausgabe am Ende sieht so aus (ggf. Copy-Paste direkt von dort):

```bash
# Lokal:
docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum

# Sourcebot (via SSH):
ssh root@sourcebot.coredev.org 'docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum'
```

**Reihenfolge egal.** Beide können parallel laufen oder
nacheinander. Ein typischer Refresh mit wenigen Änderungen ist
in unter 5 Sekunden durch. Wenn du die Dauer misst (`time ...`),
kannst du direkt sehen, ob der mtime-Delta-Skip greift:

- **< 5 Sekunden:** Super, Delta-Skip hat funktioniert,
  nur die geänderten Dateien wurden re-processed.
- **30 Sekunden bis mehrere Minuten:** Irgendwas hat den
  Delta-Skip gebrochen. Entweder wurden die mtimes falsch
  geschrieben (rsync ohne `--checksum`?) oder es gab
  tatsächlich hunderte Änderungen. Siehe Troubleshooting.

**Output am Ende eines erfolgreichen Refreshs** sieht so aus:

```
🌐 Scraping page 1075/1076 (depth 1/3): file:///app/docs/agorum/virtual-root.md
✅ Job completed: <uuid>
✅ Successfully refreshed 1075 pages
```

"Successfully refreshed 1075 pages" heißt "1075 Pages **geprüft**"
— nicht "1075 Pages neu embedded". Wenn die Zeit unter 5 s lag,
wurde fast nichts davon wirklich neu verarbeitet.

---

## Schritt 4: Spot-Check der Suche (optional)

Zur Sicherheit eine Query absetzen, die ein erwartbar bekannter
Treffer sein sollte. Via MCP-Tool in Claude Code:

```
mcp__docs-mcp-server__search_docs
  library=agorum
  query=agorum Cardlets
```

Oder per CLI im Container:

```bash
docker exec cdev-docs-mcp-worker node /app/dist/index.js search agorum "agorum Cardlets" --limit 3
ssh root@sourcebot.coredev.org 'docker exec cdev-docs-mcp-worker node /app/dist/index.js search agorum "agorum Cardlets" --limit 3'
```

Wenn beide Umgebungen vergleichbare Top-Treffer liefern, ist
alles in Ordnung.

---

## Troubleshooting

### "No agorum-* directory found in ~/.acdocs/work"

Der Fetch-Export hat kein Verzeichnis angelegt, das mit `agorum-`
beginnt. Entweder der Export ist fehlgeschlagen, oder dein acdocs-
Workflow verwendet ein anderes Namensschema.

**Fix:** Explizit per Flag angeben:

```bash
npm run sync:agorum -- --source ~/.acdocs/work/<dein-verzeichnis> --dry-run
```

### `updated=1075` (alle Dateien sind geändert)

Das sollte nicht passieren. Wenn doch, gibt es drei plausible
Ursachen:

1. **Frontmatter-Schema hat sich geändert.** Das acdocs-Tool schreibt
   jetzt ein zusätzliches Feld, das zwischen Exporten rauscht.
   → Prüfen: `diff <(head -15 <source-file>) <(head -15 data/docs/agorum/<uuid>.md)`.
   Wenn ein neues Feld wie `fetched_at` oder ähnlich auftaucht,
   muss es in [scripts/sync-agorum-docs.ts](../scripts/sync-agorum-docs.ts)
   in die `DROP_KEYS`-Konstante aufgenommen werden.

2. **Jemand hat das Ziel-Verzeichnis manuell angepackt.** Z.B. ein
   Git-Checkout, der Line-Endings konvertiert hat, oder ein
   Editor, der BOM-Präfixe einfügt.
   → Prüfen: `file data/docs/agorum/<beliebige-datei>.md` sollte
   "UTF-8 Unicode text" melden, nicht "UTF-8 with BOM" oder
   ähnliches.

3. **mtime-Drift auf dem Dateisystem.** Wenn ein Backup-Restore oder
   ein `touch *` die mtimes reset hat, meldet der rsync-Schritt
   zwar `unchanged`, aber der Refresh bezweifelt die ETags.
   → Nicht das Sync-Skript, sondern der Refresh wäre betroffen.
   Im Zweifel Library löschen + neu scrapen wie beim Erst-Rollout
   (siehe unten).

### Refresh läuft minutenlang

Dann greift der 304-Skip nicht. Ursachen:

1. **rsync hat mit `--checksum` gestartet, aber beim Sync gab es
   echte Änderungen.** Das ist normal — jede wirklich geänderte
   Datei braucht wieder Embedding-Zeit (~0,5–2 s pro Page).
   Bei 5 geänderten Dateien: OK. Bei 500: unwahrscheinlich für
   einen normalen Update-Zyklus, aber möglich wenn der Tree
   reorganisiert wurde.

2. **Das Skript wurde ohne `--checksum` modifiziert.** Prüfen:
   `grep checksum scripts/sync-agorum-docs.ts`. Muss drin stehen.

3. **rsync hat durch irgendeinen Zufall alle mtimes gebumpt.**
   Sehr unwahrscheinlich bei `-a --checksum`, aber theoretisch
   möglich, wenn der Remote-Host eine andere Zeitzone oder
   ähnliches Problem hat. → Einmal mit `rsync -a --checksum
   --delete -nv` manuell checken, dass bei einem Dry-Run **keine**
   Transfers angezeigt werden, wenn lokal und remote wirklich
   byte-gleich sind.

### "Library agorum not found" beim Refresh

Der Container war beim Scrape nicht oben, oder die Library wurde
zwischendrin gelöscht. → Web-UI öffnen (http://localhost:6280 oder
http://sourcebot.coredev.org:6280), Library-Liste prüfen. Wenn
`agorum` fehlt, einen neuen Scrape-Job starten (nicht Refresh):

Web-UI → Add Job → URL: `file:///app/docs/agorum/`, Library: `agorum`,
Version: leer lassen, **maxPages auf 2000 setzen** (Default ist
1000 und schneidet den Scrape bei 1018+ Pages ab — Stolperstein
vom 2026-04-12).

### Sourcebot-Stack wieder starten

Falls die Screen-Session `docsmcp` auf sourcebot fehlt:

```bash
ssh root@sourcebot.coredev.org
# erst prüfen, ob der Stack anders läuft:
cd ~/docs-mcp-server
docker compose ps

# Wenn alle Container Exited sind:
docker compose stop  # sauberstellen
screen -dmS docsmcp bash -c 'cd ~/docs-mcp-server && docker compose up'

# Kontrolle:
screen -ls | grep docsmcp
docker compose ps
```

Console live ansehen (zum Debuggen):

```bash
ssh root@sourcebot.coredev.org
screen -r docsmcp
# Ctrl-A, d  → wieder ablösen (Stack läuft weiter)
```

### rsync schlägt fehl mit "Permission denied"

SSH-Key zu `root@sourcebot.coredev.org` fehlt oder ist nicht
geladen. → `ssh-add -l` prüfen, ggf. Key nachladen. Als
Zwischenlösung kann das Skript auch mit `--no-remote` laufen —
dann macht es nur den lokalen Sync, du kannst den rsync später
manuell nachholen:

```bash
npm run sync:agorum -- --no-remote
# ... SSH-Problem fixen ...
rsync -a --checksum --delete -v \
  data/docs/agorum/ \
  root@sourcebot.coredev.org:/root/docs-mcp-server/data/docs/agorum/
```

---

## Eilige Notfall-Optionen

### Nur lokal syncen (sourcebot skippen)

```bash
npm run sync:agorum -- --no-remote
docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum
```

### Gezielt eine andere Source verwenden

```bash
npm run sync:agorum -- --source ~/.acdocs/work/agorum-2026-03-01 --dry-run
```

### Frontmatter in einem fremden Verzeichnis in-place normalisieren

Für Migrations-Zwecke — nur dann nutzen, wenn du weißt, warum:

```bash
npm run sync:agorum -- --normalize-inplace /pfad/zum/verzeichnis --dry-run
npm run sync:agorum -- --normalize-inplace /pfad/zum/verzeichnis
```

### Kompletter Re-Index (nuclear option)

Wenn die Index-DB korrumpiert oder inkonsistent ist und ein
Refresh das Problem nicht mehr löst:

1. Web-UI öffnen (http://localhost:6280 bzw. sourcebot).
2. Papierkorb neben Library `agorum` klicken, "Confirm".
3. "Add Job" Formular → URL `file:///app/docs/agorum/`,
   Library `agorum`, Version leer, **maxPages ≥ 2000**.
4. Scrape starten. Dauer: ~2-3 Minuten pro Umgebung,
   ~$0.06 Embedding-Kosten.

---

## Verification-Commands zum Copy-Paste

Prüfen, ob beide Umgebungen auf demselben Stand sind:

```bash
# Lokal:
ls data/docs/agorum | wc -l
docker exec cdev-docs-mcp-worker node /app/dist/index.js list

# Remote:
ssh root@sourcebot.coredev.org 'ls /root/docs-mcp-server/data/docs/agorum | wc -l'
ssh root@sourcebot.coredev.org 'docker exec cdev-docs-mcp-worker node /app/dist/index.js list'
```

Beide `wc -l`-Ausgaben müssen identisch sein. Beide `list`-Outputs
müssen dieselbe `uniqueUrlCount` und `documentCount` zeigen.
