# Pull Request Summary

**Datum**: 2025-11-17
**PR**: https://github.com/arabold/docs-mcp-server/pull/261
**Status**: ✅ Eingereicht

## Änderung

**Einzelne Datei**: `Dockerfile`

### Was wurde geändert

**Zeile 22**:
```dockerfile
# Vorher
RUN npm ci

# Nachher
RUN npm install --legacy-peer-deps
```

**Zeile 31**:
```dockerfile
# Vorher
RUN rm -rf node_modules && npm ci --omit=dev

# Nachher
RUN rm -rf node_modules && npm install --legacy-peer-deps --omit=dev
```

## Problem

Docker Build scheitert mit Peer-Dependency-Konflikt:
```
npm error ERESOLVE unable to resolve dependency tree
npm error peer @langchain/core@">=0.3.58 <0.4.0" from langchain@0.3.36
```

**Ursache**:
- Installiert: `@langchain/core@1.0.5`
- Benötigt von `langchain@0.3.36`: `@langchain/core >=0.3.58 <0.4.0`

## Lösung

`--legacy-peer-deps` Flag nutzen:
- Umgeht Peer-Dependency-Prüfung
- Erlaubt Installation inkompatibler Peer-Dependencies
- Standard-Workaround für solche Konflikte

## Testing

✅ **Docker Build**: Erfolgreich
```bash
docker build -t docs-mcp-server:local .
# ✅ Image erfolgreich gebaut
```

✅ **Container Start**: Alle Services laufen
```bash
docker compose up -d
# ✅ Worker (healthy)
# ✅ MCP Server
# ✅ Web Interface
```

✅ **Funktionalität**: Keine Regressionen
- Scraping funktioniert
- Search funktioniert
- Web UI lädt

## Lokale Entwicklung

### docker-compose.override.yml

Für lokale Anpassungen wurde `docker-compose.override.yml` erstellt:
- **Lokales Image**: `docs-mcp-server:local` statt Registry-Image
- **Angepasste Ports**: 6270, 6290, 6280 statt 8080, 6280, 6281
- **Automatisch geladen**: Docker Compose nutzt Override automatisch

**Vorteile**:
- ✅ `docker-compose.yml` bleibt unverändert (upstream-kompatibel)
- ✅ Lokale Konfiguration getrennt
- ✅ In `.gitignore` → wird nicht committed

### Verwendung

```bash
# Lokale Entwicklung (nutzt Override automatisch)
docker compose up -d

# Original-Konfiguration erzwingen
docker compose -f docker-compose.yml up -d
```

## Git-Struktur

### Branches

```
main (lokal)
  ↓
fix/docker-langchain-deps (PR-Branch) ← Pushed zu upstream
  ↓
config/local (Entwicklungs-Branch) ← Aktuell
```

**PR-Branch**: Nur Dockerfile-Änderung
**Local-Branch**: Alle lokalen Anpassungen (Ports, .env, etc.)

### Dateien

| Datei | Status | Zweck |
|-------|--------|-------|
| `Dockerfile` | ✅ Im PR | Dependency-Fix |
| `docker-compose.yml` | ⬜ Lokal restored | Upstream-kompatibel |
| `docker-compose.override.yml` | 🏠 Lokal | Port/Image-Overrides |
| `.env` | 🏠 Lokal | Konfiguration |
| `.context/` | 🏠 Lokal | Dokumentation |

## Nächste Schritte

### Wenn PR akzeptiert wird

```bash
# Upstream aktualisieren
git checkout main
git pull upstream main

# Lokalen Branch rebasen
git checkout config/local
git rebase main

# Lokales Image neu bauen
docker compose build
```

### Wenn PR abgelehnt/geändert wird

Der Fix bleibt in Ihrem `config/local` Branch verfügbar.
Docker-Builds funktionieren weiterhin mit lokalem Image.

## Upstream-Kompatibilität

**Ihre Änderungen bleiben erhalten**:
- ✅ Lokales Image via Override
- ✅ Angepasste Ports via Override
- ✅ .env Konfiguration unverändert
- ✅ Lokale Dokumentation in `.context/`

**Upstream kann mergen**:
- ✅ Nur Dockerfile betroffen
- ✅ Keine Konflikte mit Ihren lokalen Änderungen
- ✅ docker-compose.yml bleibt standard

## Commit-Details

**Branch**: `fix/docker-langchain-deps`
**Commit**: `12ba13d`
**Message**:
```
fix(docker): use --legacy-peer-deps to resolve langchain dependency conflict

Resolves peer dependency conflict between @langchain/core versions:
- Found: @langchain/core@1.0.5
- Required by langchain@0.3.36: >=0.3.58 <0.4.0

Changes:
- Line 22: Replace 'npm ci' with 'npm install --legacy-peer-deps'
- Line 31: Replace 'npm ci --omit=dev' with 'npm install --legacy-peer-deps --omit=dev'

Testing:
- Docker image builds successfully
- All services start and run correctly
- No functional regressions observed
```

## Lessons Learned

### Peer-Dependency-Konflikte

**Problem**: npm's strikte Peer-Dependency-Prüfung
**Lösung**: `--legacy-peer-deps` für Build-Prozesse
**Beste Praxis**: Langfristig Dependencies aktualisieren

### Fork-Workflow

**Setup**:
- `origin`: Ihr Fork (coredevorg/docs-mcp-server)
- `upstream`: Original-Repo (arabold/docs-mcp-server)

**PR erstellen**:
```bash
gh pr create --repo arabold/docs-mcp-server \
  --base main \
  --head coredevorg:fix/docker-langchain-deps
```

### Lokale Anpassungen

**docker-compose.override.yml**:
- Perfekt für lokale Entwicklung
- Getrennt von Upstream-Konfiguration
- Automatisch von Docker Compose erkannt

## Referenzen

- **PR**: https://github.com/arabold/docs-mcp-server/pull/261
- **Branch**: `fix/docker-langchain-deps`
- **Original Issue**: Docker Build Failure wegen Langchain Dependencies
- **Dokumentation**: `.context/environment-test-report.md`
