import { Theme } from '../App';

interface ThemeEditorProps {
  theme: Theme;
  mode: 'dark' | 'light';
}

export function ThemeEditor({ theme, mode }: ThemeEditorProps) {
  const colors = theme[mode];

  const colorGroups = [
    {
      name: 'Backgrounds',
      colors: [
        { key: 'background1', label: 'Background 1 (Primary)' },
        { key: 'background2', label: 'Background 2' },
        { key: 'background3', label: 'Background 3' },
        { key: 'background4', label: 'Background 4' },
        { key: 'background5', label: 'Background 5' },
        { key: 'background6', label: 'Background 6' },
      ],
    },
    {
      name: 'Content Backgrounds',
      colors: [
        { key: 'contentBackground1', label: 'Content BG 1' },
        { key: 'contentBackground2', label: 'Content BG 2' },
        { key: 'contentBackground3', label: 'Content BG 3' },
        { key: 'contentBackground4', label: 'Content BG 4' },
        { key: 'contentBackground5', label: 'Content BG 5' },
      ],
    },
    {
      name: 'Text Colors',
      colors: [
        { key: 'textDefault', label: 'Default Text' },
        { key: 'textHelp', label: 'Help Text' },
        { key: 'textInactive', label: 'Inactive Text' },
      ],
    },
    {
      name: 'Brand Primary',
      colors: [
        { key: 'brandPrimary', label: 'Primary' },
        { key: 'brandPrimaryActive', label: 'Primary Active' },
        { key: 'brandPrimaryHover', label: 'Primary Hover' },
        { key: 'brandPrimaryFocused', label: 'Primary Focused' },
        { key: 'brandPrimaryText', label: 'Primary Text' },
      ],
    },
    {
      name: 'Brand Secondary',
      colors: [
        { key: 'brandSecondary', label: 'Secondary' },
        { key: 'brandSecondaryActive', label: 'Secondary Active' },
        { key: 'brandSecondaryHover', label: 'Secondary Hover' },
        { key: 'brandSecondaryFocused', label: 'Secondary Focused' },
        { key: 'brandSecondaryText', label: 'Secondary Text' },
      ],
    },
    {
      name: 'Input Fields',
      colors: [
        { key: 'inputBackground', label: 'Input Background' },
        { key: 'inputColor', label: 'Input Text' },
        { key: 'inputPlaceholder', label: 'Placeholder' },
        { key: 'inputDisabled', label: 'Disabled' },
        { key: 'inputFocused', label: 'Focused State' },
        { key: 'inputBorder', label: 'Border' },
      ],
    },
    {
      name: 'Status Colors',
      colors: [
        { key: 'statusSuccess', label: 'Success' },
        { key: 'statusWarning', label: 'Warning' },
        { key: 'statusCritical', label: 'Critical' },
        { key: 'statusActive', label: 'Active' },
      ],
    },
    {
      name: 'Borders',
      colors: [
        { key: 'borderNeutral', label: 'Neutral Border' },
      ],
    },
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{theme.name} - Color Palette</h2>
        <p className="text-slate-400">{mode === 'dark' ? 'Dark Mode' : 'Light Mode'} Colors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {colorGroups.map((group) => (
          <div key={group.name} className="space-y-3">
            <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wider">
              {group.name}
            </h3>
            <div className="space-y-2">
              {group.colors.map((color) => (
                <div
                  key={color.key}
                  className="flex items-center gap-2 p-2 rounded bg-slate-900/50"
                >
                  <div
                    className="w-10 h-10 rounded border-2 border-slate-600 flex-shrink-0 shadow-inner"
                    style={{ backgroundColor: colors[color.key as keyof typeof colors] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-400 truncate">{color.label}</div>
                    <div className="text-xs font-mono text-slate-300">
                      {colors[color.key as keyof typeof colors]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* JSON Preview */}
      <div className="mt-8">
        <h3 className="font-semibold mb-3 text-slate-300">JSON Export Preview</h3>
        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-slate-300 font-mono">
            {JSON.stringify({ [mode]: colors }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
