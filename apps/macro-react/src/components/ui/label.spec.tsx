import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label component', () => {
  it('should render with text content', () => {
    render(<Label>Test Label</Label>);
    expect(screen.getByText('Test Label')).toBeTruthy();
  });

  it('should render as a label element', () => {
    const { container } = render(<Label>Text</Label>);
    const label = container.querySelector('label');
    expect(label).toBeTruthy();
  });

  it('should apply default variant classes', () => {
    const { container } = render(<Label>Text</Label>);
    const label = container.querySelector('label');
    expect(label?.className).toContain('text-sm');
    expect(label?.className).toContain('font-medium');
    expect(label?.className).toContain('leading-none');
  });

  it('should merge custom className', () => {
    const { container } = render(<Label className="custom-class">Text</Label>);
    const label = container.querySelector('label');
    expect(label?.className).toContain('custom-class');
    expect(label?.className).toContain('text-sm');
  });

  it('should forward the htmlFor prop', () => {
    const { container } = render(<Label htmlFor="my-input">Text</Label>);
    const label = container.querySelector('label');
    expect(label?.getAttribute('for')).toBe('my-input');
  });

  it('should forward ref', () => {
    let labelRef: HTMLLabelElement | null = null;
    render(
      <Label ref={(el) => { labelRef = el; }}>Text</Label>
    );
    expect(labelRef).toBeTruthy();
    expect(labelRef?.tagName).toBe('LABEL');
  });

  it('should pass through additional props', () => {
    render(<Label data-testid="custom-label" id="label-1">Text</Label>);
    const label = screen.getByTestId('custom-label');
    expect(label.id).toBe('label-1');
  });

  it('should have the correct displayName', () => {
    expect(Label.displayName).toBe('Label');
  });
});
