# Branch-Übersicht: docs-mcp-server

**Erstellt:** 2025-11-18
**Basis:** upstream/main (arabold/docs-mcp-server)

## Quick Reference

| Branch | Zweck | Status | Empfehlung |
|--------|-------|--------|------------|
| **feature/search-source-links** | Vollständige Source-Link Implementation | ✅ Produktionsreif | 🎯 **VERWENDEN** |
| **feature/frontmatter-middleware** | Basis Front-Matter Infrastructure | ⚠️ Unvollständig | Archivieren |
| **config/local** | Lokale Development-Konfiguration | ✅ Nur Config | Für lokales Dev |

## Branch-Details

### 1. feature/search-source-links ⭐ EMPFOHLEN

**Dokumentation:** `.context/feature-search-source-links.md`

**Beschreibung:** Vollständige Implementation der Source-Link Funktionalität mit YAML Front-Matter Unterstützung.

**Features:**
- ✅ YAML Front-Matter Middleware
- ✅ Database Source-Link Storage (`source_link` Spalte)
- ✅ MCP Tool Output-Formatierung
- ✅ Alle 3 Bug-Fixes implementiert
- ✅ End-to-End Tests (`test-source-link.ts`)
- ✅ Docker-Setup
- ✅ Dokumentation

**Bug-Fixes:**
1. **Bug #1:** `originalLink` Feld in `ScrapeResult` Interface
2. **Bug #2:** Datentransfer in `BaseScraperStrategy`
3. **Bug #3:** MCP Output-Formatierung in `search_docs` Tool

**Hauptänderungen:**
- `src/scraper/types.ts`: Added `originalLink` zu ScrapeResult
- `src/scraper/strategies/BaseScraperStrategy.ts`: originalLink Datentransfer
- `src/mcp/mcpServer.ts`: Source-Link Anzeige in Suchergebnissen
- `src/scraper/middleware/FrontMatterMiddleware.ts`: NEW - YAML Parser
- `db/migrations/011-add-source-link-to-pages.sql`: NEW - DB Schema
- `src/test-source-link.ts`: NEW - End-to-End Test

**Nächste Schritte:**
1. Pull Request gegen upstream/main erstellen
2. Code-Review
3. Merge und Release

**Verwendung:**
```bash
git checkout feature/search-source-links
cat .context/feature-search-source-links.md
git push origin feature/search-source-links
```

---

### 2. feature/frontmatter-middleware ⚠️ UNVOLLSTÄNDIG

**Dokumentation:** `.context/feature-frontmatter-middleware.md`

**Beschreibung:** Basis-Implementation der Front-Matter Infrastructure ohne MCP-Integration.

**Features:**
- ✅ YAML Front-Matter Middleware
- ✅ Database Source-Link Storage
- ❌ MCP Tool Output (fehlt!)
- ❌ Bug-Fixes (fehlen!)
- ❌ End-to-End Tests (fehlen!)

**Einschränkungen:**
- Source-Link wird in DB gespeichert aber **NICHT angezeigt** im MCP Tool
- Keine Bug-Fixes für Datentransfer
- Keine Ausgabe-Formatierung

**Status:** Teilimplementierung - für Production **nicht** geeignet

**Empfehlung:**
- **NICHT verwenden** für Pull Request
- Entweder archivieren oder mit `feature/search-source-links` mergen
- Nur als historische Referenz behalten

**Verwendung:**
```bash
git checkout feature/frontmatter-middleware
cat .context/feature-frontmatter-middleware.md
```

---

### 3. config/local ℹ️ NUR KONFIGURATION

**Dokumentation:** `.context/config-local.md`

**Beschreibung:** Lokale Development-Konfiguration ohne Feature-Implementierungen.

**Inhalte:**
- ✅ Docker-Setup (Compose, Dockerfile)
- ✅ Port-Mappings (6290, 6280, 6270)
- ✅ Development-Tools (update-from-upstream.sh)
- ✅ IDE-Konfiguration (.claude/, .serena/)
- ✅ Dokumentation (CLAUDE.md, .context/)
- ❌ **KEINE Features**
- ❌ **KEINE Code-Änderungen**

**Zweck:**
- Lokale Development-Umgebung
- Docker-Container Setup
- Tool-Konfiguration
- Basis für Feature-Branches

