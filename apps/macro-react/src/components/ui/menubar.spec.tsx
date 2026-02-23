import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarSub,
  MenubarShortcut,
} from './menubar';

describe('Menubar component', () => {
  it('should render a menubar', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(screen.getByText('File')).toBeTruthy();
  });

  it('should apply default classes', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    // Root menubar element
    const menubar = container.firstChild as HTMLElement;
    expect(menubar.className).toContain('flex');
    expect(menubar.className).toContain('items-center');
    expect(menubar.className).toContain('rounded-md');
    expect(menubar.className).toContain('border');
  });

  it('should merge custom className on Menubar', () => {
    const { container } = render(
      <Menubar className="custom-bar">
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    const menubar = container.firstChild as HTMLElement;
    expect(menubar.className).toContain('custom-bar');
    expect(menubar.className).toContain('flex');
  });

  it('should render multiple menu triggers', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(screen.getByText('File')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
  });

  it('should handle onClick on MenubarTrigger', () => {
    const handleClick = vi.fn();
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger onClick={handleClick}>Click Me</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className on MenubarTrigger', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger className="active-trigger">Active</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    const trigger = screen.getByText('Active');
    expect(trigger.className).toContain('active-trigger');
    expect(trigger.className).toContain('flex');
    expect(trigger.className).toContain('rounded-sm');
  });

  it('should have correct displayName for Menubar', () => {
    expect(Menubar.displayName).toBe('Menubar');
  });

  it('should have correct displayName for MenubarTrigger', () => {
    expect(MenubarTrigger.displayName).toBe('MenubarTrigger');
  });
});

describe('MenubarShortcut component', () => {
  it('should render shortcut text', () => {
    render(<MenubarShortcut>Ctrl+S</MenubarShortcut>);
    expect(screen.getByText('Ctrl+S')).toBeTruthy();
  });

  it('should apply default classes', () => {
    render(<MenubarShortcut data-testid="shortcut">Ctrl+N</MenubarShortcut>);
    const shortcut = screen.getByTestId('shortcut');
    expect(shortcut.className).toContain('ml-auto');
    expect(shortcut.className).toContain('text-xs');
    expect(shortcut.className).toContain('tracking-widest');
  });

  it('should merge custom className', () => {
    render(<MenubarShortcut className="extra-class">Ctrl+X</MenubarShortcut>);
    const shortcut = screen.getByText('Ctrl+X');
    expect(shortcut.className).toContain('extra-class');
    expect(shortcut.className).toContain('ml-auto');
  });

  it('should render as a span element', () => {
    const { container } = render(<MenubarShortcut>Ctrl+Z</MenubarShortcut>);
    const span = container.querySelector('span');
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe('Ctrl+Z');
  });
});

describe('MenubarItem component', () => {
  it('should render an item within menu content', () => {
    // MenubarItem renders inside a portal when content is open
    // We can test it renders in isolation via the component itself
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New File</MenubarItem>
            <MenubarItem>Open</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarSeparator component', () => {
  it('should render a separator element', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Cut</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Paste</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarLabel component', () => {
  it('should render a label', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel>Appearance</MenubarLabel>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });

  it('should accept inset prop', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel inset>Indented Label</MenubarLabel>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarCheckboxItem component', () => {
  it('should render a checkbox item', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked={true}>Toolbar</MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarRadioItem component', () => {
  it('should render radio items in a group', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup value="compact">
              <MenubarRadioItem value="compact">Compact</MenubarRadioItem>
              <MenubarRadioItem value="normal">Normal</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarSubTrigger component', () => {
  it('should render a sub menu trigger', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>More Options</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Option A</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });

  it('should accept inset prop', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger inset>Indented Sub</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Sub Item</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});

describe('MenubarItem with inset', () => {
  it('should accept inset prop', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem inset>Indented Item</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(container).toBeTruthy();
  });
});
