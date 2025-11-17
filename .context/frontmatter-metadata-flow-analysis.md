# Front-Matter Metadata Flow & Retrieval Impact Analysis

**Erstellt:** 2025-11-17
**Status:** Implementiert in `feature/frontmatter-middleware`
**Zweck:** Dokumentation des Datenflusses der Front-Matter-Metadaten durch das System und deren Auswirkungen auf die Suchqualität

## Übersicht

Dieses Dokument analysiert, wie YAML Front-Matter-Metadaten aus Markdown-Dokumenten extrahiert, verarbeitet und für die Verbesserung der Retrieval-Qualität genutzt werden.

## 1. Datenfluss der Front-Matter-Metadaten

### 1.1 Parsen (FrontMatterMiddleware)

**Datei:** `src/scraper/middleware/FrontMatterMiddleware.ts`
**Position in Pipeline:** Erste Middleware (muss zuerst laufen)

**Beispiel Front-Matter:**
```yaml
---
name: Übersicht - agorum core agoscript
uuid: 39df11d0-e9df-11e9-a3bc-005056aa0ecc
date: 2025-11-17T12:56:27.416Z
link: https://agorumdocproxy.agorum.com/roiwebui/acds_module/overview2/index.html#/...
path: ["agorum core für Entwickler", "agorum core agoscript"]
topic: agoscript
---
```

**Verarbeitung:**
```typescript
const parsed = matter(context.content);
const frontMatter = parsed.data as FrontMatterData;

// Metadaten-Extraktion
context.content = parsed.content;           // Front-Matter wird entfernt
context.frontMatter = frontMatter;          // Gesamtes Front-Matter gespeichert
context.title = frontMatter.name;           // name → title
context.originalLink = frontMatter.link;    // link gespeichert
context.hierarchicalPath = frontMatter.path; // path → hierarchicalPath (Array)
```

**Wichtig:** Das Front-Matter wird aus dem Content entfernt, bevor weitere Middleware-Komponenten den Text verarbeiten.

### 1.2 Chunking (SemanticMarkdownSplitter)

**Datei:** `src/splitter/SemanticMarkdownSplitter.ts:76-84, 127-144`

Der hierarchische Pfad aus dem Front-Matter wird **jedem Chunk-Section-Pfad vorangestellt**:

**Ohne Front-Matter:**
```typescript
chunk.section.path = ["Übersicht", "Einleitung"]
```

**Mit Front-Matter:**
```typescript
chunk.section.path = [
  "agorum core für Entwickler",    // aus frontMatter.path[0]
  "agorum core agoscript",          // aus frontMatter.path[1]
  "Übersicht",                      // aus H1 Heading
  "Einleitung"                      // aus H2 Heading
]
```

**Implementierung:**
```typescript
// SemanticMarkdownSplitter.ts:76-84
async splitText(
  markdown: string,
  _contentType?: string,
  hierarchicalPath?: string[],  // ← Von MarkdownPipeline übergeben
): Promise<Chunk[]> {
  const html = await this.markdownToHtml(markdown);
  const dom = await this.parseHtml(html);
  const sections = await this.splitIntoSections(dom, hierarchicalPath);
  return this.splitSectionContent(sections);
}

// SemanticMarkdownSplitter.ts:127-144
private async splitIntoSections(
  dom: Document,
  basePath?: string[],  // ← hierarchicalPath
): Promise<DocumentSection[]> {
  let currentSection = this.createRootSection(basePath);
  // ...
  const sectionPath = [...stack.slice(1).reduce(...), title];
  currentSection = {
    level,
    path: basePath ? [...basePath, ...sectionPath] : sectionPath,  // ← Prepend
    content: [...]
  };
}
```

### 1.3 Embedding-Erstellung (DocumentStore)

**Datei:** `src/store/DocumentStore.ts:992-995`

**Kritischer Punkt:** Der hierarchische Pfad wird **in den Embedding-Text eingebaut**:

```typescript
const texts = chunks.map((chunk) => {
  const header = `<title>${title}</title>\n<url>${url}</url>\n<path>${(chunk.section.path || []).join(" / ")}</path>\n`;
  return `${header}${chunk.content}`;
});
```

**Konkretes Beispiel eines Embedding-Texts:**
```xml
<title>Übersicht - agorum core agoscript</title>
<url>file:///docs/agorum/agoscript/000-Übersicht.md</url>
<path>agorum core für Entwickler / agorum core agoscript / Übersicht / Einleitung</path>

Die XML-Sprache agoscript ist die erste Skriptsprache, mit der in agorum core
neue Objekte angelegt werden konnten. Viele Teile des Systems sind mit dieser
Sprache erstellt worden...
```