**Verwendung:**
```bash
git checkout config/local
cat .context/config-local.md

# Docker starten
docker-compose up -d

# Upstream synchronisieren
./update-from-upstream.sh
```

---

## Feature-Vergleich

### Front-Matter Unterstützung

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| FrontMatterMiddleware | ✅ | ✅ | ❌ |
| YAML Parsing | ✅ | ✅ | ❌ |
| Metadaten-Extraktion | ✅ | ✅ | ❌ |
| Unit-Tests | ✅ | ✅ | ❌ |

### Source-Link Pipeline

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| Pipeline Integration | ✅ | ✅ | ❌ |
| originalLink in PipelineResult | ✅ | ✅ | ❌ |
| originalLink in ScrapeResult | ✅ | ❌ | ❌ |
| Datentransfer BaseScraperStrategy | ✅ | ❌ | ❌ |

### Database

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| Migration 011 | ✅ | ✅ | ❌ |
| source_link Spalte | ✅ | ✅ | ❌ |
| DocumentStore Integration | ✅ | ✅ | ❌ |
| DocumentRetriever sourceLink | ✅ | ❌ | ❌ |

### MCP Tool

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| search_docs Output | ✅ | ❌ | ❌ |
| Source: Zeile | ✅ | ❌ | ❌ |
| Type-Annotation Fix | ✅ | ❌ | ❌ |

### Testing

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| Unit-Tests | ✅ | ✅ | ❌ |
| Integration-Tests | ✅ | ✅ | ❌ |
| End-to-End Test | ✅ | ❌ | ❌ |
| test-source-link.ts | ✅ | ❌ | ❌ |

### Infrastructure

| Feature | search-source-links | frontmatter-middleware | config/local |
|---------|---------------------|------------------------|--------------|
| Docker-Setup | ✅ | ✅ | ✅ |
| docker-compose.override.yml | ✅ | ✅ | ✅ |
| Port-Mappings | ✅ | ✅ | ✅ |
| Development-Tools | ✅ | ✅ | ✅ |

---

## Commit-Historie

### feature/search-source-links

```
d9a59ef docs: add branch documentation for feature/search-source-links
34f7547 fix: complete source link feature implementation
0df14fc chore: update settings.local.json
03f3cca chore: update .gitignore
486f294 feat: include source_link in search results
30a039e fix: revert list_libraries tool to use plain object schema
891571f chore: update .gitignore and settings.local.json
de5fe22 feat: add source_link storage for front-matter links
1b00e41 feat: add YAML front-matter support to Markdown pipeline
...
```

**Wichtigste Commits:**
- `34f7547`: **Bug-Fixes** (3 Fixes für Source-Link Feature)
- `486f294`: Source-Link in Suchergebnissen
- `de5fe22`: Database Storage
- `1b00e41`: YAML Front-Matter Middleware

### feature/frontmatter-middleware

```
050b64c docs: add branch documentation for feature/frontmatter-middleware
30a039e fix: revert list_libraries tool to use plain object schema
891571f chore: update .gitignore and settings.local.json
de5fe22 feat: add source_link storage for front-matter links
1b00e41 feat: add YAML front-matter support to Markdown pipeline
...
```

**Wichtigste Commits:**
- `de5fe22`: Database Storage
- `1b00e41`: YAML Front-Matter Middleware

### config/local

```
2dad7a4 docs: add branch documentation for config/local
ad54322 fix: revert list_libraries tool to use plain object schema
9d6c155 chore: update .gitignore
5ace8dd Merge fix/dependency-conflicts into config/local
...
```

**Wichtigste Commits:**
- Docker-Konfiguration
- Development-Tools
- Dependency-Fixes

---

## Merge-Strategie

### Empfohlene Vorgehensweise

**Option A: Nur feature/search-source-links verwenden** ⭐ EMPFOHLEN

```bash
# 1. feature/search-source-links für PR vorbereiten
git checkout feature/search-source-links
git push origin feature/search-source-links

# 2. Andere Branches archivieren
git branch -m feature/frontmatter-middleware feature/frontmatter-middleware-archive
git branch -m config/local config/local-archive
```

**Option B: Branches mergen**

