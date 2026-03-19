# Graph Schema

## Neo4j Node: Entity

Every extracted thing becomes an `Entity` node:

```cypher
(:Entity {
  id: string,           // deterministic hash of name + type
  name: string,         // canonical name
  type: string,         // Person, Organization, Project, etc.
  aliases: string[],    // alternative names
  properties: object,   // key-value facts (JSON stringified)
  confidence: float,    // 0.0 – 1.0
  sources: object[],    // provenance records (JSON stringified)
  createdAt: datetime,
  updatedAt: datetime
})
```

### ID Generation

Entity IDs are deterministic: `Bun.hash(type + ":" + lowercase_name)`. This means the same entity always gets the same ID regardless of which extraction run produces it.

## Relations

Relationships are typed edges between Entity nodes:

```cypher
(source:Entity)-[:WORKS_AT {
  id: string,
  confidence: float,
  properties: object,
  sources: object[]
}]->(target:Entity)
```

Relation types use `UPPER_SNAKE_CASE` and are created dynamically by the LLM (e.g., `WORKS_AT`, `PART_OF`, `LOCATED_IN`, `MENTIONS`, `KNOWS`).

## Constraints & Indexes

Created by `bun run knowledge:setup`:

| Constraint/Index | Purpose |
|---|---|
| `entity_id_unique` | Ensures no duplicate entity IDs |
| `entity_name_idx` | Fast lookup by name |
| `entity_type_idx` | Filter by type |
| `entity_confidence_idx` | Query high-confidence facts |

## Provenance Record

Every entity and relation carries an array of provenance records:

```typescript
interface Provenance {
  sourceType: "paste" | "file" | "email" | "chat";
  sourceRef: string;       // filename, "paste", conversation id
  chunkIndex?: number;     // which chunk of a large file
  extractedAt: string;     // ISO timestamp
  rawText: string;         // the chunk that produced this fact
}
```

This lets you trace any fact back to the exact text that produced it, and lets you remove all facts from a poisoned source with a single command.

## Confidence Scoring

| Source Count | Confidence |
|---|---|
| 1 source | 0.6 |
| 2 sources | 0.8 |
| 3 sources | 0.85 |
| 5+ sources | 0.95 |

When an entity is merged (same name found in multiple extractions), sources are concatenated and confidence is recalculated.

## Upsert Behavior

Entities and relations use Cypher `MERGE`:

- **On create**: Sets all properties, confidence, sources
- **On match**: Merges aliases and sources, keeps higher confidence value, updates `updatedAt`

This means re-ingesting the same text is idempotent.
