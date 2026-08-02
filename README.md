# mongosh-llm

[![CI](https://github.com/emrahsu/mongosh-llm/actions/workflows/ci.yml/badge.svg)](https://github.com/emrahsu/mongosh-llm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Query MongoDB in plain English. Ask questions like *"show me the 5 most
recent orders"* and get back a real mongosh command, executed for you.

## Why

- **Three ways to run it**: bring your own `ANTHROPIC_API_KEY`, self-host the
  optional backend for your team, or run a fully local/private model via
  [Ollama](https://ollama.com) - no cloud API key needed
- **Tool-use powered**: inspects your real schema before generating a query,
  not guessing from thin air
- **Safe by default**: read-only query mode is on unless you explicitly opt
  into unsafe mode (which then asks for confirmation before every write)

## Quick start

Requires Node.js 22+, npm, and [mongosh](https://www.mongodb.com/try/download/shell) installed.

```
npm install
npm run build
cp .env.example .env   # then edit .env - see Configuration below
npm run dev:cli
```

## Configuration

Copy [.env.example](.env.example) to `.env` and set `MONGODB_URI` plus **one** of:

- `ANTHROPIC_API_KEY` - call Anthropic directly with your own key
- `BACKEND_URL` - point at a self-hosted backend (see `packages/backend`)
- `OLLAMA_BASE_URL` + `OLLAMA_MODEL` - run fully locally, no API key at all

`LLM_PROVIDER` can force a specific one explicitly if you have more than one configured.

## Project layout

```
packages/
  cli/       Command-line tool (this is what you run)
  backend/   Optional self-hostable API (Express) for teams
  shared/    Types, system prompt, and tool definitions shared by both
docker/      Local MongoDB + sample datasets for trying it out
```

## Local MongoDB for development

```
cd docker
docker compose up -d
```

See [docker/README.md](docker/README.md) for details, including the sample
datasets that get loaded automatically.

## Development

```
npm install
npm run dev:cli       # run the CLI directly from source (no build step)
npm run dev:backend   # run the backend directly from source
npm run build
npm test
```

## License

MIT - see [LICENSE](LICENSE).
