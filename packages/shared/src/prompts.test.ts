import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './prompts.js';

describe('buildSystemPrompt', () => {
  it('includes read-only constraints and forbids writes in safe mode', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe' });
    expect(prompt).toContain('READ ONLY MODE');
    expect(prompt).not.toContain('UNSAFE MODE');
  });

  it('permits write operations in unsafe mode', () => {
    const prompt = buildSystemPrompt({ queryMode: 'unsafe' });
    expect(prompt).toContain('UNSAFE MODE');
  });

  it('embeds the provided schema summary', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe', schema: 'Users: { name, email }' });
    expect(prompt).toContain('Users: { name, email }');
  });

  it('omits the schema section when none is provided', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe' });
    expect(prompt).not.toContain('Database Schema:');
  });
});
