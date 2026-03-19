# AGENTS.md

Instructions for coding in the Luna monorepo.

## Monorepo Structure

```
luna/
├── packages/
│   ├── ai/              # @luna/ai — AI model abstraction (provider-agnostic)
│   └── knowledge/       # @luna/knowledge — Knowledge graph (ingestion, Neo4j, queries)
├── apps/                # Future apps that consume packages
├── src/                 # Root entry point
├── biome.json           # Linter/formatter config (root)
├── tsconfig.base.json   # Shared TypeScript config
├── bunfig.toml          # Bun workspace config
├── docker-compose.yml   # Neo4j container
└── .env                 # Environment variables (gitignored)
```

## Packages

| Package | Import | Purpose |
|---|---|---|
| `@luna/ai` | `packages/ai/` | Model factory, provider config (Gemini, LiteLLM) |
| `@luna/knowledge` | `packages/knowledge/` | Knowledge graph: extraction, Neo4j, ingestion, queries |

### Internal dependencies

- `@luna/knowledge` depends on `@luna/ai` via `"@luna/ai": "workspace:*"`
- Use `workspace:*` for cross-package references in `package.json`

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
// External deps first, then internal, then relative
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

# Typecheck all packages
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
bun run typecheck      # Verify types across packages
```

Both must pass with zero errors.

If you added a new package, typecheck it explicitly:

```bash
bunx tsc --noEmit --project packages/<name>/tsconfig.json
```

## Adding a New Package

1. Create `packages/<name>/` with:
   - `package.json` — `"name": "@luna/<name>"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`
   - `tsconfig.json` — `{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }`
   - `src/index.ts` — public API exports

2. Internal deps use `workspace:*`:
   ```json
   "dependencies": { "@luna/ai": "workspace:*" }
   ```

3. Run `bun install` to link.

## Adding a New Script

1. Create `packages/<name>/scripts/<script>.ts`
2. Add to the package's `package.json` scripts:
   ```json
   "scripts": { "my-script": "bun run scripts/my-script.ts" }
   ```
3. Optionally add a root shortcut in root `package.json`:
   ```json
   "name:my-script": "bun run packages/name/scripts/my-script.ts"
   ```

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

All env validation uses Zod. Invalid/missing vars fail at startup with clear messages.

## Neo4j

- Runs via Docker: `docker compose up -d`
- Browser UI: http://localhost:7474 (neo4j / luna_dev_password)
- Schema init: `bun run knowledge:setup` (creates constraints + indexes)
- Properties and sources are stored as JSON strings (Neo4j can't store maps)
- Merging is done in TypeScript (read-then-write), not via Cypher

## Documentation

Each package has a `docs/` directory with markdown files:

```
packages/knowledge/docs/
├── overview.md          # Architecture, data flow
├── setup.md             # Prerequisites, quick start, env vars
├── ingestion.md         # How ingestion pipeline works
├── graph-schema.md      # Neo4j node/edge structure
└── anti-poisoning.md    # Confidence, conflicts, provenance
```

Update docs when changing public behavior, adding env vars, or modifying the data model.
