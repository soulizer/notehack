import { describe, expect, it } from 'vitest';
import { mergeText } from './merge';

describe('three-way merge', () => {
  it('merges non-overlapping edits', () => {
    const base = 'alpha\nbeta\ngamma';
    const local = 'alpha local\nbeta\ngamma';
    const remote = 'alpha\nbeta\ngamma remote';
    expect(mergeText(local, base, remote)).toBe('alpha local\nbeta\ngamma remote');
  });

  it('returns one side when the other is unchanged', () => {
    expect(mergeText('a\nb', 'a\nb', 'a\nb remote')).toBe('a\nb remote');
    expect(mergeText('a local\nb', 'a\nb', 'a\nb')).toBe('a local\nb');
  });

  it('refuses overlapping conflicting edits', () => {
    const base = 'line\nsame';
    expect(mergeText('line local\nsame', base, 'line remote\nsame')).toBeNull();
  });
});
