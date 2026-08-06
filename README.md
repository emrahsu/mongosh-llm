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
- **Nobody needs the credentials**: point the CLI at a backend and queries run
  *there*, so your team can ask questions without ever holding a connection
  string or installing mongosh

## Quick start

```
npm install -g @emrah.su/mongosh-llm-cli
mongosh-llm
```

The first run asks a few questions and saves your answers, so there's no file
to write by hand. Run `mongosh-llm setup` any time to change them.

For the two local modes you also need
[mongosh](https://www.mongodb.com/try/download/shell) installed and a MongoDB
connection string. Working from a clone instead:

```
npm install
npm run build
npm run dev:cli
```

## Configuration

`mongosh-llm setup` is the easy path - it writes a config file in your user
profile (`%APPDATA%\mongosh-llm\` on Windows, `~/.config/mongosh-llm/`
elsewhere) that works from any directory.

To configure by hand or in CI, copy [.env.example](.env.example) to `.env`.
Environment variables take precedence over the saved file, so you can override
a single setting per-invocation.

Pick **one** way to reach an LLM:

- `ANTHROPIC_API_KEY` - call Anthropic directly with your own key
- `BACKEND_URL` (+ `BACKEND_API_KEY`) - point at a self-hosted backend (see `packages/backend`)
- `OLLAMA_BASE_URL` + `OLLAMA_MODEL` - run fully locally, no API key at all

`LLM_PROVIDER` can force a specific one explicitly if you have more than one configured.

### Where queries run

`EXECUTION_MODE` decides who talks to MongoDB:

| Mode | Queries run | Needs `MONGODB_URI` | Needs local mongosh |
|---|---|---|---|
| `local` (default) | on your machine | yes | yes |
| `backend` | on the backend | no | no |

`backend` mode is for teams: the backend holds the connection string and runs
each query itself, so the credentials never leave the server and nothing needs
installing beyond the CLI. Queries are still shown as they run, marked with a
`☁` to make clear they left your machine. Set `MONGODB_URI` on the *backend*
to enable it - see [packages/backend](packages/backend).

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
