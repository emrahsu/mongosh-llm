# @emrah.su/mongosh-llm-cli

## 0.2.0

### Minor Changes

- Add optional `BACKEND_API_KEY` support: the CLI's backend client now sends an `X-API-Key` header when this env var is set, so the CLI can talk to a self-hosted backend that enforces `API_KEY`.

### Patch Changes

- Updated dependencies
  - @emrah.su/mongosh-llm-shared@0.2.0