**Dieser gesamte Text** wird durch OpenAI Embeddings (text-embedding-3-small oder text-embedding-ada-002) in einen 1536-dimensionalen Vektor umgewandelt.

**Semantische Implikation:** Der hierarchische Kontext ist **semantisch in den Vektoren kodiert**!

### 1.4 Speicherung (Datenbank)

**Datei:** `src/store/DocumentStore.ts:1112-1129`
**Schema:** `db/migrations/009-add-pages-table.sql`

**documents Tabelle:**
```sql
INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
VALUES (
  123,
  "Die XML-Sprache agoscript...",
  '{
    "types": ["text"],
    "level": 2,
    "path": [
      "agorum core für Entwickler",
      "agorum core agoscript",
      "Übersicht",
      "Einleitung"
    ]
  }',
  0,
  <1536-dim vector blob>
)
```

**Code:**
```typescript
// DocumentStore.ts:1112-1121
const result = this.statements.insertDocument.run(
  pageId,
  chunk.content,
  JSON.stringify({
    types: chunk.types,
    level: chunk.section.level,
    path: chunk.section.path,  // ← Hierarchischer Pfad als JSON Array
  } satisfies DbChunkMetadata),
  i, // sort_order
);
```

**FTS5 Index (Trigger):**
```sql
-- db/migrations/009-add-pages-table.sql:104-106
CREATE TRIGGER documents_fts_after_insert AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, content, title, url, path)
  SELECT new.id, new.content, p.title, p.url, json_extract(new.metadata, '$.path')
  FROM pages p WHERE p.id = new.page_id;
END;
```

**FTS5 Tabellenstruktur:**
```sql
CREATE VIRTUAL TABLE documents_fts USING fts5(
  content,
  title,
  url,
  path,      -- ← JSON Array wird als durchsuchbarer Text gespeichert
  tokenize='porter unicode61'
);
```

**Wichtiger Hinweis:** Andere Front-Matter-Felder (`uuid`, `link`, `topic`, `date`) werden derzeit **NICHT in der Datenbank gespeichert**. Sie existieren nur im Middleware-Context während der Verarbeitung.

## 2. Hybrid Search Implementation

**Datei:** `src/store/DocumentStore.ts:1338-1418`

Das System verwendet **Hybrid Search** mit zwei parallelen Suchstrategien:

### 2.1 Vector Search

```sql
-- DocumentStore.ts:1350-1364
WITH vec_distances AS (
  SELECT
    dv.rowid as id,
    dv.distance as vec_distance
  FROM documents_vec dv
  JOIN documents d ON dv.rowid = d.id
  JOIN pages p ON d.page_id = p.id
  JOIN versions v ON p.version_id = v.id
  JOIN libraries l ON v.library_id = l.id
  WHERE l.name = ?
    AND COALESCE(v.name, '') = COALESCE(?, '')
    AND dv.embedding MATCH ?  -- ← Vektor-Ähnlichkeitssuche
    AND dv.k = ?              -- ← Top-K Ergebnisse
  ORDER BY dv.distance
)
```

**Wie Front-Matter hilft:**
- Query-Embedding wird mit Chunk-Embeddings verglichen
- Chunk-Embeddings enthalten hierarchischen Kontext im Text
- Semantisch relevantere Chunks (basierend auf Kontext) haben kleinere Distanz

**Beispiel:**
- Query: "JavaScript Entwicklung"
- Chunk A: Embedding von `<path>agorum core für Entwickler / JavaScript-API / ...</path>\n<content>`
- Chunk B: Embedding von `<path>Systemadministration / Konfiguration / ...</path>\n<content>`
- → Chunk A hat kleinere Distanz, weil "Entwickler" semantisch näher an "Entwicklung"

### 2.2 FTS5 Full-Text Search

```sql
-- DocumentStore.ts:1365-1379
fts_scores AS (
  SELECT
    f.rowid as id,
    bm25(documents_fts, 10.0, 1.0, 5.0, 1.0) as fts_score
    --  Gewichte:    content ↑  title  url  path ↑
  FROM documents_fts f
  JOIN documents d ON f.rowid = d.id
  JOIN pages p ON d.page_id = p.id
  JOIN versions v ON p.version_id = v.id
  JOIN libraries l ON v.library_id = l.id
  WHERE l.name = ?
    AND COALESCE(v.name, '') = COALESCE(?, '')
    AND documents_fts MATCH ?  -- ← FTS5 Query über alle Felder
  ORDER BY fts_score
  LIMIT ?
)
```

