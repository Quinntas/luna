# Setup

## Prerequisites

- [Bun](https://bun.sh) installed
- Docker and Docker Compose
- An LLM provider — one of:
  - **Gemini** direct: a Google Gemini API key
  - **LiteLLM**: a running LiteLLM proxy (supports Gemini, OpenAI, Anthropic, etc.)

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your provider:

```bash
# Provider: "gemini" or "litellm"
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash-lite

# If using Gemini directly:
GEMINI_API_KEY=your-key-here

# If using LiteLLM:
# LITELLM_URL=http://localhost:4000
# LITELLM_KEY=your-key
```

### 2. Start Neo4j and initialize schema

```bash
bun run knowledge:setup
```

This does two things:
- Starts Neo4j 5 Community via Docker Compose
- Creates constraints and indexes in the graph

### 3. Verify connection

```bash
bun run knowledge:stats
```

Should show `Entities: 0, Relations: 0`.

### 4. Ingest your first text

```bash
# Paste text via stdin
echo "Alice works at Google as a PM. Google is headquartered in Mountain View." | bun run knowledge:ingest -

# Or ingest a file
bun run knowledge:ingest ./notes/meeting.md
```

### 5. Query

```bash
bun run knowledge:query "Alice"
bun run knowledge:query --search "Google"
```

## Neo4j Browser

Neo4j's web UI is available at http://localhost:7474.

- Username: `neo4j`
- Password: `luna_dev_password`

## Environment Variables

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEO4J_URI` | No | `bolt://localhost:7687` | Neo4j Bolt connection URI |
| `NEO4J_USER` | No | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | Yes | — | Neo4j password |

### AI Provider

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `gemini` | Provider: `gemini` or `litellm` |
| `AI_MODEL` | Yes | — | Model name (e.g., `gemini-2.5-flash-lite`, `gemini/gemini-2.5-pro`) |

### Gemini (required if `AI_PROVIDER=gemini`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes* | — | Google Gemini API key |

### LiteLLM (required if `AI_PROVIDER=litellm`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `LITELLM_URL` | Yes* | — | LiteLLM proxy base URL |
| `LITELLM_KEY` | Yes* | — | LiteLLM API key |

All validation is done via Zod at startup. Missing required vars cause an immediate clear error.
