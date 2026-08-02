import { describe, it, expect } from 'vitest';
import { ConversationHistory } from './conversation.js';

describe('ConversationHistory', () => {
  it('returns messages in insertion order', () => {
    const history = new ConversationHistory();
    history.push({ role: 'user', content: 'a' });
    history.push({ role: 'assistant', content: 'b' });
    expect(history.getAll()).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ]);
  });

  it('bounds history to the configured maximum, dropping the oldest messages', () => {
    const history = new ConversationHistory();
    for (let i = 0; i < 25; i++) {
      history.push({ role: 'user', content: `msg-${i}` });
    }
    const all = history.getAll();
    expect(all).toHaveLength(20);
    expect(all[0]).toEqual({ role: 'user', content: 'msg-5' });
    expect(all.at(-1)).toEqual({ role: 'user', content: 'msg-24' });
  });

  it('clear() empties the history', () => {
    const history = new ConversationHistory();
    history.push({ role: 'user', content: 'a' });
    history.clear();
    expect(history.getAll()).toEqual([]);
  });
});
