# agorum-Sync: Design-Plan

**Erstellt:** 2026-04-12
**Status:** umgesetzt und in Produktion
**Zugehörige Dokumente:**
[agorum-sync-implementation-log.md](agorum-sync-implementation-log.md) (Protokoll),
[agorum-sync-howto.md](agorum-sync-howto.md) (Operator-Anleitung)

## Kontext und Motivation

Die agorum-Dokumentation wird regelmäßig aus dem Fetch-Backend
`acdocs` ([/Users/bst/Developer/acdocs](../../acdocs)) als Markdown-Tree
in ein Verzeichnis nach dem Muster `~/.acdocs/work/agorum-<YYYY-MM-DD>/`
exportiert. Dieser Tree muss in die Library `agorum` auf **zwei**
docs-mcp-server-Instanzen übertragen und dort reindexiert werden:

- **Lokal** auf dem Entwickler-Mac unter `data/docs/agorum/`
- **Produktiv** auf `root@sourcebot.coredev.org:~/docs-mcp-server/data/docs/agorum/`

Ein naiver 1:1-Kopie-Workflow ist aus mehreren Gründen untauglich:

1. **Dateinamen im Export sind instabil.** Das acdocs-Tool nummeriert
   Dateien als `001 - Titel.md`, `002 - …md` usw. Die Nummerierung
   verschiebt sich bei jeder Revision, sobald ein Dokument eingefügt
   oder entfernt wird. Für docs-mcp-server's `refresh_version` (das
   ETag-/mtime-basiertes 304-Skip nutzt) wirkt das wie ein kompletter
   Neubestand: jeder Refresh würde jede Seite re-embedden.

