import type Anthropic from '@anthropic-ai/sdk';
import type { ContentBlock, Message, Tool } from '@aws-sdk/client-bedrock-runtime';
import type { DocumentType } from '@smithy/types';
import type { ConversationMessage } from '@emrah.su/mongosh-llm-shared';

/** Converts our Anthropic-shaped tool definition into Bedrock's Converse toolSpec format. */
export function toBedrockTool(tool: Anthropic.Tool): Tool {
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: { json: tool.input_schema as DocumentType },
    },
  };
}

/** Converts our Anthropic-shaped conversation into Bedrock Converse's message list. */
export function toBedrockMessages(messages: ConversationMessage[]): Message[] {
  return messages.map((message) => ({
    role: message.role,
    content: toBedrockContentBlocks(message.content),
  }));
}

function toBedrockContentBlocks(content: ConversationMessage['content']): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  const blocks: ContentBlock[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      blocks.push({ text: block.text });
    } else if (block.type === 'tool_use') {
      blocks.push({ toolUse: { toolUseId: block.id, name: block.name, input: block.input as DocumentType } });
    } else if (block.type === 'tool_result') {
      blocks.push({
        toolResult: {
          toolUseId: block.tool_use_id,
          content:
            typeof block.content === 'string'
              ? [{ text: block.content }]
              : [{ json: block.content as unknown as DocumentType }],
          ...(block.is_error ? { status: 'error' } : {}),
        },
      });
    }
  }
  return blocks;
}

/** Converts Bedrock Converse's output message back into Anthropic-shaped content blocks. */
export function fromBedrockMessage(message?: Message): Anthropic.ContentBlock[] {
  const blocks: Anthropic.ContentBlock[] = [];

  for (const block of message?.content ?? []) {
    if (block.text) {
      blocks.push({ type: 'text', text: block.text, citations: [] } as unknown as Anthropic.ContentBlock);
    } else if (block.toolUse) {
      blocks.push({
        type: 'tool_use',
        id: block.toolUse.toolUseId ?? `bedrock-tool-${Date.now()}`,
        name: block.toolUse.name ?? '',
        input: block.toolUse.input ?? {},
      } as unknown as Anthropic.ContentBlock);
    }
  }

  return blocks;
}
