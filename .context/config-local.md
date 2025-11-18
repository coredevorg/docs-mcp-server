# Branch: config/local

**Basis:** upstream/main
**Erstellt:** 2025-11-17
**Letzte Aktualisierung:** 2025-11-18

## Übersicht

Dieser Branch enthält lokale Entwicklungs-Konfiguration und Infrastructure-Setup für das docs-mcp-server Projekt. Er enthält **keine Feature-Implementierungen**, sondern nur Konfigurationsdateien, Docker-Setup und Development-Tools.

**Zweck:** Lokale Entwicklungsumgebung mit Docker Compose, angepassten Ports und gemounteten Verzeichnissen.

## Hauptbestandteile

### 1. Docker-Konfiguration
- **docker-compose.yml:** Angepasste Port-Mappings
- **docker-compose.override.yml:** Lokale Development-Overrides
- **Dockerfile:** npm install mit `--legacy-peer-deps`

### 2. Development-Tools
- **update-from-upstream.sh:** Automatisches Upstream-Synchronisations-Script
- **.claude/settings.local.json:** Claude Code IDE-Konfiguration
- **.serena/:** MCP-Server Konfiguration und Memories

### 3. Dokumentation
- **CLAUDE.md:** AI-Assistant Projekt-Guidance
- **.context/:** Verschiedene Analyse-Dokumente
- **.gitignore:** Erweitert für lokale Dateien

## Geänderte Dateien aus Upstream

### Docker & Container

1. **docker-compose.yml**
   - Modified: Port-Mappings für Services
   - Ports:
     - MCP Server: 6290 (war: 6280)
     - Web: 6280 (war: 6281)
     - Worker: 6270 (war: 8080)
   - Grund: Vermeidung von Port-Konflikten

2. **docker-compose.override.yml**
   - New File: Lokale Development-Overrides
   - Volumes: Mount lokales `docs/` Directory
   - Environment: Zusätzliche Variablen für Testing
   - Grund: Development ohne Container-Rebuild

3. **Dockerfile**
   - Modified: `npm install --legacy-peer-deps`
   - Grund: Auflösung von Peer-Dependency-Konflikten

### Dependencies

4. **package.json & package-lock.json**
   - Fixed: Zod und LangChain Dependency-Konflikte
   - Resolved: Peer-Dependency-Warnings
   - Grund: Stabiles Build ohne Warnings

### Development-Tools

5. **update-from-upstream.sh**
   - New File: Bash-Script für Upstream-Sync
   - Funktionen:
     - Fetch von upstream/main
     - Automatischer Merge
     - Konflikt-Behandlung
   - Usage: `./update-from-upstream.sh`
   - Grund: Vereinfachtes Branch-Update

### IDE & Tools Konfiguration

6. **.claude/settings.local.json**
   - New File: Claude Code lokale Settings
   - Bash-Befehle für:
     - Docker-Container Management
     - Scraping-Operations
     - Database-Queries
   - Grund: IDE-Integration

7. **.serena/project.yml**
   - New File: MCP-Server Projekt-Konfiguration
   - Excluded Tools: Bestimmte MCP-Tools deaktiviert
   - Grund: Projekt-spezifische Tool-Auswahl

8. **.serena/.gitignore**
   - New File: Ignore MCP-Server temporäre Dateien
   - Grund: Sauberes Git-Repository

### Serena Memories (Codebase-Kontext)

9. **.serena/memories/codebase_structure.md**
   - Codebase-Struktur Dokumentation
   - Directory-Layout
   - Modul-Übersicht

10. **.serena/memories/tech_stack.md**
    - Technology-Stack Dokumentation
    - Dependencies und Versionen
    - Tool-Chain Beschreibung

11. **.serena/memories/code_style_conventions.md**
    - Code-Style Guidelines
    - Naming-Conventions
    - Best-Practices

12. **.serena/memories/project_overview.md**
    - High-Level Projekt-Übersicht
    - Architektur-Beschreibung
    - Feature-Übersicht

13. **.serena/memories/suggested_commands.md**
    - Häufig verwendete Befehle
    - CLI-Shortcuts
    - Docker-Commands

14. **.serena/memories/task_completion_guidelines.md**
    - Task-Completion Checklisten
    - Testing-Guidelines
    - Deployment-Prozess

15. **.serena/memories/MCP_Schema_Validation_Investigation.md**
    - Investigation von MCP-Schema-Validierungs-Fehlern
    - Zod-Schema Debugging
    - Lösungs-Dokumentation

### Dokumentation

16. **CLAUDE.md**
    - New File: Projekt-Guidance für AI-Assistenten
    - Inhalte:
      - Projekt-Struktur
      - Development-Workflow
      - Code-Conventions
      - Testing-Guidelines
    - Grund: Bessere AI-Unterstützung

17. **.context/environment-test-report.md**
    - Test-Berichte für Environment-Setup
    - Docker-Container Status
    - Service-Connectivity Tests

18. **.context/frontmatter-extension-plan.md**
    - Plan für Front-Matter Feature-Erweiterung
    - Requirements und Design-Entscheidungen

