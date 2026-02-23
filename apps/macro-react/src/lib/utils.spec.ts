import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should return empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should pass through a single class', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('should merge multiple classes', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
  });

  it('should merge Tailwind classes and resolve conflicts', () => {
    // twMerge should keep the last conflicting class
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('should handle conditional classes (clsx behavior)', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toBe('base visible');
  });

  it('should handle undefined and null inputs', () => {
    const result = cn('base', undefined, null, 'end');
    expect(result).toBe('base end');
  });

  it('should handle object syntax from clsx', () => {
    const result = cn('base', { 'text-red-500': true, 'text-blue-500': false });
    expect(result).toBe('base text-red-500');
  });

  it('should handle array syntax from clsx', () => {
    const result = cn(['text-red-500', 'bg-blue-500']);
    expect(result).toBe('text-red-500 bg-blue-500');
  });

  it('should resolve padding conflicts', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('should resolve margin conflicts', () => {
    const result = cn('m-4', 'mx-2');
    expect(result).toBe('m-4 mx-2');
  });

  it('should handle empty string inputs', () => {
    const result = cn('', 'text-red-500', '');
    expect(result).toBe('text-red-500');
  });

  it('should resolve flex direction conflicts', () => {
    const result = cn('flex-row', 'flex-col');
    expect(result).toBe('flex-col');
  });
});
