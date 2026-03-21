# AGENTS.md

Instructions for coding in the Luna monorepo.

## Monorepo Structure

```
luna/
├── packages/
│   ├── env/              # @luna/env — Env loading, Zod validation (dotenv)
│   ├── guard/            # @luna/guard — PII detection, redaction, sensitivity classification
│   ├── ai/               # @luna/ai — AI model abstraction (Gemini, LiteLLM)
│   ├── prompts/          # @luna/prompts — All prompt templates (dedent)
│   ├── db/               # @luna/db — Drizzle ORM + SQLite (tools, preferences, logs)
│   ├── knowledge/        # @luna/knowledge — Knowledge graph (Neo4j, extraction, RAG)
│   ├── rlm/              # @luna/rlm — Recursive Language Models + ReAct agent
│   ├── memory/           # @luna/memory — Fact extraction, tiered memory, TTL
│   ├── vision/           # @luna/vision — Image/document understanding
│   ├── tools/            # @luna/tools — Tool registry, search, execution
│   └── personalize/      # @luna/personalize — User preferences, style adaptation
├── apps/                 # Future apps that consume packages
├── src/                  # Root entry point
├── biome.json            # Linter/formatter config (root)
├── tsconfig.base.json    # Shared TypeScript config
├── bunfig.toml           # Bun workspace config
├── docker-compose.yml    # Neo4j container
└── .env                  # Environment variables (gitignored)
```

## Packages

| Package | Purpose |
|---|---|
| `@luna/env` | Env loading (dotenv + Zod). All other packages use this. |
| `@luna/guard` | PII detection (SSN, email, phone, credit card). Sensitivity classification. |
| `@luna/ai` | Model factory (Gemini, LiteLLM). Data classification routing. |
| `@luna/prompts` | All 20 prompt functions across 6 domains (agent, knowledge, memory, rag, rlm, vision). |
| `@luna/db` | Drizzle ORM + SQLite. Tools registry, user preferences, ingestion log. |
| `@luna/knowledge` | Knowledge graph (Neo4j). Entity/relation extraction, RAG (Self-RAG, CRAG). |
| `@luna/rlm` | Recursive Language Models (QuickJS sandbox). ReAct agent. Reflexion. |
| `@luna/memory` | Tiered memory (working/short_term/long_term). Configurable TTL. |
| `@luna/vision` | Image/document understanding via vision models. |
| `@luna/tools` | Tool registry (persisted in SQLite). Search, execute, validate. |
| `@luna/personalize` | User preferences (persisted in SQLite). Style adaptation. |

### Internal Dependencies

```
@luna/env           (dotenv, zod)
@luna/guard         (no deps)
@luna/ai            (@luna/env, ai, @ai-sdk/google, @ai-sdk/openai-compatible)
@luna/prompts       (dedent)
@luna/db            (drizzle-orm)
@luna/knowledge     (@luna/ai, @luna/env, @luna/prompts, ai, neo4j-driver, franc-min)
@luna/memory        (@luna/ai, @luna/knowledge, @luna/prompts, ai, zod)
@luna/rlm           (@luna/prompts, ai, quickjs-emscripten, zod)
@luna/vision        (@luna/prompts, ai)
@luna/tools         (@luna/db, @luna/ai, ai, zod)
@luna/personalize   (@luna/db, @luna/ai, ai)
```

Use `workspace:*` for cross-package references.

## Code Style

Enforced by Biome. Run `bun run check` to auto-fix everything.

| Rule | Setting |
|---|---|
| Indent | Tabs |
| Quotes | Double |
| Semicolons | Always |
| Trailing commas | All |
| Line width | 100 |
| Imports | Auto-sorted by Biome |

### Import conventions

```typescript
import { generateObject } from "ai";
import { getModel } from "@luna/ai";
import { config } from "../config.ts";
import type { Entity } from "./types.ts";
```

Always use `.ts` extensions in imports (required by `"moduleResolution": "bundler"`).

### TypeScript rules

- `"strict": true` — no implicit any, strict null checks
- `"noUncheckedIndexedAccess": true` — array/object access returns `T | undefined`
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- Avoid `!` non-null assertions — use guards (`if (!x) return`) or optional chaining

## Commands

### Root (from `luna/`)

```bash
# Lint + format (auto-fix)
bun run check

# Lint only (no fixes)
bun run lint

# Format only
bun run format

# Typecheck all 11 packages
bun run typecheck

# Knowledge graph shortcuts
bun run knowledge:setup     # Start Neo4j + init schema
bun run knowledge:ingest     # Ingest text (pipe via stdin or pass file path)
bun run knowledge:query      # Query entities
bun run knowledge:stats      # Graph overview
bun run knowledge:resolve    # Resolve conflicts (auto-apply to graph)
bun run knowledge:reset      # Clear graph + re-init schema (3s delay)
bun run knowledge:export     # Export graph to JSON
bun run knowledge:import     # Import graph from JSON
bun run knowledge:test       # Run unit tests
```

### Per-package (from `packages/<name>/`)

```bash
bun run <script-name>    # Run a script defined in package.json
```

## After Coding

Run these before considering work complete:

```bash
bun run check          # Lint + format all files
bun run typecheck      # Verify types across all 11 packages
```

Both must pass with zero errors.

## Adding a New Package

1. Create `packages/<name>/` with:
   - `package.json` — `"name": "@luna/<name>"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`
   - `tsconfig.json` — `{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }`
   - `src/index.ts` — public API exports
2. Internal deps use `workspace:*`
3. Run `bun install` to link

## Environment Variables

Configured in `.env` (root). See `.env.example` for all options.

| Variable | Required | Default |
|---|---|---|
| `NEO4J_URI` | No | `bolt://localhost:7687` |
| `NEO4J_USER` | No | `neo4j` |
| `NEO4J_PASSWORD` | Yes | — |
| `AI_PROVIDER` | No | `gemini` |
| `AI_MODEL` | Yes | — |
| `GEMINI_API_KEY` | If `gemini` | — |
| `LITELLM_URL` | If `litellm` | — |
| `LITELLM_KEY` | If `litellm` | — |
| `LUNA_DB_PATH` | No | `data/luna.db` |

## Neo4j

- Runs via Docker: `docker compose up -d`
- Browser UI: http://localhost:7474 (neo4j / luna_dev_password)
- Schema init: `bun run knowledge:setup` (creates constraints + indexes)
- APOC plugin included for list operations
- Properties and sources stored as JSON strings (Neo4j can't store maps)

## Storage

| Data | Backend | Package |
|---|---|---|
| Knowledge graph (entities, relations) | Neo4j | `@luna/knowledge` |
| Memories (with TTL) | Neo4j (in-memory Map with expiry) | `@luna/memory` |
| Tool registry | SQLite (Drizzle) | `@luna/db` + `@luna/tools` |
| User preferences | SQLite (Drizzle) | `@luna/db` + `@luna/personalize` |