19. **.context/pull-request-summary.md**
    - PR-Vorbereitungs-Dokumentation
    - Change-Summaries
    - Review-Checklisten

### Git-Konfiguration

20. **.gitignore**
    - Added: `.store*` Verzeichnisse (Test-Datenbanken)
    - Added: `.serena/` (außer tracked Dateien)
    - Added: `test-data/` Verzeichnis
    - Added: `.claude/` lokale Settings
    - Grund: Ignorieren von generierten/lokalen Dateien

### MCP-Server Anpassungen

21. **src/mcp/mcpServer.ts**
    - Fixed: `list_libraries` Tool Schema
    - Changed: Plain Object statt Zod-Schema
    - Grund: MCP-Tool Validierungs-Kompatibilität

## KEINE Feature-Implementierungen

Dieser Branch enthält **NICHT**:

❌ Front-Matter Middleware
❌ Source-Link Storage
❌ Database-Migrationen
❌ Pipeline-Änderungen
❌ Scraper-Modifikationen
❌ Store-Anpassungen

## Docker-Setup

### Port-Mappings

```yaml
services:
  mcp:
    ports:
      - "6290:6280"  # MCP Server

  web:
    ports:
      - "6280:6281"  # Web UI

  worker:
    ports:
      - "6270:8080"  # Worker Service
```

### Volume-Mounts

```yaml
services:
  worker:
    volumes:
      - ./docs:/app/docs  # Lokale Docs
      - ./.store:/app/.store  # Database
```

## Verwendung

### Docker-Container starten

```bash
# Container starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Container stoppen
docker-compose down
```

### Upstream-Synchronisation

```bash
# Upstream-Änderungen mergen
./update-from-upstream.sh

# Bei Konflikten: Manuell auflösen
git status
git add .
git commit
```

### Scraping-Tests

```bash
# Im Container
docker exec docs-mcp-worker node dist/index.js scrape <library> <url>

# Lokal
DOCS_MCP_STORE_PATH=./.store npm start -- scrape <library> <url>
```

## Development-Workflow

1. **Container Setup:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

2. **Code-Änderungen:**
   - Lokale Änderungen in `src/`
   - Hot-Reload (falls konfiguriert) oder Rebuild

3. **Testing:**
   ```bash
   npm test
   docker exec docs-mcp-worker npm test
   ```

4. **Upstream-Update:**
   ```bash
   ./update-from-upstream.sh
   ```

## Konfigurationsdateien

### Claude Code Settings

`.claude/settings.local.json`:
```json
{
  "bash": {
    "docker-ps": "docker-compose ps",
    "docker-logs": "docker-compose logs -f",
    "scrape-test": "docker exec docs-mcp-worker node dist/index.js scrape ..."
  }
}
```

### Serena Project Config

`.serena/project.yml`:
```yaml
name: docs-mcp-server
excluded_tools:
  - some_tool
  - another_tool
```

## Status

✅ Docker-Setup funktioniert
✅ Port-Mappings konfiguriert
✅ Lokale Volumes gemountet
✅ Dependencies aufgelöst
✅ Documentation vorhanden
❌ Keine Features implementiert

## Beziehung zu anderen Branches

- **feature/search-source-links:** Basiert auf config/local + Feature-Code
- **feature/frontmatter-middleware:** Basiert auf config/local + Middleware
- **upstream/main:** Basis für config/local

## Merge-Strategie

### Von config/local in Feature-Branches mergen:

```bash
# In Feature-Branch
git checkout feature/search-source-links
git merge config/local

# Konflikte auflösen falls nötig
git add .
git commit
```

### Upstream-Updates in config/local integrieren:

```bash
# In config/local
git checkout config/local
./update-from-upstream.sh

# Dann in Feature-Branches mergen
git checkout feature/search-source-links
git merge config/local
```

## Nächste Schritte

1. **Option A:** Als Basis-Branch behalten
   - Andere Branches bauen darauf auf
   - Nur Config-Änderungen hier

2. **Option B:** In Feature-Branches mergen
   - Config-Änderungen in alle Branches
   - config/local kann gelöscht werden

3. **Option C:** Als lokale Konfiguration
   - Nie in upstream mergen
   - Nur für lokales Development

## Best-Practices

### Nur Konfiguration committen

✅ Docker-Konfiguration
✅ IDE-Settings
✅ Dokumentation
✅ Build-Konfiguration

❌ Feature-Code
❌ Source-Code Änderungen
❌ Database-Migrationen
❌ Business-Logik

### Branch-Hygiene

1. Regelmäßig von upstream/main updaten
2. Konflikte sofort auflösen
3. Nur Config-relevante Commits
4. Klare Commit-Messages

## Troubleshooting

### Port-Konflikte

```bash
# Ports prüfen
lsof -i :6280
lsof -i :6290
lsof -i :6270

# Docker-Container neu starten
docker-compose down
docker-compose up -d
```

### Dependency-Probleme

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Container-Probleme

```bash
# Rebuild ohne Cache
docker-compose build --no-cache
docker-compose up -d
```
