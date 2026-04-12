# agorum-Sync: Umsetzungsprotokoll

**Datum:** 2026-04-12
**Zugehörige Dokumente:**
[agorum-sync-plan.md](agorum-sync-plan.md) (Design),
[agorum-sync-howto.md](agorum-sync-howto.md) (Operator-Anleitung)

## Zusammenfassung

An diesem Tag wurden drei Baustellen nacheinander bearbeitet:

1. **Vormittag:** UUID-basierte Dateinamen für die lokale
   agorum-Library — einmalige Umstellung von numerierten
   Exportnamen (`001 - …md`) auf stabile `<uuid>.md`-Dateinamen.
2. **Mittag:** Entdeckung, dass die `date`- und `topic`-Felder im
   Frontmatter jeden Byte-Vergleich zwischen zwei Exporten zerstören
   würden — Entwurf eines Sync-Skripts mit Normalisierungs-Pipeline.
3. **Nachmittag:** Implementation, Rollout auf beiden Umgebungen,
   komplette End-to-End-Validierung inklusive Delta-Test.

Am Ende des Tages war der Workflow produktiv einsatzbereit:
1075 UUID-Dateien lokal, 1075 byte-identische Dateien auf sourcebot,
beide Indizes frisch, Sync-Skript committed, Unit-Tests grün.

## Chronologie

### Vormittag: UUID-Sync (erster Durchstich, noch ohne Normalisierung)

**Ausgangslage:**

- Lokales `data/docs/agorum/` enthielt 1018 Dateien mit numerierten
  Namen (`001 - Titel.md`).
- Diskussion, ob `refresh_version` sinnvoll ist, wenn sich zwischen
  Revisionen die Nummerierung verschiebt. Antwort: Nein, weil jede
  Umnummerierung aus Sicht des Servers wie "Datei gelöscht + neue
  Datei erstellt" aussieht. Lösungsansatz: UUID als stabiler Dateiname.
- Fetch-Backend-Export
  `~/.acdocs/work/Documentation Tree Rev. 11.13.0/` mit 1075 Dateien
  enthielt pro Datei ein `uuid:`-Feld im Frontmatter.

**Schritte:**

1. Erstes schlankes [scripts/sync-agorum-docs.ts](../scripts/sync-agorum-docs.ts)
   erstellt: reines File-Rename-Tool, Frontmatter nur zum
   UUID-Auslesen, Body und Frontmatter unverändert ins Ziel.
2. Container gestoppt, Backups angelegt
   (`data/db.backup-20260412-1010`, `data/docs/agorum.backup-20260412-1010`).
3. Dry-Run, dann echter Sync:
   `new=1075, updated=0, deleted=1018, unchanged=0` — exakt
   der Erwartungswert.
4. Container wieder hoch.
5. Web-UI verwendet, um die alte Library `agorum` zu löschen und
   einen neuen Scrape-Job mit `file:///app/docs/agorum/` zu starten.
   Dauer: 2 min 20 s, 1075 Pages, 5745 Snippets.

**Delta-Test (Vormittag):**

- Einzelne Datei manuell um einen Testmarker erweitert.
- `refresh_version` via MCP ausgelöst → Job in 1,38 s durch.
- Such-Query nach dem Marker: Rank 1 in der richtigen Datei mit
  `origin:`-Source-Link. Funktioniert.
- Datei restauriert, erneut Refresh, erneut Query →
  `No results found`. Chunk sauber aus Index und FTS entfernt.

**Offenes Problem:** Der Vormittags-Sync hat die Source-Dateien 1:1
ins Ziel geschrieben. Damit blieben `date` und `topic` im
Frontmatter, und jeder künftige Export würde diese Felder auf neue
Werte setzen — der Byte-Vergleich wäre bei jedem Folge-Sync
zerstört. Musste nachmittags korrigiert werden.

### Mittag: Zwischenschritte und Entscheidungen