2. **Zwei Frontmatter-Felder rauschen bei jedem Export.**
   [acdocs-lib/src/fileGenerator.ts:474](../../acdocs/acdocs-lib/src/fileGenerator.ts#L474)
   setzt `date: new Date().toISOString()` zum Schreibzeitpunkt — auch
   auf Dateien, deren Inhalt sich nicht geändert hat. `topic` trägt
   den Revisions-Ordnernamen. Beide Felder würden den Byte-Vergleich
   zwischen alter und neuer Revision vollständig zerstören.

3. **Multi-Target-Distribution.** Ein einfaches Shell-Copy-Skript
   müsste dieselbe Transformation zweimal ausführen und dabei einen
   Sync-Kanal zum Remote-Host aufbauen. Fehleranfällig und
   uneinheitlich.

4. **Kein Refresh-Button im Web-UI von sourcebot.** sourcebot läuft
   auf docs-mcp-server v1.27.0, der Refresh-Button kam erst in einer
   späteren Upstream-Version. Der Refresh muss also über einen
   zweiten Kanal (CLI im Container) ausgelöst werden.

## Entwurfsziele

- **Stabile Dateinamen:** Jedes Dokument bekommt als Dateinamen seine
  UUID aus dem Frontmatter. Umnummerierungen im Export sind dadurch
  unsichtbar für den Sync-Workflow.
- **Stabile Bytes bei inhaltlich unveränderten Dokumenten:** Das
  normalisierte Zielfile ist deterministisch — zweimal dieselbe
  Source produziert zweimal dieselben Target-Bytes.
- **Echter Delta-Transport:** `rsync --checksum --delete` überträgt
  nur tatsächlich geänderte Dateien. mtime bleibt auf unveränderten
  Dateien im Ziel stabil, daher greift der 304-Skip von
  `refresh_version`.
- **Einheitlicher Refresh-Trigger:** `docker exec ... refresh agorum`
  — lokal direkt, remote via SSH. Kein Web-UI-Klick nötig, keine
  MCP-Schreib-Tools.
- **Keine Skript-Magie.** Das Skript triggert den Refresh nicht
  automatisch, sondern gibt die Befehle zum Copy-Paste aus. Der
  Operator behält die Kontrolle.

## Frontmatter-Felder: welche bleiben, welche fallen weg

Quelle: [FrontMatterMiddleware.ts](../src/scraper/middleware/FrontMatterMiddleware.ts)
liest aus den Feldern.

| Feld  | Zweck                                         | Konsumiert vom Server? | Sync-Verhalten                   |
| ----- | --------------------------------------------- | ---------------------- | -------------------------------- |
| `name`| Dokumenttitel                                 | Ja                     | erhalten                         |
| `uuid`| Dokument-Identität, Dateiname                 | Ja                     | erhalten (und = Dateiname)       |
| `link`| Source-Link für Suchergebnisse                | Ja                     | erhalten                         |
| `path`| Hierarchischer Pfad fürs Chunking             | Ja                     | erhalten                         |
| `date`| Export-Zeitpunkt, bei jedem Lauf neu          | Nein                   | **entfernt**                     |
| `topic`| Revisions-Ordnername, variiert pro Export    | Nein                   | **entfernt**                     |
| *sonstige* | unbekannt                                | unbekannt              | erhalten (forward-kompatibel)    |

Sonstige Felder bleiben im Dokument-Frontmatter erhalten, um die
Kompatibilität mit zukünftigen acdocs-Feldern nicht zu brechen.

## Architektur-Überblick

```text
~/.acdocs/work/agorum-<neueste>/      ← acdocs-Fetch-Tool Output
         │
         ▼
  [Transform]                         ← Frontmatter normalisieren,
  UUID als Dateiname                    date/topic entfernen
         │
         ▼
  data/docs/agorum/  (lokales Ziel)   ← atomic write, byte-diff,
                                        delete verwaiste UUIDs
         │
         ▼
  [rsync --checksum --delete]
         │
         ▼
  root@sourcebot:.../data/docs/agorum/   (Remote-Ziel,
                                           byte-identisch zu lokal)
         │
         ▼
  [Manueller Refresh-Trigger]
  docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum
  (lokal direkt, remote via SSH)
```

Die beiden Ziele sind nach dem Sync **byte-identisch**. Das ist
nicht nur ein schöner Nebeneffekt, sondern operative Voraussetzung:
Beide Umgebungen haben dieselbe `mtime`-Matrix, beide Refreshes
skippen dieselben 304-Pages, und bei Debugging-Aufgaben können
Pfade und UUIDs 1:1 zwischen Mac und Server verglichen werden.

## Sync-Algorithmus

Pro Source-File:

1. Lesen, Frontmatter parsen, `uuid` extrahieren. Fehlt `uuid` →
   harter Fehler.
2. Normalisierungs-Pass: `date` und `topic` aus dem Frontmatter
   streichen, Rest bleibt byte-für-byte erhalten (inklusive
   ursprünglicher Feldreihenfolge, Umlaute, Escaping). Der
   Body hinter dem Frontmatter wird nicht angefasst.
3. Ziel-Pfad = `<local-target>/<uuid>.md`.
4. Existiert das Ziel bereits?
   - **Nein:** atomic write (temp-Datei + `rename()`), zähle als `new`.
   - **Ja, byte-identisch zum normalisierten Source-Ergebnis:**
     unangetastet lassen, zähle als `unchanged`.
   - **Ja, aber abweichend:** atomic write, zähle als `updated`.
5. UUID-Kollisions-Check: Zwei Source-Files mit derselben UUID →
   harter Fehler mit beiden Pfaden in der Meldung.

Nach dem Durchlauf aller Source-Files:

6. Alle `*.md` im Ziel, deren UUID nicht im Source-Satz vorkommt,
   werden gelöscht (`deleted`).
7. rsync mit `-a --checksum --delete --itemize-changes` vom lokalen
   Ziel nach Remote-Ziel. `--checksum` verhindert, dass rsync bei
   unterschiedlichen mtimes aber gleichem Inhalt unnötig überträgt.
8. Report ausgeben: `{new, updated, deleted, unchanged}` plus
   rsync-Output plus zwei Refresh-Befehle zum Copy-Paste.

## Dateien

**Zu modifizieren / neu:**

- [scripts/sync-agorum-docs.ts](../scripts/sync-agorum-docs.ts) —
  das eigentliche Skript
- [scripts/sync-agorum-docs.test.ts](../scripts/sync-agorum-docs.test.ts) —
  Unit-Tests für Normalisierung, Idempotenz, Fehlerpfade
- [package.json](../package.json) — `sync:agorum`-npm-Script
- [vite.config.ts](../vite.config.ts) — Vitest-include um
  `scripts/**/*.test.ts` erweitert

**Zum Verständnis referenziert, nicht zu modifizieren:**

- [src/scraper/middleware/FrontMatterMiddleware.ts](../src/scraper/middleware/FrontMatterMiddleware.ts) —
  welche Frontmatter-Felder der Server tatsächlich konsumiert
- [src/scraper/fetcher/FileFetcher.ts](../src/scraper/fetcher/FileFetcher.ts) —
  ETag-Berechnung für LocalFile: `md5(stats.mtime.toISOString())`.
  Das ist der Grund, warum `rsync --checksum` so wichtig ist:
  unnötige Transfers würden mtime bumpen und den 304-Skip verhindern.

## Absichtliche Nicht-Ziele

- **Kein Upstream-Update.** Der Sprung von v1.27.0 → v2.2.1
  (266 Commits) bleibt separat geplant, siehe
  [upstream-merge-conflict-analysis.md](upstream-merge-conflict-analysis.md).
- **Kein Wechsel des Embedding-Modells.** Weiter
  `text-embedding-3-small` mit 1536 Dimensionen.
- **Keine Marker-Dateien im Doc-Verzeichnis.** `LocalFileStrategy`
  filtert keine Dotfiles, jede Datei im Mount wird indexiert.
- **Keine Multi-Host-Abstraktion.** Ein fester Default für
  sourcebot, per `--remote`-Flag übersteuerbar. YAGNI für weitere
  Hosts.
- **Kein automatischer Refresh-Trigger.** Der Operator führt die
  ausgegebenen Befehle selbst aus — Fehler im Sync werden im
  Skript-Output sichtbar, bevor der Index angepackt wird.

## Ergebnis

Der Workflow wurde am 2026-04-12 vollständig umgesetzt und
verifiziert. Details siehe
[agorum-sync-implementation-log.md](agorum-sync-implementation-log.md).
Für die operative Anwendung bei künftigen Sync-Läufen siehe
[agorum-sync-howto.md](agorum-sync-howto.md).
