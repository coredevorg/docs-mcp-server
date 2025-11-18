# Branch: feature/search-source-links

**Basis:** upstream/main
**Erstellt:** 2025-11-17
**Letzte Aktualisierung:** 2025-11-18

## Übersicht

Dieser Branch implementiert die vollständige Unterstützung für Source-Links aus YAML Front-Matter in Markdown-Dokumenten. Source-Links ermöglichen es, die ursprüngliche Quelle eines Dokuments zu referenzieren, wenn die Markdown-Datei von einer anderen URL stammt.

## Hauptfeatures

### 1. YAML Front-Matter Unterstützung
- **Middleware:** `FrontMatterMiddleware` extrahiert YAML Front-Matter aus Markdown-Dokumenten
- **Parser:** Verwendet `gray-matter` Library für robustes Front-Matter Parsing
- **Metadaten:** Extrahiert `link`, `name`, `uuid`, `path`, `topic`, `date` aus Front-Matter

### 2. Source-Link Speicherung
- **Datenbankfeld:** Neues `source_link` Feld in `pages` Tabelle
- **Migration:** `011-add-source-link-to-pages.sql` fügt das Feld hinzu
- **Datenfluss:** Front-Matter `link` → Pipeline `originalLink` → DB `source_link`

### 3. MCP Tool Integration
- **Suchausgabe:** `search_docs` zeigt sowohl File-URL als auch Source-Link
- **Formatierung:** Unterscheidet klar zwischen lokalem File-Path und Original-URL

## Behobene Bugs

### Bug #1: Fehlende Interface-Definition
**Datei:** `src/scraper/types.ts:141`

**Problem:** `ScrapeResult` Interface hatte kein `originalLink` Feld, TypeScript behandelte es als `undefined`.

**Lösung:**
```typescript
export interface ScrapeResult {
  // ... andere Felder
  originalLink?: string | null;  // ← NEU
}
```

### Bug #2: Datentransfer-Lücke
**Datei:** `src/scraper/strategies/BaseScraperStrategy.ts:215`

**Problem:** Bei der Konvertierung von `PipelineResult` zu `ScrapeResult` wurde `originalLink` nicht kopiert.

**Lösung:**
```typescript
result: {
  // ... andere Felder
  originalLink: result.content.originalLink || null,  // ← NEU
}
```

### Bug #3: MCP Output-Formatierung
**Datei:** `src/mcp/mcpServer.ts:213-223`

**Problem:** Restriktive Type-Annotation filterte `sourceLink` aus den Suchergebnissen.

**Lösung:**
```typescript
const formattedResults = result.results.map((r, i: number) => {
  const parts = [
    `------------------------------------------------------------`,
    `Result ${i + 1}: ${r.url}`,
  ];
  if (r.sourceLink) {
    parts.push(`Source: ${r.sourceLink}`);  // ← NEU
  }
  parts.push(`\n${r.content}\n`);
  return parts.join("\n");
});
```

## Geänderte Dateien aus Upstream

### Core-Funktionalität

1. **src/scraper/types.ts**
   - Added: `originalLink` zu `ScrapeResult` Interface
   - Grund: TypeScript-Unterstützung für Source-Link Feature

2. **src/scraper/strategies/BaseScraperStrategy.ts**
   - Modified: `processBatch()` Methode
   - Added: `originalLink` Kopierung von Pipeline zu ScrapeResult
   - Grund: Datenfluss vom Pipeline zum Storage

3. **src/mcp/mcpServer.ts**
   - Modified: `search_docs` Tool Ausgabeformatierung
   - Added: Bedingte Anzeige der Source-URL
   - Grund: User-sichtbare Unterscheidung zwischen File-URL und Source-Link

4. **src/store/DocumentStore.ts**
   - Modified: `addDocuments()` Methode
   - Added: Speicherung von `originalLink` als `source_link`
   - Grund: Persistierung des Source-Links in der Datenbank

5. **src/store/DocumentRetrieverService.ts**
   - Modified: `search()` Methode
   - Added: Rückgabe von `source_link` als `sourceLink`
   - Grund: Source-Link in Suchergebnissen verfügbar machen

6. **src/store/types.ts**
   - Added: `source_link` zu `DbPage` Interface
   - Added: `sourceLink` zu `StoreSearchResult` Interface
   - Grund: TypeScript-Unterstützung für DB-Schema

### Pipeline & Middleware

7. **src/scraper/pipelines/MarkdownPipeline.ts**
   - Added: `FrontMatterMiddleware` Integration
   - Modified: Pipeline-Reihenfolge (FrontMatter vor Markdown-Processing)
   - Grund: Front-Matter Extraktion vor Markdown-Konvertierung

8. **src/scraper/pipelines/types.ts**
   - Added: `originalLink` zu `PipelineResult` Interface
   - Grund: Pipeline-weite Unterstützung für Source-Links

9. **src/scraper/middleware/FrontMatterMiddleware.ts**
   - New File: Middleware für YAML Front-Matter Extraktion
   - Grund: Modulare Extraktion von Front-Matter Metadaten

