import { describe, it, expect } from 'vitest';
import { slugify, readingTime } from './blog';

describe('slugify', () => {
    it('converts title to slug', () => {
        expect(slugify('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
        expect(slugify('What is F=ma?')).toBe('what-is-f-ma');
    });

    it('trims leading/trailing hyphens', () => {
        expect(slugify('--hello--')).toBe('hello');
    });

    it('handles empty string', () => {
        expect(slugify('')).toBe('');
    });

    it('collapses consecutive special chars', () => {
        expect(slugify('foo   bar---baz')).toBe('foo-bar-baz');
    });
});

describe('readingTime', () => {
    it('returns 1 min for short content', () => {
        expect(readingTime('hello world')).toBe('1 min read');
    });

    it('calculates correctly for longer content', () => {
        const words = Array(400).fill('word').join(' ');
        expect(readingTime(words)).toBe('2 min read');
    });

    it('returns 1 min for empty content', () => {
        expect(readingTime('')).toBe('1 min read');
    });
});