**Embedding-Modell-Diskussion.**
Betrachtung von `text-embedding-3-large` und alternativen Cloud-
Modellen für deutschsprachige/technische Inhalte. Ergebnis:
`VECTOR_DIMENSION = 1536` ist in
[src/store/types.ts:4](../src/store/types.ts#L4) hartkodiert, daher
ist nur der OpenAI-small-Platz verfügbar ohne Code-Änderung.
Entscheidung: Modellwechsel vertagen.

**Upstream-Stand-Check.**
`git fetch upstream` gezeigt, dass Upstream
(`arabold/docs-mcp-server`) mittlerweile bei v2.2.1 steht — **266
Commits voraus**. Unter anderem ist konfigurierbare
Vector-Dimension und ein Refresh-Button im Web-UI enthalten.
Entscheidung: Upstream-Merge vertagen (eigene Plan-Datei wäre
[upstream-merge-conflict-analysis.md](upstream-merge-conflict-analysis.md),
falls vorhanden), weil die lokalen Feature-Branch-Änderungen
(FrontMatterMiddleware, Source-Link-Feature) mit den Upstream-
Implementierungen derselben Konzepte kollidieren und mehrere Tage
Rebase-Arbeit nach sich ziehen würden.

**Entdeckung sourcebot.**
Frage nach Deployment-Doku → Suche in `.context/` ergebnislos →
Nachfrage beim Operator → Sourcebot existiert und läuft den
Stack via `screen -dmS docsmcp bash -c 'cd ~/docs-mcp-server && docker compose up'`.
Inspektion per SSH: v1.27.0, identische Docker-Compose-Konfiguration,
aber DB-Stand noch auf den 1018 nummerierten Dateien von November 2025.
Web-UI hat keinen Refresh-Button (kam erst post-v1.27.0).

**Refresh-Mechanismus auf sourcebot.**
Alternativen geprüft:
- Web-UI ohne Button → nur Delete+Scrape möglich
- CLI im Worker: `docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh <library>` — verifiziert verfügbar
- API-Calls gegen Fastify → zu umständlich

Entscheidung: Einheitlich `docker exec` — lokal direkt, remote via
`ssh root@sourcebot.coredev.org '...'`.

### Nachmittag: Volle Implementation

**Brainstorming-Fragen und Antworten:**

1. **Refresh-Trigger:** Manuell, Skript gibt nur die Befehle aus.
   Begründung: Fehler im Sync-Schritt sollen sichtbar werden,
   bevor der Index angepackt wird.
2. **Source-Auflösung:** Default = jüngster `~/.acdocs/work/agorum-*`
   nach Glob (ISO-Datum-Sort = chronologisch), `--source`
   übersteuert.
3. **Remote-Transfer:** rsync vom lokalen Ziel nach sourcebot,
   `--checksum --delete --itemize-changes`.
4. **Frontmatter-Normalisierung:** `date` und `topic` komplett
   entfernen. Rest byte-für-byte erhalten.
   Begründung: `date` wird von
   [acdocs-lib/src/fileGenerator.ts:474](../../acdocs/acdocs-lib/src/fileGenerator.ts#L474)
   per `new Date().toISOString()` bei jedem Export neu geschrieben,
   `topic` trägt den Revisions-Ordnername. Beide würden den
   Byte-Vergleich kaputtmachen.
5. **Erst-Rollout-Sonderfall:** Separat, nicht im Skript.
   Begründung: Das lokale `data/docs/agorum/` enthält vormittags
   bereits UUID-Dateien, aber **ohne** die Normalisierung — eine
   einmalige In-Place-Migration brauchts. Auf sourcebot liegen
   noch die 1018 numerierten Dateien.

**Skript-Rewrite.**
[scripts/sync-agorum-docs.ts](../scripts/sync-agorum-docs.ts)
komplett neu geschrieben mit:

- `normalizeFrontmatter()` — line-basierter Rewrite, der `date`
  und `topic` entfernt und sonst alle Bytes erhält. Bewusst **kein**
  Parse + Re-Serialize über einen YAML-Serializer, um Drift bei
  Umlauten/Escaping zu vermeiden.
- `extractUuid()` — schmaler Regex-Lookup statt vollem YAML-Parse.
- `resolveSource()` — mit optionalem `workDir`-Parameter für
  Testbarkeit.
- `syncSourceToTarget()` — Byte-Vergleich auf den normalisierten
  Bytes, atomic write, verwaiste UUIDs löschen.
- `normalizeInPlace()` — Unterbefehl
  `--normalize-inplace <dir>` für die einmalige lokale Migration.
- `runRsync()` — Aufruf mit `-a --checksum --delete --itemize-changes`.
- `printRefreshHints()` — Post-Sync-Output mit beiden
  docker-exec-Befehlen.

**Unit-Tests.**
[scripts/sync-agorum-docs.test.ts](../scripts/sync-agorum-docs.test.ts)
mit 14 Tests in drei Gruppen:
- `normalizeFrontmatter` (7 Tests): drops-date-and-topic,
  preserves-order, idempotent, Umlaut-preservation, no-frontmatter-
  error, no-closing-delimiter-error, prefix-no-false-positive
- `extractUuid` (4 Tests): basic, quoted, missing, unsafe
- `resolveSource` (3 Tests): latest-match, no-match-error, explicit-path

[vite.config.ts](../vite.config.ts) um
`scripts/**/*.test.ts` ergänzt. 14/14 grün.

**Rollout:**

1. **Einmalige In-Place-Normalisierung lokal.**
   `npm run sync:agorum -- --normalize-inplace data/docs/agorum`
   → Report: `modified=1075, unchanged=0, errored=0`.
   Verifiziert per Byte-Check einer Sample-Datei: `date` und `topic`
   entfernt, 11242 → 11172 Bytes. Idempotenz-Check:
   zweiter Lauf meldet `modified=0, unchanged=1075`. ✓

2. **Einmaliger rsync nach sourcebot.**
   Sourcebot-Stack gestoppt, dry-run, echter rsync.
   Transfer: 1075 Dateien (alle 1018 alten nummerierten gelöscht,
   1075 neue UUID-Dateien übertragen).

3. **Legacy-Cleanup auf sourcebot.**
   Nebenbefund: `~/docs-mcp-server/data/docs/agorum (legacy)/`
   existierte — 848 Dateien in `acadm/` und `acdev/`-Unterordnern,
   Export vom Mai 2025. UUID-Schnittprüfung ergab:
   - 619 UUIDs im Legacy-Set
   - 254 davon auch in neuem Set
   - **365 nur im Legacy-Set**
   Entscheidung: `rm -rf` (nach Operator-Bestätigung). Ordner war
   nicht im aktiven Mount-Scope, keine DB-Referenzen.

4. **Sourcebot-Stack in Screen-Session neu gestartet.**
   `ssh root@sourcebot.coredev.org "screen -dmS docsmcp bash -c 'cd ~/docs-mcp-server && docker compose up'"`
   → neue Session `1733978.docsmcp`, alle drei Services up + healthy.

5. **Manueller Index-Rebuild in beiden Web-UIs.**
   Lokal und sourcebot: Library löschen, Scrape mit
   `file:///app/docs/agorum/` starten. Beide Runs ~2 min.

   **Problem:** Erster lokaler Rebuild meldete nur 1000 Pages
   statt 1075 — das Standard-`maxPages`-Limit im Web-UI-Formular
   war auf 1000 gesetzt. Nach Erhöhung und neuem Scrape: 1075 Pages,
   5745 Snippets auf beiden Seiten. ✓

### End-to-End-Validierung

**Dry-Run-Baseline:**

Direkt nach dem Rebuild:
`npm run sync:agorum -- --source <latest> --no-remote --dry-run`
→ `new=0, updated=0, deleted=0, unchanged=1075`. ✓

**Delta-Test:**

1. Testmarker `DELTA-MARKER-VZ8W4K1P` in Source-Datei
   `001 - Dokumentation Einstieg - Öffentlich.md` angehängt.
2. Dry-Run meldet `updated=1, unchanged=1074`. UUID korrekt:
   `a750a450-1ba1-11f0-be2e-005056aa0ecc`. ✓
3. Echter Sync: lokal 1 Datei geschrieben, rsync überträgt exakt
   1 Datei nach sourcebot (itemize-changes: `<fcst....`). ✓
4. Lokaler Refresh via docker exec: **2,0 s**. ✓
5. Remote-Refresh via ssh+docker exec: **3,4 s** (inkl.
   SSH-Overhead). ✓
6. Such-Query nach dem Marker:
   - lokal via MCP-Tool: Rank 1 in richtiger Datei, mit
     `origin:`-Link. ✓
   - sourcebot via CLI-search: Rank 1 in richtiger Datei, mit
     `sourceLink`. ✓
7. Source-Datei restauriert, Sync → 1 updated, Refresh → 2,0 s lokal,
   3,4 s remote.
8. Such-Query nach Marker: `No results found` lokal, `Found 0`
   auf sourcebot. ✓

**Regressions-Queries (Qualitäts-Check):**

- `"Agila Container Widgets"` — Top 3: Widget-Basisklasse,
  aguila-Intro, Container-Widgets-Referenzliste. Identische
  Qualität wie vormittags vor der Normalisierung. ✓
- `"agorum Cardlets"` — Top 3: cards-Intro, Decorator-Service-
  Interaktion, Cards-Cardlet-Registrierung. Identisch. ✓

## Stolpersteine und ihre Auflösung

### vite-node und `process.argv[1]`

**Problem:** Der erste Entry-Point-Check basierte auf
`process.argv[1].endsWith("sync-agorum-docs.ts")`. Das schlägt fehl,
weil vite-node `process.argv[1]` auf den vite-node-Bin-Pfad setzt und
das Skript-Argument entfernt. Folge: `main()` wurde nie aufgerufen,
Skript produzierte keinen Output, exit 0.

**Fix:** Ersetzt durch `if (!process.env.VITEST)`. vitest setzt
diese Env-Var automatisch, vite-node im Script-Run nicht.

### Commander `--no-*` Option-Semantik

**Problem:** `--no-remote` flippt in Commander das bestehende
`remote`-Option auf `false` (Boolean), statt ein separates
`noRemote`-Feld zu setzen. Mein Code prüfte aber `opts.noRemote`,
das war immer `undefined`, also wurde `runRsync(..., opts.remote,
...)` mit `remote = false` aufgerufen, und `false.replace(...)`
crashte.

**Fix:** Interface auf `remote: string | false` geändert, Check
auf `opts.remote === false` umgestellt. `runRsync` nur aufgerufen,
wenn `skipRemote === false`.

### Import-Zeit-Execution

**Problem:** Ein Debug-Hilfsskript `check-norm.ts` importierte
`normalizeFrontmatter` aus `sync-agorum-docs.ts`. Beim Import
wurde der CLI-Pfad ausgeführt, weil der `VITEST`-Gate nur vor
Tests schützt, nicht vor transitivem Import. Ergebnis: ein echter
Sync inklusive rsync nach sourcebot lief unbeabsichtigt.

**Fix:** Kein Code-Fix nötig, da kein Produktiv-Code das Modul
importiert. Debug-Hilfsskript gelöscht. Für die Zukunft
dokumentiert (siehe Plan "Anmerkungen").

### Path-Leerzeichen-Diff als Verification-Artefakt

**Befund:** Der erste Dry-Run nach dem vollständigen Rebuild
meldete überraschend `updated=1, unchanged=1074` — nicht der
erwartete Zustand "alles unverändert". Diff ergab, dass eine
Datei ein trailing space im `path`-Array hatte:

```yaml
-path: ["agorum core für Endanwender","Mobile Verwendung von agorum core "]
+path: ["agorum core für Endanwender","Mobile Verwendung von agorum core"]
```

Das war **kein Bug**, sondern eine echte Titel-Korrektur zwischen
der älteren Revision (in die In-Place-Normalisierung ging) und
dem aktuellen Export. Der Sync hat das richtig als echten
Content-Diff erkannt und übertragen. Nach dem Sync war die
Baseline dann sauber `unchanged=1075`.

## DB-Stände (final)

**Lokal** (nach letztem Refresh):

```json
{
  "lib": 3497,
  "name": "agorum",
  "version": "",
  "pages": 1075,
  "documents": 5745,
  "status": "completed"
}
```

**Sourcebot** (CLI `list` Output):

```json
{
  "name": "agorum",
  "uniqueUrlCount": 1075,
  "documentCount": 5745,
  "indexedAt": "2026-04-12T11:22:19.000Z",
  "sourceUrl": "file:///app/docs/agorum",
  "status": "completed"
}
```

Identische Zahlen auf beiden Seiten. Byte-gleiches Filesystem.
Workflow läuft.

## Artefakte und Backup-Snapshots

Während der Arbeit angelegt, können aufgeräumt werden wenn stabil:

- `data/db.backup-20260412-1010/` — DB-Stand vor dem Vormittags-Rebuild
- `data/docs/agorum.backup-20260412-1010/` — 1018 alte numerierte Files
- `data/docs/agorum.pre-normalize-20260412-1311/` — 1075 UUID-Files
  vor der Frontmatter-Normalisierung

Der sourcebot-Stack läuft jetzt dauerhaft in der Screen-Session
`docsmcp` und kann via `ssh root@sourcebot.coredev.org` → `screen -r
docsmcp` eingesehen werden (mit `Ctrl-A, d` wieder ablösen).