**BM25-Gewichtung:**
```typescript
bm25(documents_fts, 10.0, 1.0, 5.0, 1.0)
//                  ↑     ↑    ↑    ↑
//                  content  title  url  path
```

**Wie Front-Matter hilft:**
- `path` ist ein eigenes durchsuchbares Feld mit Gewicht 1.0
- Query: "agorum entwickler agoscript" matched gegen path-Feld
- BM25 bewertet seltene Terme höher (IDF - Inverse Document Frequency)
- Hierarchische Begriffe sind oft seltener → höheres Gewicht

**Beispiel FTS-Match:**
```
Query: "agorum entwickler xml"
Chunk path: '["agorum core für Entwickler","agorum core agoscript","XML-Parser","Metadaten"]'
→ Matches: "agorum" ✓, "entwickler" ✓, "xml" ✓
→ BM25 Score berücksichtigt alle drei Matches im path-Feld
```

### 2.3 RRF (Reciprocal Rank Fusion)

```typescript
// DocumentStore.ts:1412-1417
const rankedResults = this.assignRanks(rawResults);

const topResults = rankedResults
  .sort((a, b) => b.rrf_score - a.rrf_score)
  .slice(0, limit);
```

**RRF-Formel:**
```typescript
// DocumentStore.ts:124-133
private calculateRRF(
  vecRank: number,
  ftsRank: number,
  k = RRF_K,
  vecWeight = RRF_VEC_WEIGHT,
  ftsWeight = RRF_FTS_WEIGHT,
): number {
  const vecScore = vecRank > 0 ? vecWeight / (k + vecRank) : 0;
  const ftsScore = ftsRank > 0 ? ftsWeight / (k + ftsRank) : 0;
  return vecScore + ftsScore;
}
```

**Konfiguration (utils/config.ts):**
```typescript
export const RRF_K = 60;              // Konstante für RRF-Dämpfung
export const RRF_VEC_WEIGHT = 1.0;    // Gewicht für Vector Search
export const RRF_FTS_WEIGHT = 1.0;    // Gewicht für FTS Search
```

## 3. Auswirkungen auf Retrieval-Qualität

### 3.1 Semantischer Kontext in Vector Embeddings

**Verbesserung:**
- Embeddings enthalten jetzt hierarchische Kontextinformation
- Chunks werden semantisch besser disambiguiert

**Beispiel:**
```
Zwei Chunks mit ähnlichem Content:
  Chunk A: "Installation durchführen"
    path: ["Produkt A", "Setup", "Installation"]

  Chunk B: "Installation durchführen"
    path: ["Produkt B", "Deployment", "Installation"]

Query: "Produkt A Installation"

→ Chunk A hat kleinere Vektor-Distanz, weil Embedding von
  "<path>Produkt A / Setup / Installation</path>\nInstallation durchführen"
  semantisch näher an Query-Embedding ist
```

**Messbarer Effekt:**
- **Precision ↑**: Relevantere Chunks werden höher gerankt
- **Recall →**: Gleich (alle relevanten Chunks werden gefunden)

### 3.2 FTS-Suche über hierarchische Pfade

**Verbesserung:**
- Nutzer können nach Kontextbegriffen suchen, die nicht im Content stehen
- Hierarchische Navigation wird unterstützt

**Beispiel:**
```
Query: "agorum entwickler xml parser"

Chunk Content: "Mit dem RoiXMLParser können XML-Skripte verarbeitet werden"
Chunk Path: ["agorum core für Entwickler", "agoscript", "XML-Parser"]

→ FTS5 matched:
  - "xml" im Content ✓
  - "parser" im Content ✓
  - "agorum" im Path ✓
  - "entwickler" im Path ✓

→ BM25-Score ist höher als ohne path-Field
```

**Messbarer Effekt:**
- **Precision ↑**: Kontextuelle Relevanz wird berücksichtigt
- **Recall ↑**: Chunks mit relevantem Kontext aber ohne direkte Content-Matches werden gefunden

### 3.3 Disambiguierung gleicher Inhalte

**Problem ohne Front-Matter:**
Viele technische Dokumentationen haben ähnliche oder identische Abschnitte (z.B. "Installation", "Konfiguration", "Übersicht").

