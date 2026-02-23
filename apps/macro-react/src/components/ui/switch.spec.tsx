import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './switch';

describe('Switch component', () => {
  it('should render a switch element', () => {
    render(<Switch />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeTruthy();
  });

  it('should be unchecked by default', () => {
    render(<Switch />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('data-state')).toBe('unchecked');
  });

  it('should be checked when checked prop is true', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('data-state')).toBe('checked');
  });

  it('should call onCheckedChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch onCheckedChange={handleChange} />);
    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should apply default styling classes', () => {
    render(<Switch />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.className).toContain('inline-flex');
    expect(switchEl.className).toContain('cursor-pointer');
    expect(switchEl.className).toContain('rounded-full');
  });

  it('should merge custom className', () => {
    render(<Switch className="my-custom-switch" />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.className).toContain('my-custom-switch');
    expect(switchEl.className).toContain('inline-flex');
  });

  it('should render the thumb element', () => {
    const { container } = render(<Switch />);
    const thumb = container.querySelector('span[data-state]');
    expect(thumb).toBeTruthy();
    expect(thumb?.className).toContain('rounded-full');
    expect(thumb?.className).toContain('bg-background');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Switch disabled />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('data-disabled')).toBeDefined();
  });

  it('should not call onCheckedChange when disabled', () => {
    const handleChange = vi.fn();
    render(<Switch disabled onCheckedChange={handleChange} />);
    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should forward ref', () => {
    let switchRef: HTMLButtonElement | null = null;
    render(<Switch ref={(el) => { switchRef = el; }} />);
    expect(switchRef).toBeTruthy();
    expect(switchRef?.tagName).toBe('BUTTON');
  });

  it('should have the correct displayName', () => {
    expect(Switch.displayName).toBe('Switch');
  });

  it('should support id prop', () => {
    render(<Switch id="test-switch" />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.id).toBe('test-switch');
  });
});