```bash
# 1. config/local in feature/search-source-links mergen
git checkout feature/search-source-links
git merge config/local

# 2. feature/frontmatter-middleware löschen (redundant)
git branch -D feature/frontmatter-middleware
```

**Option C: Alle behalten**

```bash
# Regelmäßig von upstream/main updaten
git checkout feature/search-source-links
./update-from-upstream.sh

git checkout feature/frontmatter-middleware
./update-from-upstream.sh

git checkout config/local
./update-from-upstream.sh
```

---

## Pull Request Vorbereitung

### Checklist für feature/search-source-links

- [x] Alle Features implementiert
- [x] Alle Tests bestehen
- [x] Docker-Build erfolgreich
- [x] Dokumentation vollständig
- [x] Commit-Messages aussagekräftig
- [ ] Code-Review durchgeführt
- [ ] PR-Beschreibung geschrieben
- [ ] Screenshots/Demos vorbereitet

### PR-Titel und Beschreibung

**Titel:**
```
feat: Add YAML front-matter support with source link tracking
```

**Beschreibung:**
```markdown
## Overview

Implements comprehensive YAML front-matter support for Markdown documents with source link tracking and display in MCP search results.

## Features

- ✅ YAML Front-Matter Middleware for metadata extraction
- ✅ Database storage of original source links
- ✅ MCP tool integration with source link display
- ✅ Complete test coverage (unit, integration, end-to-end)

## Bug Fixes

Fixed three critical bugs preventing source link feature from working:
1. Missing `originalLink` field in `ScrapeResult` interface
2. Data transfer gap in `BaseScraperStrategy`
3. MCP output formatting issue filtering out `sourceLink`

## Testing

All tests pass:
- Unit tests for FrontMatterMiddleware
- Integration tests for MarkdownPipeline
- End-to-end test (`test-source-link.ts`)
- Manual verification in Docker environment

## Breaking Changes

None. Fully backward compatible.

## Documentation

- Complete branch documentation in `.context/`
- Test file demonstrates usage
- Updated CLAUDE.md with project context
```

---

## Upstream-Synchronisation

### Update von upstream/main

```bash
# 1. Upstream fetchen
git fetch upstream

# 2. In Branch wechseln
git checkout feature/search-source-links

# 3. Script verwenden oder manuell mergen
./update-from-upstream.sh

# Oder manuell:
git merge upstream/main
# Konflikte auflösen falls nötig
git add .
git commit
```

### Konflikt-Behandlung

Bei Merge-Konflikten:

1. **Konflikte identifizieren:**
   ```bash
   git status
   ```

2. **Konflikte manuell auflösen:**
   - Datei öffnen
   - Zwischen `<<<<<<<`, `=======`, `>>>>>>>` wählen
   - Speichern

3. **Commit abschließen:**
   ```bash
   git add .
   git commit
   ```

---

## Nächste Schritte

### Kurzfristig (diese Woche)

1. ✅ Branch-Dokumentation erstellen
2. ✅ Alle Änderungen committen
3. ✅ Finale Tests durchführen
4. [ ] Pull Request erstellen
5. [ ] Code-Review durchführen

### Mittelfristig (nächste Woche)

1. [ ] PR mergen in upstream/main
2. [ ] Release vorbereiten
3. [ ] Branches aufräumen
4. [ ] Dokumentation aktualisieren

### Langfristig

1. [ ] Weitere Front-Matter Felder unterstützen
2. [ ] Performance-Optimierungen
3. [ ] Erweiterte Metadaten-Extraktion

---

## Zusammenfassung

**🎯 EMPFEHLUNG:**

Verwende `feature/search-source-links` für den Pull Request gegen `upstream/main`.

Dieser Branch enthält:
- ✅ Vollständige Feature-Implementation
- ✅ Alle Bug-Fixes
- ✅ Komplette Test-Coverage
- ✅ Produktionsreife Code-Qualität

Die anderen Branches können archiviert oder gelöscht werden, da alle Funktionalität in `feature/search-source-links` enthalten ist.

**Branch wechseln:**
```bash
git checkout feature/search-source-links
```

**Dokumentation:**
- Diese Datei: `.context/branches-overview.md`
- Branch-Details: `.context/feature-search-source-links.md`
