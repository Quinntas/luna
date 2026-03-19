# Overview

Luna Knowledge is a local personal knowledge graph that ingests text (notes, conversations, emails) and builds a structured graph of entities and relationships.

## Architecture

```
Text Input ──→ Chunker ──→ LLM (extract) ──→ Canonicalize ──→ Validate ──→ Neo4j
                              (any provider)    (dedup)       (confidence,
                                                               conflicts)
```

### Data Flow

1. **Ingest** — Text arrives via stdin (paste), file path, or directory
2. **Chunk** — Large text is split into ~2000 char chunks at sentence boundaries
3. **Extract** — LLM (via Vercel AI SDK + `generateObject`) extracts entities and relations as structured JSON validated by Zod. Provider is configurable: Gemini, LiteLLM, or any AI SDK-compatible provider.
4. **Canonicalize** — Extracted entities are matched against existing graph nodes using Levenshtein similarity + alias matching. Duplicates are merged.
5. **Validate** — Confidence scores are assigned based on source count. Contradicting property values are flagged as conflicts.
6. **Store** — Entities and relations are upserted into Neo4j with full provenance tracking.

### Key Components

| Module | Purpose |
|---|---|
| `src/extract/` | LLM-based entity/relation extraction (provider-agnostic) |
| `src/canonicalize/` | Entity deduplication via fuzzy matching |
| `src/validate/` | Confidence scoring, conflict detection, provenance |
| `src/graph/` | Neo4j driver, schema, upsert operations, queries |
| `scripts/` | CLI entry points for ingest, query, stats |

### Anti-Poisoning

Every fact carries:
- **Confidence score** (0.6–0.95) based on how many sources corroborate it
- **Provenance** — source file, chunk index, raw text, timestamp
- **Conflict detection** — contradicting values are flagged for review

See [anti-poisoning.md](./anti-poisoning.md) for details.

### Requirements

- Bun runtime
- Docker (for Neo4j)
- An LLM API key — Gemini (direct) or LiteLLM (supports Gemini, OpenAI, Anthropic, etc.)

### Packages

| Package | Purpose |
|---|---|
| `@luna/knowledge` | Knowledge graph: ingestion, extraction, graph ops, queries |
| `@luna/ai` | AI model abstraction: provider-agnostic `getModel()`, Gemini + LiteLLM support |
