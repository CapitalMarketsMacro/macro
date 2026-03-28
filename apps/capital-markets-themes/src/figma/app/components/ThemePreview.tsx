import { Theme } from '../App';
import { TrendingUp, TrendingDown, Activity, BarChart3, DollarSign, Table } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ThemePreviewProps {
  theme: Theme;
  mode: 'dark' | 'light';
}

export function ThemePreview({ theme, mode }: ThemePreviewProps) {
  const colors = theme[mode];

  // Utility to determine if text should be dark or light based on background color
  const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return '#FFFFFF';
    hexcolor = hexcolor.replace('#', '');
    if (hexcolor.length === 3) {
      hexcolor = hexcolor.split('').map(c => c + c).join('');
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl mb-8 border border-slate-700 font-sans">
      <div
        className="p-6"
        style={{
          backgroundColor: colors.background1,
          color: colors.textDefault,
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between p-4 rounded-lg mb-4"
          style={{ backgroundColor: colors.background2 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.statusCritical }}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.statusWarning }}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.statusSuccess }}
              />
            </div>
            <div style={{ color: colors.textHelp }} className="text-sm font-medium">
              OpenFin Workspace • Trading Terminal
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded transition-all"
              style={{
                backgroundColor: colors.brandSecondary,
                color: colors.brandSecondaryText,
              }}
            >
              Settings
            </button>
            <button
              className="px-4 py-2 rounded transition-all"
              style={{
                backgroundColor: colors.brandPrimary,
                color: colors.brandPrimaryText,
              }}
            >
              Execute Trade
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Market Stats */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.contentBackground2 }}
          >
            <div style={{ color: colors.textHelp }} className="text-sm mb-2">
              S&P 500
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-2xl font-bold font-mono">5,247.89</div>
              <div
                className="flex items-center gap-1 text-sm font-mono"
                style={{ color: colors.statusSuccess }}
              >
                <TrendingUp size={16} />
                +1.24%
              </div>
            </div>
            <div style={{ color: colors.textInactive }} className="text-xs font-mono">
              Last updated: 09:30 EST
            </div>
          </div>

          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.contentBackground2 }}
          >
            <div style={{ color: colors.textHelp }} className="text-sm mb-2">
              NASDAQ
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-2xl font-bold font-mono">16,832.52</div>
              <div
                className="flex items-center gap-1 text-sm font-mono"
                style={{ color: colors.statusCritical }}
              >
                <TrendingDown size={16} />
                -0.58%
              </div>
            </div>
            <div style={{ color: colors.textInactive }} className="text-xs font-mono">
              Last updated: 09:30 EST
            </div>
          </div>

          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.contentBackground2 }}
          >
            <div style={{ color: colors.textHelp }} className="text-sm mb-2">
              Portfolio Value
            </div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={20} />
              <div className="text-2xl font-bold font-mono">24.8M</div>
            </div>
            <div style={{ color: colors.textInactive }} className="text-xs font-mono">
              Day P&L: +$142,500
            </div>
          </div>
        </div>

        {/* Order Book / Trading Interface */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Panel */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.contentBackground3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} style={{ color: colors.brandPrimary }} />
              <div className="font-semibold">Order Book</div>
            </div>
            
            <div className="space-y-2">
              {/* Bids */}
              <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: colors.textHelp }}>
                <div>Price</div>
                <div className="text-right">Size</div>
                <div className="text-right">Total</div>
              </div>
              
              {[
                { price: '5247.90', size: '1,250', total: '6.6M', type: 'bid' },
                { price: '5247.85', size: '3,400', total: '17.8M', type: 'bid' },
                { price: '5247.80', size: '2,100', total: '11.0M', type: 'bid' },
                { price: '5247.95', size: '890', total: '4.7M', type: 'ask' },
                { price: '5248.00', size: '2,650', total: '13.9M', type: 'ask' },
                { price: '5248.05', size: '1,780', total: '9.3M', type: 'ask' },
              ].map((order, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 gap-2 text-sm py-1 px-2 rounded font-mono"
                  style={{
                    backgroundColor: colors.background4,
                    color: order.type === 'bid' ? colors.statusSuccess : colors.statusCritical,
                  }}
                >
                  <div>{order.price}</div>
                  <div className="text-right" style={{ color: colors.textDefault }}>
                    {order.size}
                  </div>
                  <div className="text-right" style={{ color: colors.textHelp }}>
                    {order.total}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.contentBackground3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} style={{ color: colors.brandPrimary }} />
              <div className="font-semibold">Quick Trade</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm mb-1 block" style={{ color: colors.textHelp }}>
                  Symbol
                </label>
                <input
                  type="text"
                  placeholder="Enter symbol..."
                  className="w-full px-3 py-2 rounded font-mono uppercase"
                  style={{
                    backgroundColor: colors.inputBackground,
                    color: colors.inputColor,
                    border: `1px solid ${colors.inputBorder}`,
                  }}
                  defaultValue="SPY"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm mb-1 block" style={{ color: colors.textHelp }}>
                    Quantity
                  </label>
                  <input
                    type="text"
                    placeholder="0"
                    className="w-full px-3 py-2 rounded font-mono"
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.inputColor,
                      border: `1px solid ${colors.inputBorder}`,
                    }}
                    defaultValue="100"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block" style={{ color: colors.textHelp }}>
                    Price
                  </label>
                  <input
                    type="text"
                    placeholder="Market"
                    className="w-full px-3 py-2 rounded font-mono"
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.inputColor,
                      border: `1px solid ${colors.inputBorder}`,
                    }}
                    defaultValue="524.79"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="flex-1 py-2 rounded font-medium transition-all"
                  style={{
                    backgroundColor: colors.statusSuccess,
                    color: getContrastColor(colors.statusSuccess),
                  }}
                >
                  Buy
                </button>
                <button
                  className="flex-1 py-2 rounded font-medium transition-all"
                  style={{
                    backgroundColor: colors.statusCritical,
                    color: getContrastColor(colors.statusCritical),
                  }}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Treasury Bonds Grid */}
        <div 
          className="mt-4 p-4 rounded-lg flex flex-col gap-3"
          style={{ backgroundColor: colors.contentBackground3 }}
        >
          <div className="flex items-center gap-2">
            <Table size={18} style={{ color: colors.brandPrimary }} />
            <div className="font-semibold">On The Run Treasuries</div>
          </div>
          
          <div className="w-full" style={{ height: '240px' }}>
            <AgGridReact
              theme={themeQuartz.withParams({
                browserColorScheme: mode,
                backgroundColor: colors.background1,
                foregroundColor: colors.textDefault,
                headerBackgroundColor: colors.background2,
                headerTextColor: colors.textHelp,
                borderColor: colors.borderNeutral,
                rowBorder: { color: colors.borderNeutral },
                rowHoverColor: colors.background4,
                selectedRowBackgroundColor: colors.brandSecondaryHover,
                oddRowBackgroundColor: colors.background2,
                fontFamily: 'inherit',
              })}
              rowData={[
                { ticker: "US 2Y", coupon: "4.250", maturity: "02/15/2026", price: "99-24+", yield: "4.305%", change: "+1.2 bps", trend: 'up' },
                { ticker: "US 5Y", coupon: "4.000", maturity: "02/28/2029", price: "100-08", yield: "3.955%", change: "+0.8 bps", trend: 'up' },
                { ticker: "US 10Y", coupon: "3.875", maturity: "02/15/2034", price: "98-16+", yield: "4.055%", change: "-1.5 bps", trend: 'down' },
                { ticker: "US 30Y", coupon: "4.125", maturity: "02/15/2054", price: "95-28", yield: "4.382%", change: "-2.1 bps", trend: 'down' },
              ]}
              columnDefs={[
                { field: "ticker", headerName: "Ticker", flex: 1, cellStyle: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 'bold' } },
                { field: "coupon", headerName: "Cpn", width: 90, cellStyle: { fontFamily: "'IBM Plex Mono', monospace" } },
                { field: "maturity", headerName: "Maturity", width: 120 },
                { field: "price", headerName: "Price", width: 110, cellStyle: { fontFamily: "'IBM Plex Mono', monospace" } },
                { field: "yield", headerName: "Yield", width: 100, cellStyle: { fontFamily: "'IBM Plex Mono', monospace" } },
                { 
                  field: "change", 
                  headerName: "Chg", 
                  width: 100, 
                  cellStyle: (params) => ({ 
                    fontFamily: "'IBM Plex Mono', monospace", 
                    color: params.data?.trend === 'up' ? colors.statusCritical : colors.statusSuccess // Yield up = price down = critical (red) for bonds
                  }) 
                },
              ]}
              defaultColDef={{
                sortable: true,
                resizable: true,
              }}
              rowHeight={36}
              headerHeight={40}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div
          className="flex items-center justify-between p-3 rounded-lg mt-4 text-sm"
          style={{
            backgroundColor: colors.background5,
            color: colors.textHelp,
          }}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.statusActive }}
              />
              <span>Connected</span>
            </div>
            <div>Market: Open</div>
            <div>Latency: 12ms</div>
          </div>
          <div style={{ color: colors.textInactive }}>
            OpenFin Workspace v18.0 • {theme.name} Theme
          </div>
        </div>
      </div>
    </div>
  );
}
