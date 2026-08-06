# @emrah.su/mongosh-llm-cli

## 0.3.0

### Minor Changes

- 190231a: Add backend query execution so operators never need a database connection string.

  The CLI now talks to a `QueryExecutor` seam with two implementations. In `local` mode (the default,
  and unchanged behaviour) queries run on your machine via mongosh against `MONGODB_URI`. In the new
  `backend` mode the CLI posts each query to the backend, which holds the connection string and runs
  it there — the credentials never leave the server. The dimmed tool-use display still shows every
  query and its result, marked with a `☁` when it ran remotely.

  - **shared**: `validateQuery` moved here from the CLI so both sides enforce the same read-only
    rules; added `executionMode`, `/execute` and `/connection-info` schemas. `mongodbUri` is now
    optional, required only when `executionMode` is `local`.
  - **backend**: new `/execute`, `/connection-info` and `/schema` routes, mounted only when
    `MONGODB_URI` is set — an LLM-proxy-only deployment exposes no database surface. Every query is
    re-validated server-side; write operations are refused outright unless a separate
    `MONGODB_URI_UNSAFE` read-write connection string is configured. Connection strings are scrubbed
    from error messages.
  - **cli**: `mongosh-llm setup` runs an onboarding wizard that asks a few plain-language questions
    and saves the answers to a per-user config file, so no hand-written `.env` is needed. It runs
    automatically on first use when nothing is configured. In backend mode it never asks for a
    connection string. Configuration now layers CLI flags over env/`.env` over the saved file.

- a0a0aaa: Add a CommonJS build so the CLI can be compiled into a single native executable, and
  support a `MONGOSH_LLM_DEFAULT_BACKEND_URL` build-time variable that pre-fills the backend URL.
  Together these let a team distribute one executable that needs no Node, npm or mongosh installed -
  an operator just pastes an access key.

### Patch Changes

- Updated dependencies [190231a]
  - @emrah.su/mongosh-llm-shared@0.3.0

## 0.2.0

### Minor Changes

- Add optional `BACKEND_API_KEY` support: the CLI's backend client now sends an `X-API-Key` header when this env var is set, so the CLI can talk to a self-hosted backend that enforces `API_KEY`.

### Patch Changes

- Updated dependencies
  - @emrah.su/mongosh-llm-shared@0.2.0
