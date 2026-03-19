# Anti-Poisoning

Context poisoning happens when bad data enters the knowledge graph and corrupts future queries. Luna uses three layers of defense.

## 1. Confidence Scoring

Every fact gets a confidence score based on how many independent sources corroborate it:

| Sources | Confidence | Meaning |
|---|---|---|
| 1 | 0.6 | Tentative — single source |
| 2 | 0.8 | Corroborated |
| 3 | 0.85 | Well-supported |
| 5+ | 0.95 | Strong consensus |

When querying, you can filter by confidence to only use well-supported facts.

## 2. Conflict Detection

Before upserting, new property values are checked against existing values:

- **Numbers**: Flagged if they differ by more than 0.01
- **Strings**: Flagged if they differ after normalization
- **Booleans**: Flagged if they differ

Conflicts are stored separately and can be reviewed:

```bash
bun run knowledge:resolve
```

This shows each conflict with its competing values and their source texts, then lets you pick which value to keep.

## 3. Source Provenance

Every fact carries full provenance:

```typescript
{
  sourceType: "file",
  sourceRef: "meeting-notes.md",
  chunkIndex: 2,
  extractedAt: "2026-03-19T14:30:00Z",
  rawText: "Alice was promoted to VP of Engineering at Google in January."
}
```

### Removing a poisoned source

If you ingest text that turns out to be wrong or malicious:

```typescript
import { removeSource } from "@luna/knowledge";

// Deletes all entities that only had this one source
await removeSource("bad-notes.md");
```

Or from the graph directly:

```cypher
MATCH (e:Entity)
WHERE ANY(s IN e.sources WHERE s.sourceRef = 'bad-notes.md')
DETACH DELETE e
```

## What's NOT Covered Yet

- **LLM hallucination during extraction**: The LLM might invent facts not in the source text. Mitigation: the raw text is stored per chunk, so you can audit. A future improvement would be a secondary validation pass.
- **Sophisticated attacks**: A deliberately crafted text that overwrites correct facts with high-confidence wrong facts. Mitigation: keep source count thresholds high (don't trust single-source high-confidence claims).
