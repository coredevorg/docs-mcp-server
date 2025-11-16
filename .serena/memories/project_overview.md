# Project Overview

**Name**: Docs MCP Server  
**Repository**: `arabold/docs-mcp-server`

## Purpose

The Docs MCP Server is a documentation indexing and search system that provides AI assistants with up-to-date, version-specific documentation via the Model Context Protocol (MCP). 

## Key Features

- Scrapes documentation from multiple sources:
  - Websites (with JavaScript execution via Playwright)
  - GitHub repositories
  - Package registries (npm, PyPI)
  - Local files
  
- Makes documentation searchable using:
  - Semantic vector embeddings
  - Full-text search (FTS)
  - Hybrid search combining both approaches

- Supports multiple deployment modes:
  - **Unified Server** (default): Single process with embedded MCP server, web UI, and worker
  - **Distributed Mode**: Separate services (worker, MCP server, web interface)

## Core Functionality

1. **Content Acquisition**: Strategy pattern for different documentation sources
2. **Content Processing**: Semantic chunking based on document structure
3. **Embedding Generation**: Vector embeddings using various providers (OpenAI, Google, Azure, AWS)
4. **Search**: Hybrid vector + FTS with hierarchical reassembly
5. **Storage**: SQLite with sqlite-vec extension for vector search

## Protocol Auto-detection

The system automatically detects the protocol based on TTY status:
- stdio for AI tools (non-TTY)
- HTTP for interactive terminals (TTY)
