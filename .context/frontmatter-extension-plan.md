# Plan: Front-Matter-Extension für Docs MCP Server

**Datum**: 2025-11-17
**Ziel**: YAML Front-Matter-Metadaten in Markdown-Dokumenten nutzen für bessere Indexierung und Verlinkung

## Problem

Markdown-Dokumente mit Front-Matter-Metadaten (z.B. `.context/057 - agorum_ai_agents_library_basic_get_text.md`) enthalten wertvolle Zusatzinformationen:

```yaml
---
name: agorum_ai_agents_library_basic_get_text
uuid: cd5de120-92d0-11f0-8c63-005056aa0ecc
link: https://agorumdocproxy.agorum.com/roiwebui/...
path: ["ALBERT | AI","ALBERT | AI Agents","ALBERT| AI KI-Tools-Dokumentationen","..."]
topic: ALBERT - AI
---
```

Aktuell werden diese Metadaten **nicht** genutzt. Es werden nur Überschriften (H1-H6) für die Hierarchie verwendet.

## Lösung: Plugin-Architektur mit Middleware

### Design-Prinzipien

✓ **Minimale Code-Änderungen**: Nur 1-2 Zeilen im bestehenden Code
✓ **Optional**: Automatisch aktiv wenn Front-Matter vorhanden
✓ **Nicht-invasiv**: Fallback auf bestehende Logik
✓ **Erweiterbar**: Middleware-Pattern beibehalten

### Architektur-Übersicht

```
MarkdownPipeline
  ├─ FrontMatterMiddleware (NEU) ← Parst YAML Front-Matter
  ├─ MarkdownMetadataExtractorMiddleware (bestehendes)
  └─ MarkdownLinkExtractorMiddleware (bestehendes)
```

### Implementierung

#### 1. Neue Abhängigkeit

```bash
npm install gray-matter
npm install -D @types/gray-matter
```

**gray-matter**: Etablierte Bibliothek zum Parsen von YAML Front-Matter in Markdown

#### 2. Neue Middleware-Klasse

**Datei**: `src/scraper/middleware/FrontMatterMiddleware.ts`

```typescript
import matter from 'gray-matter';
import type { ContentProcessorMiddleware, MiddlewareContext } from './types';

export interface FrontMatterData {
  name?: string;
  uuid?: string;
  link?: string;
  path?: string[];
  topic?: string;
  date?: string;
  [key: string]: unknown;
}

export class FrontMatterMiddleware implements ContentProcessorMiddleware {
  async process(context: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    try {
      // Parse front-matter if present
      const parsed = matter(context.content);

      if (parsed.data && Object.keys(parsed.data).length > 0) {
        const frontMatter = parsed.data as FrontMatterData;

        // Remove front-matter from content for further processing
        context.content = parsed.content;

        // Store in context for use by other middleware and chunking
        context.frontMatter = frontMatter;

        // Use front-matter title if available
        if (frontMatter.name && !context.title) {
          context.title = frontMatter.name;
        }

        // Add original link to metadata if available
        if (frontMatter.link) {
          context.originalLink = frontMatter.link;
        }

        // Store hierarchical path for use in chunking
        if (frontMatter.path && Array.isArray(frontMatter.path)) {
          context.hierarchicalPath = frontMatter.path;
        }
      }
    } catch (error) {
      // If parsing fails, just continue with original content
      context.errors.push(
        new Error(
          `Failed to parse front-matter: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    await next();
  }
}
```

#### 3. Context-Erweiterung

**Datei**: `src/scraper/middleware/types.ts`

```typescript
export interface MiddlewareContext {
  // ... existing fields ...

  // NEW: Front-matter data
  frontMatter?: FrontMatterData;
  originalLink?: string;
  hierarchicalPath?: string[];
}
```

#### 4. Integration in MarkdownPipeline

**Datei**: `src/scraper/pipelines/MarkdownPipeline.ts`

```typescript
// Zeile 30-33 ändern:
this.middleware = [
  new FrontMatterMiddleware(),  // ← NEU: Erste Middleware
  new MarkdownMetadataExtractorMiddleware(),
  new MarkdownLinkExtractorMiddleware(),
];
```

#### 5. Chunk-Metadaten erweitern

**Datei**: `src/splitter/SemanticMarkdownSplitter.ts`

Im `splitIntoSections` erweitern, um `context.hierarchicalPath` zu nutzen wenn vorhanden:

```typescript
// Wenn Front-Matter-Path vorhanden, diesen als Basis nutzen
const basePath = context.hierarchicalPath || [];

