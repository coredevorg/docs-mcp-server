# Branch: feature/frontmatter-middleware

**Basis:** upstream/main
**Erstellt:** 2025-11-17
**Letzte Aktualisierung:** 2025-11-18

## Übersicht

Dieser Branch implementiert die grundlegende Infrastruktur für YAML Front-Matter Unterstützung in Markdown-Dokumenten. Er enthält die Middleware-Komponenten und Pipeline-Integration, aber **nicht** die vollständige Source-Link Anzeige im MCP Tool.

**Hinweis:** Dieser Branch ist eine Teilimplementierung. Für die vollständige Funktionalität siehe `feature/search-source-links`.

## Hauptfeatures

### 1. YAML Front-Matter Middleware
- **Komponente:** `FrontMatterMiddleware` für YAML Front-Matter Extraktion
- **Parser:** `gray-matter` Library Integration
- **Metadaten:** Extrahiert `link`, `name`, `uuid`, `path`, `topic`, `date`

### 2. Pipeline-Integration
- **MarkdownPipeline:** FrontMatterMiddleware vor Markdown-Processing
- **Metadaten-Fluss:** Front-Matter → MarkdownMetadata → PipelineResult
- **Tests:** Unit- und Integrationstests für Pipeline

### 3. Database-Schema
- **Migration:** `011-add-source-link-to-pages.sql`
- **Spalte:** `source_link TEXT` in `pages` Tabelle
- **Speicherung:** `originalLink` wird als `source_link` gespeichert

## Unterschiede zu feature/search-source-links

### ❌ Nicht enthalten:

1. **Bug-Fixes für Source-Link Anzeige**
   - Kein `originalLink` Feld in `ScrapeResult` (Bug #1)
   - Keine Datentransfer-Logik in `BaseScraperStrategy` (Bug #2)
   - Keine MCP Output-Formatierung (Bug #3)

2. **Vollständige Test-Coverage**
   - Kein `test-source-link.ts` End-to-End Test
   - Keine DocumentRetrieverService Anpassungen

3. **MCP Tool Integration**
   - Source-Link wird NICHT in `search_docs` Ausgabe angezeigt
   - Nur interne Speicherung, keine User-sichtbare Funktionalität

### ✅ Enthalten:

1. **Front-Matter Middleware**
   - `FrontMatterMiddleware.ts` und Tests
   - YAML-Parsing mit `gray-matter`

2. **Database-Schema**
   - Migration für `source_link` Spalte
   - DocumentStore speichert `source_link`

3. **Pipeline-Komponenten**
   - MarkdownPipeline Integration
   - PipelineResult mit `originalLink`

## Geänderte Dateien aus Upstream

### Pipeline & Middleware

1. **src/scraper/pipelines/MarkdownPipeline.ts**
   - Added: `FrontMatterMiddleware` Integration
   - Modified: Pipeline-Reihenfolge
   - Grund: Front-Matter vor Markdown-Processing

2. **src/scraper/pipelines/types.ts**
   - Added: `originalLink` zu `PipelineResult`
   - Grund: Pipeline-weite Source-Link Unterstützung

3. **src/scraper/middleware/FrontMatterMiddleware.ts**
   - New File: YAML Front-Matter Extraktion
   - Grund: Modulare Metadaten-Extraktion

4. **src/scraper/middleware/FrontMatterMiddleware.test.ts**
   - New File: Unit-Tests für Middleware
   - Grund: Qualitätssicherung

5. **src/scraper/pipelines/MarkdownPipeline.integration.test.ts**
   - New File: Integration-Tests
   - Grund: End-to-End Pipeline Testing

6. **src/scraper/pipelines/MarkdownPipeline.test.ts**
   - Modified: Tests für neue Pipeline-Funktionalität
   - Grund: Test-Coverage

7. **src/scraper/middleware/MarkdownMetadataExtractorMiddleware.ts**
   - Modified: Front-Matter Titel-Priorisierung
   - Grund: Front-Matter über extrahierten Titel

8. **src/scraper/middleware/types.ts**
   - Added: `originalLink` zu `MarkdownMetadata`
   - Grund: Typisierung

### Database

9. **db/migrations/011-add-source-link-to-pages.sql**
   - New File: Schema-Erweiterung
   - SQL: `ALTER TABLE pages ADD COLUMN source_link TEXT;`
   - Grund: Persistierung von Source-Links

10. **src/store/DocumentStore.ts**
    - Modified: `addDocuments()` speichert `source_link`
    - Grund: Database-Integration

11. **src/store/types.ts**
    - Added: `source_link` zu `DbPage`
    - Grund: DB-Schema Typisierung

### Chunking

12. **src/splitter/types.ts**
    - Modified: Chunk-Metadaten
    - Grund: Hierarchie-Unterstützung

13. **src/splitter/GreedySplitter.ts**
    - Modified: Metadaten in Chunks
    - Grund: Interface-Konsistenz

14. **src/splitter/SemanticMarkdownSplitter.ts**
    - Modified: Hierarchische Metadaten
    - Grund: Kontext-Erhaltung

### MCP Server

15. **src/mcp/mcpServer.ts**
    - Modified: `list_libraries` Tool Schema
    - Fixed: Zod-Schema Validierung
    - Grund: MCP-Tool Kompatibilität

## Konfiguration & Infrastruktur

### Docker

1. **Dockerfile**
   - Modified: `npm install --legacy-peer-deps`
   - Grund: Dependency-Konflikt-Auflösung

2. **docker-compose.yml**
   - Modified: Port-Mappings
   - Grund: Lokale Development-Umgebung

3. **docker-compose.override.yml**
   - New File: Development-Overrides
   - Mounted: Lokales `docs/` Directory
   - Grund: File-Scraping ohne Container-Rebuild

### Dependencies

4. **package.json & package-lock.json**
   - Added: `gray-matter` für YAML-Parsing
   - Fixed: Zod und LangChain Konflikte
   - Grund: Front-Matter Unterstützung

### Dokumentation

5. **.gitignore**
   - Added: `.store*` Verzeichnisse
   - Added: `.serena/` Verzeichnis
   - Grund: Test-Datenbanken und MCP-Config ignorieren

6. **CLAUDE.md**
   - New File: AI-Assistant Guidance
   - Grund: Projekt-Kontext für Claude Code

7. **.context/** Dateien
   - `frontmatter-extension-plan.md`: Implementation-Plan
   - `frontmatter-metadata-flow-analysis.md`: Datenfluss-Analyse
   - `environment-test-report.md`: Test-Berichte
   - `pull-request-summary.md`: PR-Vorbereitung
   - `upstream-merge-conflict-analysis.md`: Merge-Analyse

8. **.serena/** Dateien
   - MCP-Server Konfiguration
   - Memory-Dateien für Codebase-Kontext

9. **update-from-upstream.sh**
   - New File: Upstream-Sync Script
   - Grund: Vereinfachtes Branch-Update

10. **.claude/settings.local.json**
    - Lokale IDE-Konfiguration
    - Bash-Befehle für Docker

## Testing

### Unit-Tests
- `FrontMatterMiddleware.test.ts`: Middleware-Logik
- `MarkdownPipeline.test.ts`: Pipeline-Komponenten

### Integration-Tests
- `MarkdownPipeline.integration.test.ts`: End-to-End Pipeline

### Manuelle Tests
```bash
# Pipeline-Test (Front-Matter wird extrahiert)
npm test -- MarkdownPipeline

# Database-Test (source_link wird gespeichert)
docker exec docs-mcp-worker node dist/index.js scrape test "file:///app/docs/test"
```

## Bekannte Einschränkungen

### 🔴 Source-Link wird NICHT angezeigt

Obwohl `source_link` in der Datenbank gespeichert wird, wird es **nicht** im MCP `search_docs` Tool angezeigt, weil:

1. **Fehlendes Interface-Feld:**
   - `ScrapeResult` hat kein `originalLink` Feld
   - TypeScript behandelt es als `undefined`

2. **Fehlender Datentransfer:**
   - `BaseScraperStrategy` kopiert `originalLink` nicht von Pipeline zu ScrapeResult
   - Daten gehen während Konvertierung verloren

3. **Fehlende MCP-Formatierung:**
   - `search_docs` Tool zeigt nur `url`, nicht `sourceLink`
   - Keine "Source:" Zeile in Ausgabe

### Lösung

Für vollständige Funktionalität merge mit `feature/search-source-links` oder:

1. Merge `feature/search-source-links` in diesen Branch
2. Implementiere die drei Bug-Fixes manuell
3. Erstelle neuen Branch basierend auf beiden Features

## Verwendung

### Markdown mit Front-Matter

```markdown
---
name: Beispiel-Dokument
link: https://example.com/original/doc
---

# Beispiel

Inhalt...
```

### Datenbank-Speicherung

```sql
-- source_link wird korrekt gespeichert
SELECT url, source_link FROM pages;
-- file:///docs/example.md | https://example.com/original/doc
```

### MCP Tool Ausgabe (EINGESCHRÄNKT)

```
Result 1: file:///docs/example.md

Inhalt...
```

**❌ Source-Link wird NICHT angezeigt!**

## Status

✅ Front-Matter Middleware implementiert
✅ Database-Schema erweitert
✅ Pipeline-Integration abgeschlossen
✅ Tests bestehen
❌ MCP Tool zeigt Source-Link NICHT an
❌ Bug-Fixes fehlen

## Nächste Schritte

1. **Option A:** Merge mit `feature/search-source-links`
   - Komplette Funktionalität
   - Alle Bug-Fixes enthalten

2. **Option B:** Bug-Fixes manuell implementieren
   - Siehe `.context/feature-search-source-links.md`
   - Bugs #1, #2, #3 fixen

3. **Option C:** Branch archivieren
   - Als historische Referenz behalten
   - Nur `feature/search-source-links` verwenden

## Beziehung zu anderen Branches

- **feature/search-source-links:** Superset dieses Branches (empfohlen)
- **config/local:** Lokale Konfiguration (unabhängig)
- **upstream/main:** Basis für beide Feature-Branches