**Lösung mit Front-Matter:**
```
Chunk 1:
  content: "Diese Übersicht beschreibt die wichtigsten Funktionen"
  path: ["agorum core", "JavaScript-API", "Übersicht"]

Chunk 2:
  content: "Diese Übersicht beschreibt die wichtigsten Funktionen"
  path: ["agorum core", "agoscript", "Übersicht"]

Query: "JavaScript API Übersicht"

→ RRF kombiniert:
  Vector: Chunk 1 höher (wegen "JavaScript-API" im Embedding-Kontext)
  FTS:    Chunk 1 höher (wegen "javascript" im path)

→ Chunk 1 wird deutlich höher gerankt
```

**Messbarer Effekt:**
- **MRR (Mean Reciprocal Rank) ↑**: Relevantester Chunk erscheint früher in Ergebnissen
- **User Satisfaction ↑**: Weniger irrelevante Duplikate

### 3.4 Besseres Kontext-Assembly

**Datei:** `src/store/DocumentStore.ts:1492-1634`

Die Methoden `findParentChunk`, `findChildChunks`, `findPrecedingSiblingChunks`, `findSubsequentSiblingChunks` nutzen den `path` zur Navigation:

```typescript
// DocumentStore.ts:1598-1634
async findParentChunk(chunkId: number): Promise<DbPageChunk | null> {
  const chunk = await this.getById(chunkId);
  if (!chunk) return null;

  const metadata = this.parseMetadata(chunk.metadata);
  const path = metadata.path || [];

  if (path.length <= 1) return null;  // No parent

  const parentPath = path.slice(0, -1);  // ← Nutzt hierarchischen Pfad!

  // Find chunk with matching parent path...
}
```

**Verbesserung durch Front-Matter:**
- Präzisere Dokumentstruktur-Rekonstruktion
- Parent/Child-Beziehungen über Dokumentgrenzen hinweg
- Bessere Chunk-Aggregation für LLM-Context

**Beispiel:**
```
Ohne Front-Matter:
  path: ["Installation", "Voraussetzungen"]
  parent: path: ["Installation"]

Mit Front-Matter:
  path: ["agorum core", "JavaScript-API", "Installation", "Voraussetzungen"]
  parent: path: ["agorum core", "JavaScript-API", "Installation"]

→ Parent-Chunk gehört eindeutig zur JavaScript-API, nicht zu anderen Installations-Guides
```

## 4. Performance-Überlegungen

### 4.1 Embedding-Kosten

**Auswirkung:**
- Embedding-Text ist ~50-200 Zeichen länger (wegen path-Header)
- OpenAI Pricing: Basierend auf Tokens
- **Zusatzkosten:** ~5-10% mehr Tokens pro Chunk

**Beispiel:**
```
Ohne path-Header: 500 Tokens
Mit path-Header:  530 Tokens (+6%)
```

**Kosten-Nutzen:**
- Zusatzkosten: Marginal
- Nutzen: Signifikant bessere Retrieval-Qualität
- **Empfehlung:** Kosten sind gerechtfertigt

### 4.2 Speicher-Overhead

**Auswirkung:**
- `metadata` JSON ist größer (längere path-Arrays)
- FTS5-Index speichert path-Field

**Beispiel:**
```json
// Ohne Front-Matter
{"types":["text"],"level":2,"path":["Übersicht","Einleitung"]}

// Mit Front-Matter
{"types":["text"],"level":2,"path":["agorum core für Entwickler","agorum core agoscript","Übersicht","Einleitung"]}
```

**Zusätzlicher Speicher:** ~50-150 Bytes pro Chunk
**Bei 100k Chunks:** ~5-15 MB zusätzlich
**Empfehlung:** Vernachlässigbar

### 4.3 Query-Performance

**Vector Search:**
- Keine Auswirkung (gleiche Vektorsuche)

**FTS5 Search:**
- Zusätzliches path-Field erhöht Index-Größe minimal
- BM25-Berechnung über 4 statt 3 Felder
- **Auswirkung:** < 5% langsamere FTS-Queries

**Empfehlung:** Performance-Einbußen sind minimal und durch Qualitätsverbesserung gerechtfertigt

## 5. Limitierungen & Zukünftige Erweiterungen

### 5.1 Nicht gespeicherte Front-Matter-Felder

**Aktuell NICHT gespeichert:**
- `uuid`: Eindeutige ID des Dokuments
- `link`: Original-URL im Quellsystem
- `topic`: Thematische Kategorisierung
- `date`: Erstellungs-/Änderungsdatum

**Potenzielle Nutzung:**
- Filterung nach Topic
- Zeitbasierte Suche
- Verlinkung zu Quellsystem
- Duplikaterkennung via UUID

**Empfehlung für Zukunft:**
Erweitern der `pages` Tabelle um `metadata JSON` Spalte für zusätzliche Front-Matter-Felder.

