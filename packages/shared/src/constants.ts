/** Maximum number of tool-use round trips allowed per user query before forcing a final answer. */
export const MAX_TOOL_CALLS_PER_QUERY = 10;

/** How long a schema-inspection tool result stays cached before being re-fetched, in minutes. */
export const TOOL_CACHE_TTL_MINUTES = 5;

/** Maximum documents a tool-use query may return, keeping context small and fast. */
export const TOOL_RESULT_MAX_DOCS = 1000;

/** Maximum conversation messages retained; older ones are pruned to control token usage. */
export const MAX_HISTORY_MESSAGES = 20;

/** Default max_tokens for a Claude response. */
export const DEFAULT_MAX_TOKENS = 2000;

/** Low temperature keeps generated database commands deterministic. */
export const DEFAULT_TEMPERATURE = 0.1;

/** Override via the ANTHROPIC_MODEL env var if Anthropic renames/retires this model id. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

/** Ollama's default local server address. */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/** One of Ollama's originally-documented tool-calling-capable models. */
export const DEFAULT_OLLAMA_MODEL = 'mistral-nemo';
