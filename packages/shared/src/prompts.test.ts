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

  it('tells the model which database it is actually connected to when known', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe', currentDatabase: 'sample_mflix' });
    expect(prompt).toContain('sample_mflix');
  });

  it('never uses the misleading "MyDatabase" placeholder that models used to copy literally', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe' });
    expect(prompt).not.toContain('MyDatabase');
  });

  it('teaches the correct command for listing all databases on the server', () => {
    const prompt = buildSystemPrompt({ queryMode: 'safe' });
    expect(prompt).toContain('db.getMongo().getDBNames()');
  });
});
