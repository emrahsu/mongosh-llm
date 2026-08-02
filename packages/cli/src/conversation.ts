import { MAX_HISTORY_MESSAGES, type ConversationMessage } from '@emrahsu/mongosh-llm-shared';

/** Bounded conversation history; keeps only the most recent messages within the configured limit. */
export class ConversationHistory {
  private messages: ConversationMessage[] = [];

  getAll(): ConversationMessage[] {
    return [...this.messages];
  }

  push(...newMessages: ConversationMessage[]): void {
    this.messages.push(...newMessages);
    if (this.messages.length > MAX_HISTORY_MESSAGES) {
      this.messages = this.messages.slice(-MAX_HISTORY_MESSAGES);
    }
  }

  clear(): void {
    this.messages = [];
  }
}
