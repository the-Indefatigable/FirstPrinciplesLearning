import { describe, it, expect } from 'vitest';
import { allTools, getBySlug, getByCategory, toolLoaders } from './tools';

describe('tools config', () => {
  it('has at least 50 tools', () => {
    expect(allTools.length).toBeGreaterThanOrEqual(50);
  });

  it('every tool has required fields', () => {
    for (const tool of allTools) {
      expect(tool.slug).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(['math', 'physics', 'cs']).toContain(tool.category);
    }
  });

  it('slugs are unique', () => {
    const slugs = allTools.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every tool has a matching loader', () => {
    for (const tool of allTools) {
      expect(toolLoaders[tool.slug]).toBeDefined();
    }
  });

  it('getBySlug returns correct tool', () => {
    const tool = getBySlug('unit-circle');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('Unit Circle');
    expect(tool!.category).toBe('math');
  });

  it('getBySlug returns undefined for unknown slug', () => {
    expect(getBySlug('does-not-exist')).toBeUndefined();
  });

  it('getByCategory filters correctly', () => {
    const mathTools = getByCategory('math');
    expect(mathTools.length).toBeGreaterThan(0);
    expect(mathTools.every(t => t.category === 'math')).toBe(true);

    const physicsTools = getByCategory('physics');
    expect(physicsTools.every(t => t.category === 'physics')).toBe(true);

    const csTools = getByCategory('cs');
    expect(csTools.every(t => t.category === 'cs')).toBe(true);
  });

  it('all three categories have tools', () => {
    expect(getByCategory('math').length).toBeGreaterThan(0);
    expect(getByCategory('physics').length).toBeGreaterThan(0);
    expect(getByCategory('cs').length).toBeGreaterThan(0);
  });
});
