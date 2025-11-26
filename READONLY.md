# Read-Only Modus Anleitung

Dieses Dokument beschreibt zwei Methoden, um den MCP Server im Read-Only Modus zu starten.

## Methode 1: Separate Compose-Datei (Stacking)

Nutzen Sie die Datei `docker-compose.readonly.yml`, die die Konfiguration erweitert.

**Befehl:**
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.readonly.yml up -d
```

## Methode 2: Environment Variable (Empfohlen)

Nutzen Sie die Datei `docker-compose.entrypoint.yml`. Diese Datei modifiziert den Container-Entrypoint, um Umgebungsvariablen im Startbefehl zu ermöglichen.

**Einrichtung:**
Benennen Sie `docker-compose.entrypoint.yml` idealerweise in `docker-compose.override.yml` um, damit sie automatisch von Docker Compose geladen wird.

**Normaler Start (Schreibzugriff):**
```bash
docker compose up -d
```

**Read-Only Start:**
Setzen Sie die Variable `MCP_READ_ONLY_FLAG`.
```bash
MCP_READ_ONLY_FLAG="--read-only" docker compose up -d
```
Alternativ können Sie die Variable auch in Ihrer `.env` Datei setzen.
