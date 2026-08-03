# @emrah.su/mongosh-llm-backend

## 0.2.0

### Minor Changes

- Add AWS Bedrock as an LLM provider option for the self-hosted backend, alongside direct Anthropic API access. Set `LLM_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, and `AWS_REGION` to route requests through Bedrock's Converse API instead of an Anthropic API key.
