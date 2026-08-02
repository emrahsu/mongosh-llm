# mongosh-llm

Query MongoDB in plain English, powered by Claude. Ask questions like *"show
me the 5 most recent orders"* and get back a real mongosh command, executed
for you.

> **Status**: early rewrite in progress. This is a clean, open-source
> rebuild of a previously internal tool - see `packages/` for current
> progress.

## Why

- **Bring your own key**: point the CLI at Anthropic directly with your own
  `ANTHROPIC_API_KEY`, or
- **Self-host**: run the optional backend on your own infrastructure and
  point the CLI at it instead.
- **Safe by default**: read-only query mode is on unless you explicitly opt
  into unsafe mode.

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

Requires Node.js 22+ and npm.

```
npm install
npm run build
npm test
```

## License

MIT - see [LICENSE](LICENSE).
