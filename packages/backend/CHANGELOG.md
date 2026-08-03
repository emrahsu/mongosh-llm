# @emrah.su/mongosh-llm-backend

## 0.2.2

### Patch Changes

- Updated dependencies
  - @emrah.su/mongosh-llm-shared@0.2.0

## 0.2.1

### Patch Changes

- Fix Bedrock provider: remove the `temperature` inferenceConfig field, which newer Claude models (e.g. sonnet-5) reject as deprecated, causing every Bedrock request to fail.

## 0.2.0

### Minor Changes

- Add AWS Bedrock as an LLM provider option for the self-hosted backend, alongside direct Anthropic API access. Set `LLM_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, and `AWS_REGION` to route requests through Bedrock's Converse API instead of an Anthropic API key.
