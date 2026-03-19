# Ingestion

## How It Works

Text goes in. Entities and relationships come out. Here's the pipeline:

```
Raw Text → [Language Detection] → [Translation] → Chunking → LLM Extraction → Canonicalization → Validation → Neo4j
```

## Input Methods

### Stdin (paste)

```bash
# Pipe text in
cat notes.txt | bun run knowledge:ingest -

# Or paste interactively (Ctrl+D when done)
bun run knowledge:ingest -
```

### Single file

```bash
bun run knowledge:ingest ./notes/meeting.md
```

### Directory

```bash
bun run knowledge:ingest ./notes/
```

Processes all `.txt`, `.md`, `.json`, and `.csv` files. Skips subdirectories and other extensions.

## Multilingual Support

Text in any language is automatically detected and translated to English before extraction. This ensures consistent entity names regardless of the source language.

**Supported languages**: Portuguese (pt-BR), Spanish, French, German, Italian, Japanese, Chinese, Korean, Russian, and 70+ more via `franc-min`.

**How it works**:
1. `franc-min` detects the language of the input text
2. If not English, Gemini translates the full text to English
3. Translation preserves proper names, dates, company names, and technical terms
4. The translated text is then chunked and extracted normally

**Example**:
```bash
# Portuguese input
echo "Maria Silva trabalha na Petrobras no Rio de Janeiro." | bun run knowledge:ingest -

# Output: Detected Portuguese, translating to English...
# Entities extracted: Maria Silva (Person), Petrobras (Organization), Rio de Janeiro (Location)
```

The original text is preserved in the provenance (`rawText`) for traceability.

## Chunking

Large texts are split into ~2000 character chunks at sentence boundaries.

Why chunking matters:
- LLM providers have input token limits
- Smaller chunks produce more focused, accurate extractions
- Each chunk gets its own provenance record for traceability

## Extraction

Each chunk is sent to the configured LLM provider with a structured output prompt. The LLM returns:

- **Entities** — Named things with a type, aliases, and properties
- **Relations** — Typed connections between entities (e.g., `WORKS_AT`, `PART_OF`)
- **Summary** — A 1-2 sentence summary of the chunk

Entity types are semi-constrained:
- Preferred: `Person`, `Organization`, `Project`, `Event`, `Location`, `Concept`, `Technology`, `Document`
- The LLM can create new types if none fit

## Canonicalization

After extraction, entities are deduplicated:

1. **Exact match** — Same name + type = same entity
2. **Fuzzy match** — Levenshtein similarity ≥ 0.85 between names of the same type
3. **Alias match** — Entity aliases overlap with existing aliases

Matched entities are merged (properties combined, sources concatenated, highest confidence kept).

## After Ingestion

The CLI prints a summary:

```
──────────────────────────────────────────────────
✅ Ingestion complete
   Entities created: 5
   Entities merged:  2
   Relations created: 8
   Chunks processed: 3
──────────────────────────────────────────────────
```

If conflicts are detected:

```
   ⚠️  Conflicts: 1 (run: bun run knowledge:resolve)
```