10. **src/scraper/middleware/MarkdownMetadataExtractorMiddleware.ts**
    - Modified: Berücksichtigung von Front-Matter Titel
    - Grund: Priorisierung von Front-Matter über extrahierten Titel

11. **src/scraper/middleware/types.ts**
    - Added: `originalLink` zu `MarkdownMetadata` Interface
    - Grund: Metadaten-Typisierung

### Chunking & Splitting

12. **src/splitter/types.ts**
    - Modified: Chunk-Metadaten für bessere Hierarchie-Unterstützung
    - Grund: Verbesserte Chunk-Organisation

13. **src/splitter/GreedySplitter.ts**
    - Modified: Chunk-Erstellung mit erweiterten Metadaten
    - Grund: Konsistenz mit Splitter-Interface

14. **src/splitter/SemanticMarkdownSplitter.ts**
    - Modified: Hierarchische Metadaten in Chunks
    - Grund: Bessere Kontext-Erhaltung

### Database

15. **db/migrations/011-add-source-link-to-pages.sql**
    - New File: Migration für `source_link` Spalte
    - Grund: DB-Schema Erweiterung

## Neue Dateien

1. **src/scraper/middleware/FrontMatterMiddleware.ts**
   - YAML Front-Matter Parser
   - Extrahiert Metadaten aus `---` Blöcken

2. **src/scraper/middleware/FrontMatterMiddleware.test.ts**
   - Unit-Tests für FrontMatterMiddleware
   - Testet verschiedene Front-Matter Formate

3. **src/scraper/pipelines/MarkdownPipeline.integration.test.ts**
   - Integrationstests für komplette Pipeline
   - Verifiziert End-to-End Funktionalität

4. **src/test-source-link.ts**
   - Standalone Test für Source-Link Feature
   - Testet: Pipeline → DocumentStore → DocumentRetrieverService

5. **db/migrations/011-add-source-link-to-pages.sql**
   - Fügt `source_link TEXT` Spalte zu `pages` Tabelle hinzu

## Konfiguration & Dokumentation

1. **.claude/settings.local.json**
   - Lokale Claude Code Einstellungen
   - Bash-Befehle für Docker-Operationen

2. **.gitignore**
   - Ignoriert `.store*` Verzeichnisse (Test-Datenbanken)
   - Ignoriert `.serena` (MCP-Server Config)

3. **CLAUDE.md**
   - Projekt-Guidance für AI-Assistenten
   - Codebase-Struktur und Konventionen

4. **.context/** Dateien
   - Verschiedene Analyse- und Plan-Dokumente
   - Merge-Konflikt Analysen
   - Pull-Request Summaries

5. **.serena/** Dateien
   - MCP-Server Konfiguration
   - Memory-Dateien für Codebase-Verständnis

6. **update-from-upstream.sh**
   - Skript zum Synchronisieren mit upstream/main
   - Automatisches Merging mit Konflikt-Behandlung

## Docker-Konfiguration

1. **Dockerfile**
   - Modified: npm install mit `--legacy-peer-deps`
   - Grund: Dependency-Konflikt-Auflösung

2. **docker-compose.yml**
   - Modified: Port-Mappings angepasst
   - Added: Environment-Variablen

3. **docker-compose.override.yml**
   - New File: Lokale Development-Overrides
   - Mounted: Lokale `docs/` Directory für File-Scraping

## Dependencies

1. **package.json & package-lock.json**
   - Added: `gray-matter` für YAML Front-Matter Parsing
   - Fixed: Zod und LangChain Dependency-Konflikte

## Testing

### Unit-Tests
- `FrontMatterMiddleware.test.ts`: Middleware-Funktionalität
- `MarkdownPipeline.test.ts`: Pipeline-Komponenten

### Integration-Tests
- `MarkdownPipeline.integration.test.ts`: End-to-End Pipeline
- `test-source-link.ts`: Kompletter Datenfluss

### Manuelle Tests
```bash
# Test im Docker-Container
docker exec docs-mcp-worker node dist/index.js scrape agoscript "file:///app/docs/agorum/agoscript" --max-pages 10

# Test lokal
tsx src/test-source-link.ts
```

## Verwendung

### Markdown mit Front-Matter
```markdown
---
name: Beispiel-Dokument
link: https://example.com/original/doc
path: ["Kategorie", "Unterkategorie", "Dokument"]
---

# Beispiel-Dokument

Inhalt...
```

### MCP Tool Ausgabe
```
Result 1: file:///app/docs/example.md
Source: https://example.com/original/doc

Inhalt des Dokuments...
```

## Status

✅ Alle Features implementiert
✅ Alle Tests bestehen
✅ Docker-Build erfolgreich
✅ Manuelle Verifikation abgeschlossen

## Nächste Schritte

1. Pull Request gegen upstream/main erstellen
2. Code-Review durchführen
3. Merge in upstream/main
4. Release vorbereiten