currentSection = {
  level,
  path: [...basePath, ...sectionPath, title],
  content: [...]
};
```

### Metadaten-Nutzung

| Front-Matter Feld | Verwendung |
|-------------------|------------|
| `path` | Überschreibt/ergänzt Heading-Hierarchie in Chunks |
| `link` | Wird in Chunk-Metadaten gespeichert, referenziert Original |
| `name` | Wird als Titel verwendet (Fallback auf H1) |
| `uuid` | In Chunk-Metadaten für eindeutige Identifikation |
| `topic` | Kategorisierung, durchsuchbar |
| `date` | Zeitstempel für Aktualität |

### Datenfluss

```
1. Markdown mit Front-Matter geladen
   ↓
2. FrontMatterMiddleware parst YAML
   ↓
3. Front-Matter aus Content entfernt
   ↓
4. Metadaten in Context gespeichert
   ↓
5. SemanticMarkdownSplitter nutzt hierarchicalPath
   ↓
6. Chunks erhalten erweiterte Metadaten
   ↓
7. In Datenbank gespeichert (documents.metadata)
```

### Vorteile

1. **Keine Breaking Changes**: Bestehende Dokumente ohne Front-Matter funktionieren weiter
2. **Automatische Erkennung**: Kein Flag nötig, Front-Matter wird automatisch erkannt
3. **Bessere Suche**: Hierarchische Pfade aus Front-Matter sind präziser als aus Überschriften
4. **Quellverlinkung**: Original-Links bleiben erhalten
5. **Erweiterbar**: Weitere Front-Matter-Felder können einfach hinzugefügt werden

### Tests

**Neue Datei**: `src/scraper/middleware/FrontMatterMiddleware.test.ts`

Test-Cases:
- ✓ Parst YAML Front-Matter korrekt
- ✓ Entfernt Front-Matter aus Content
- ✓ Nutzt Front-Matter-Name als Titel
- ✓ Speichert hierarchischen Pfad
- ✓ Funktioniert ohne Front-Matter (Fallback)
- ✓ Behandelt ungültiges YAML graceful

### Migration

Keine Datenbank-Migration nötig! Die `documents.metadata` JSON-Spalte kann bereits beliebige Felder aufnehmen.

### Konfiguration (Optional für v2)

Für erweiterte Kontrolle könnte später hinzugefügt werden:

```typescript
interface ScraperOptions {
  frontMatter?: {
    enabled?: boolean;      // Default: true
    preferOverHeadings?: boolean;  // Default: true
    fields?: string[];      // Welche Felder zu extrahieren
  };
}
```

## Implementierungs-Reihenfolge

1. ✅ Entwicklungsumgebung reparieren (Dependencies, Tests)
2. ⬜ `gray-matter` Dependency hinzufügen
3. ⬜ `FrontMatterMiddleware` implementieren
4. ⬜ Tests schreiben
5. ⬜ `MiddlewareContext` erweitern
6. ⬜ `MarkdownPipeline` integrieren
7. ⬜ `SemanticMarkdownSplitter` erweitern (hierarchicalPath nutzen)
8. ⬜ End-to-End Test mit Beispieldokument
9. ⬜ Dokumentation aktualisieren

## Geschätzter Aufwand

- **Phase 1 (Environment Fix)**: 15 Min
- **Phase 2 (Implementation)**: 2-3 Stunden
- **Phase 3 (Testing)**: 1 Stunde
- **Phase 4 (Dokumentation)**: 30 Min

**Total**: ~4 Stunden

## Nächste Schritte

1. Environment reparieren
2. Front-Matter-Middleware implementieren
3. Testen mit `.context/057 - agorum_ai_agents_library_basic_get_text.md`
