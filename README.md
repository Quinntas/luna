# Luna

Luna is a Bun-based TypeScript monorepo for building a personalized AI agent with memory, knowledge graph retrieval, tool use, prompt libraries, and experimental recursive language model workflows.

## What Is In This Repo

- `apps/agent`: CLI agent that wires together model access, guardrails, memory, knowledge retrieval, tools, and personalization.
- `apps/code`: Codex-backed runtime for thread, worktree, checkpoint, and session orchestration with Bun-based examples and tests.
- `packages/env`: Environment loading and validation.
- `packages/guard`: PII detection, redaction, and sensitivity classification.
- `packages/ai`: AI provider abstraction for Gemini and LiteLLM-compatible backends.
- `packages/prompts`: Shared prompt templates for agent, memory, knowledge, RAG, RLM, and vision flows.
- `packages/db`: SQLite persistence for tools, user preferences, and ingestion logs.
- `packages/knowledge`: Neo4j-backed knowledge graph, ingestion, extraction, and retrieval.
- `packages/rlm`: Recursive / reflexive reasoning utilities and tool wrappers.
- `packages/memory`: Fact extraction and tiered memory storage / retrieval.
- `packages/vision`: Image and PDF-page analysis helpers.
- `packages/tools`: Tool registry plus built-in file, web, memory, knowledge, and profile tools.
- `packages/personalize`: User preferences and mood adaptation.

## Architecture

```text
user input
  -> @luna/guard
  -> @luna/memory + @luna/knowledge
  -> @luna/prompts + @luna/personalize
  -> @luna/tools
  -> @luna/ai
  -> apps/agent

storage
  - SQLite: preferences, tool registry, ingestion logs
  - Neo4j: entities, relations, knowledge graph retrieval
```

## Requirements

- Bun 1.3+
- Docker Compose for Neo4j workflows
- One configured AI provider:
  - Gemini via `GEMINI_API_KEY`
  - LiteLLM-compatible endpoint via `LITELLM_URL` and `LITELLM_KEY`

## Setup

1. Install dependencies.

```bash
bun install
```

2. Create your local environment file.

```bash
cp .env.example .env
```

3. Fill in the required values in `.env`.

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=luna_dev_password

AI_PROVIDER=gemini
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your-key-here
```

4. Start Neo4j and initialize the schema.

```bash
bun run knowledge:setup
```

## Run The Agent

Run a single prompt:

```bash
bun run agent "What do you know about my current project?"
```

Run interactive mode:

```bash
bun run agent --interactive
```

The agent currently:

- filters and classifies user input for sensitive content
- retrieves relevant memories and knowledge graph context
- builds a personalized system prompt using preferences and mood
- executes built-in tools through a ReAct-style loop
- extracts facts from the exchange and stores them as memory

## Run The Code Runtime

Run the basic example:

```bash
bun run apps/code/examples/basic.ts
```

Run it with a trivial custom prompt:

```bash
LUNA_EXAMPLE_TEXT='What is 2+2? Reply with exactly 4.' bun run apps/code/examples/basic.ts
```

Useful `apps/code` commands:

```bash
# Run Bun tests for the app
bun test apps/code/test

# Typecheck the app
bun run --cwd apps/code typecheck

# Run example flows
bun run --cwd apps/code example:basic
bun run --cwd apps/code example:sqlite
bun run --cwd apps/code example:restore
bun run --cwd apps/code example:cleanup
```

`apps/code` thread state is stored in the shared SQLite database at `data/luna.db` by default.
Set `LUNA_DB_PATH` if you want the whole repo to use a different SQLite file.

## Knowledge Graph Workflows

Initialize Neo4j schema and start the local container:

```bash
bun run knowledge:setup
```

Ingest content:

```bash
bun run knowledge:ingest path/to/file.txt
```

Query entities:

```bash
bun run knowledge:query "Luna"
```

View graph stats:

```bash
bun run knowledge:stats
```

Resolve extracted conflicts:

```bash
bun run knowledge:resolve
```

Export or import the graph:

```bash
bun run knowledge:export
bun run knowledge:import
```

Reset the graph:

```bash
bun run knowledge:reset
```

Neo4j browser: `http://localhost:7474`

## Development Commands

```bash
# Start the root dev entry
bun run dev

# Lint + format
bun run check

# Lint only
bun run lint

# Format only
bun run format

# Typecheck every workspace package and app
bun run typecheck

# Knowledge package tests
bun run knowledge:test

# Code app tests
bun test apps/code/test
```

## Package Notes

### `@luna/env`

- `loadEnv()` for loading validated runtime configuration
- Zod schemas for providers and Neo4j / AI configuration

### `@luna/guard`

- `detectPII()` for matching sensitive data
- `redactPII()` and `filterInput()` for safe prompt input
- `classifySensitivity()` for routing / policy decisions

### `@luna/ai`

- `getModel()` for the default configured model
- provider factories for Gemini and LiteLLM-compatible endpoints
- routing support based on sensitivity level

### `@luna/knowledge`

- text extraction and ingestion helpers
- entity search and related-node lookup
- CRAG / Self-RAG helpers
- graph import, export, and maintenance flows

### `@luna/memory`

- fact extraction from conversations
- relevant memory retrieval and formatting
- memory storage, promotion, decay, and tag-based queries

### `@luna/tools`

- persistent tool registry backed by SQLite
- built-in tools for file IO, web search, memory, knowledge, and profile updates

### `@luna/personalize`

- persisted user preferences
- prompt adaptation based on response style preferences
- mood engine for conversational state changes

## Storage

- SQLite database path defaults to `data/luna.db`
- Neo4j stores entities, relations, provenance, and graph queries
- local DB tables include:
  - `threads`
  - `tools`
  - `user_preferences`
  - `ingestion_log`

## Monorepo Layout

```text
luna/
├── apps/
│   ├── agent/
│   └── code/
├── packages/
│   ├── ai/
│   ├── db/
│   ├── env/
│   ├── guard/
│   ├── knowledge/
│   ├── memory/
│   ├── personalize/
│   ├── prompts/
│   ├── rlm/
│   ├── tools/
│   └── vision/
├── data/
├── docker-compose.yml
└── package.json
```

## Notes

- Internal workspace dependencies use `workspace:*`.
- Imports use explicit `.ts` extensions.
- Formatting and linting are handled by Biome.
- The repo is set up as ESM only (`"type": "module"`).