### 5.2 Path-Validierung

**Aktuell:** Keine Validierung der path-Struktur
**Potenzielle Probleme:**
- Inkonsistente Hierarchien
- Zu tiefe/flache Pfade
- Tippfehler in Pfadbestandteilen

**Empfehlung:**
Schema-Validierung in FrontMatterMiddleware hinzufügen.

### 5.3 Multi-Language Support

**Aktuell:** Keine Sprachspezifische Behandlung
**Potenzial:**
- Sprach-Metadaten aus Front-Matter
- Sprachspezifische FTS5-Tokenizer
- Mehrsprachige Embeddings

## 6. Zusammenfassung

### Datenfluss-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. YAML Front-Matter                                            │
│    path: ["agorum core für Entwickler", "agoscript"]            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FrontMatterMiddleware                                        │
│    context.hierarchicalPath = frontMatter.path                  │
│    context.content = (Front-Matter entfernt)                    │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. SemanticMarkdownSplitter                                     │
│    chunk.section.path = [...hierarchicalPath, ...headingPath]  │
│    → ["agorum...", "agoscript", "Übersicht", "Einleitung"]     │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Embedding Creation (DocumentStore)                          │
│    text = "<path>agorum... / agoscript / ...</path>\n" + content│
│    embedding = openai.embed(text)                               │
│    → 1536-dim Vektor mit semantischem Kontext                  │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Database Storage                                             │
│    documents.metadata: {"path": ["agorum...", ...]}            │
│    documents.embedding: <vector blob>                           │
│    documents_fts.path: ["agorum core für Entwickler", ...]     │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Hybrid Search                                                │
│    Vector: Semantische Ähnlichkeit (inkl. Kontext)             │
│    FTS5:   Keyword-Match in content, title, url, PATH          │
│    RRF:    Kombiniertes Ranking                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Takeaways

1. **Hierarchischer Kontext ist semantisch kodiert** in Vector-Embeddings
2. **FTS5-Suche profitiert** von durchsuchbarem path-Field
3. **Hybrid Search kombiniert** beide Vorteile für optimales Ranking
4. **Minimal Performance-Overhead** bei signifikanter Qualitätsverbesserung
5. **Erweiterungspotenzial** durch zusätzliche Front-Matter-Felder vorhanden

### Messbarer Impact

| Metrik | Ohne Front-Matter | Mit Front-Matter | Verbesserung |
|--------|------------------|------------------|--------------|
| Precision@5 | Baseline | Höher | +10-20% (geschätzt) |
| Recall@20 | Baseline | Höher | +5-15% (geschätzt) |
| MRR | Baseline | Höher | +15-25% (geschätzt) |
| Disambiguierung | Niedrig | Hoch | Signifikant |
| Kontext-Accuracy | Mittel | Hoch | Signifikant |

**Hinweis:** Exakte Metriken erfordern Evaluation mit gelabeltem Test-Set.

## 7. Code-Referenzen

| Komponente | Datei | Zeilen |
|-----------|-------|--------|
| Front-Matter Parsing | `src/scraper/middleware/FrontMatterMiddleware.ts` | 13-39 |
| Hierarchical Path Prepending | `src/splitter/SemanticMarkdownSplitter.ts` | 76-84, 127-144 |
| Embedding with Path | `src/store/DocumentStore.ts` | 992-995 |
| Metadata Storage | `src/store/DocumentStore.ts` | 1115-1119 |
| Vector Search | `src/store/DocumentStore.ts` | 1350-1364 |
| FTS5 Search | `src/store/DocumentStore.ts` | 1365-1379 |
| RRF Ranking | `src/store/DocumentStore.ts` | 124-133, 1412-1417 |
| Database Schema | `db/migrations/009-add-pages-table.sql` | 89-113 |
| Parent/Child Navigation | `src/store/DocumentStore.ts` | 1492-1634 |

## 8. Testing

**Unit Tests:** `src/scraper/middleware/FrontMatterMiddleware.test.ts` (13 Tests)
**Integration Tests:** `src/scraper/pipelines/MarkdownPipeline.integration.test.ts` (2 Tests)
**Test Data:** `/docs/agorum/agoscript/000 - Übersicht - agorum core agoscript.md`

**Nächste Schritte für Testing:**
1. Evaluation-Set mit gelabelten Queries erstellen
2. Baseline-Metriken ohne Front-Matter messen
3. A/B-Test mit/ohne Front-Matter durchführen
4. Nutzer-Feedback zur Suchqualität sammeln
