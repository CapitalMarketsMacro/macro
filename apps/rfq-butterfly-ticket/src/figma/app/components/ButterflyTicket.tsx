import { X } from 'lucide-react';
import { Theme } from '../themes';

interface ButterflyTicketProps {
  theme: Theme;
}

export function ButterflyTicket({ theme }: ButterflyTicketProps) {
  return (
    <div 
      className="w-[960px] font-sans text-sm shadow-2xl transition-colors duration-300"
      style={{ 
        backgroundColor: theme.background3,
        color: theme.textDefault 
      }}
    >
      {/* Header */}
      <div 
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ backgroundColor: theme.background4 }}
      >
        <span className="font-semibold">RFQTickets</span>
        <button 
          className="p-1 rounded transition-colors"
          style={{ color: theme.textDefault }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.brandSecondaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Trade Type & Notional */}
      <div 
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ backgroundColor: theme.background4 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs">Manual</span>
          <div 
            className="px-3 py-1 font-bold text-xs"
            style={{ 
              backgroundColor: theme.statusSuccess, 
              color: theme.brandPrimaryText 
            }}
          >
            1 MM 2Y
          </div>
          <div 
            className="px-3 py-1 font-bold text-xs"
            style={{ 
              backgroundColor: theme.statusSuccess, 
              color: theme.brandPrimaryText 
            }}
          >
            -2 MM 10Y
          </div>
          <div 
            className="px-3 py-1 font-bold text-xs"
            style={{ 
              backgroundColor: theme.statusSuccess, 
              color: theme.brandPrimaryText 
            }}
          >
            1 MM 30Y
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 py-2">
        {/* Bid Section */}
        <div className="mb-1">
          <div 
            className="px-2 py-1 font-bold inline-block mb-2"
            style={{ 
              backgroundColor: theme.brandPrimary, 
              color: theme.brandPrimaryText 
            }}
          >
            Bid
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">Firm: DV TRADING, LLC</span>
            <div className="flex gap-2">
              <button 
                className="px-2 py-0.5 text-xs rounded border transition-colors"
                style={{ 
                  backgroundColor: theme.brandSecondary,
                  borderColor: theme.borderNeutral,
                  color: theme.brandSecondaryText 
                }}
              >
                Free$
              </button>
              <button 
                className="px-2 py-0.5 text-xs rounded border transition-colors"
                style={{ 
                  backgroundColor: theme.brandSecondary,
                  borderColor: theme.borderNeutral,
                  color: theme.brandSecondaryText 
                }}
              >
                L2
              </button>
              <button 
                className="px-2 py-0.5 text-xs rounded transition-colors"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                Manual
              </button>
              <button 
                className="px-2 py-0.5 text-xs rounded transition-colors"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                TW
              </button>
            </div>
          </div>
        </div>

        {/* Three Legs Grid */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {/* Leg 1 - 2Y (Front Wing) */}
          <div 
            className="p-2 rounded border transition-colors"
            style={{ 
              backgroundColor: theme.brandPrimary + '40',
              borderColor: theme.borderNeutral 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                WING
              </span>
              <span className="font-bold text-base">2Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>TW Mid:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Spread:</span>
                <span style={{ color: theme.brandPrimary }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote ECN:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Yield:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Broker Px:</span>
                <span style={{ color: theme.statusWarning }}>99-262 / 99-263</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>DV01:</span>
                <span style={{ color: theme.brandPrimary }}>1.94</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Position:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Global Pos:</span>
                <span>758 MM</span>
              </div>
            </div>
          </div>

          {/* Leg 2 - 10Y (Belly - SELL) */}
          <div 
            className="p-2 rounded border-2 shadow-lg transition-colors"
            style={{ 
              background: `linear-gradient(to bottom, ${theme.statusCritical}, ${theme.statusCritical}dd)`,
              borderColor: theme.statusCritical 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded font-bold"
                style={{ 
                  backgroundColor: '#FFFFFF40',
                  color: '#FFFFFF',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#FFFFFF'
                }}
              >
                BELLY
              </span>
              <span className="font-bold text-base" style={{ color: '#FFFFFF' }}>10Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.background4,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>TW Mid:</span>
                <span style={{ color: '#FFFFFF' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold" style={{ color: '#FFFFFF' }}>Spread:</span>
                <span style={{ color: '#00E5FF' }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Quote:</span>
                <span style={{ color: '#FFFFFF' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Quote ECN:</span>
                <span style={{ color: '#FFFFFF' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Yield:</span>
                <span style={{ color: '#FFFFFF' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Broker Px:</span>
                <span style={{ color: '#FFD600' }}>104-128 / 104-130</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>DV01:</span>
                <span style={{ color: '#00E5FF' }}>8.52</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Position:</span>
                <span style={{ color: '#FFFFFF' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#FFFFFF' }}>Global Pos:</span>
                <span style={{ color: '#FFFFFF' }}>-182 MM</span>
              </div>
            </div>
          </div>

          {/* Leg 3 - 30Y (Back Wing) */}
          <div 
            className="p-2 rounded border transition-colors"
            style={{ 
              backgroundColor: theme.brandPrimary + '40',
              borderColor: theme.borderNeutral 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                WING
              </span>
              <span className="font-bold text-base">30Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>TW Mid:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Spread:</span>
                <span style={{ color: theme.brandPrimary }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote ECN:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Yield:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Broker Px:</span>
                <span style={{ color: theme.statusWarning }}>97-044 / 97-053</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>DV01:</span>
                <span style={{ color: theme.brandPrimary }}>1.94</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Position:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Global Pos:</span>
                <span>24 MM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Butterfly Metrics */}
        <div 
          className="p-2 rounded border mb-2 transition-colors"
          style={{ 
            backgroundColor: theme.background4,
            borderColor: theme.borderNeutral 
          }}
        >
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <span style={{ color: theme.textHelp }}>Butterfly:</span>
              <span className="ml-2 font-semibold" style={{ color: theme.brandPrimary }}>0-000</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Net DV01:</span>
              <span className="ml-2 font-semibold" style={{ color: theme.brandPrimary }}>+9.89</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Sales Credit:</span>
              <span className="ml-2">0.0</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Skew:</span>
              <span className="ml-2">Neutral</span>
            </div>
          </div>
        </div>

        {/* Settlement */}
        <div className="mb-2 text-xs">
          <span style={{ color: theme.textHelp }}>Standard Settle:</span>
          <span className="ml-2">3/31/2026</span>
        </div>

        {/* Quote Controls */}
        <div 
          className="flex items-center justify-between mb-2 py-2 px-3 rounded transition-colors"
          style={{ backgroundColor: theme.background4 }}
        >
          <span className="font-semibold">Quote Y/S:</span>
          <div className="flex items-center gap-2">
            <button 
              className="w-8 h-8 rounded flex items-center justify-center font-bold transition-colors"
              style={{ 
                backgroundColor: theme.brandSecondary,
                color: theme.brandSecondaryText 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.brandSecondaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.brandSecondary;
              }}
            >
              +
            </button>
            <div 
              className="w-24 h-8 border flex items-center justify-center transition-colors"
              style={{ 
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder 
              }}
            >
              <span style={{ color: theme.textInactive }}>-</span>
            </div>
            <button 
              className="w-8 h-8 rounded flex items-center justify-center font-bold transition-colors"
              style={{ 
                backgroundColor: theme.brandSecondary,
                color: theme.brandSecondaryText 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.brandSecondaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.brandSecondary;
              }}
            >
              -
            </button>
          </div>
          <span className="font-semibold">WF Y/S:</span>
        </div>

        {/* Offer Section */}
        <div 
          className="px-2 py-1 font-bold inline-block mb-2"
          style={{ 
            backgroundColor: theme.statusCritical, 
            color: theme.brandPrimaryText 
          }}
        >
          Offer
        </div>

        {/* Three Legs Grid - Offer */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {/* Leg 1 - 2Y Offer (Front Wing) */}
          <div 
            className="p-2 rounded border transition-colors"
            style={{ 
              backgroundColor: theme.statusCritical + '40',
              borderColor: theme.borderNeutral 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                WING
              </span>
              <span className="font-bold text-base">2Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>TW Mid:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Spread:</span>
                <span style={{ color: theme.brandPrimary }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote ECN:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Yield:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Broker Px:</span>
                <span style={{ color: theme.statusWarning }}>99-262 / 99-263</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>DV01:</span>
                <span style={{ color: theme.brandPrimary }}>1.94</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Position:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Global Pos:</span>
                <span>758 MM</span>
              </div>
            </div>
          </div>

          {/* Leg 2 - 10Y Offer (Belly - BUY) */}
          <div 
            className="p-2 rounded border-2 shadow-lg transition-colors"
            style={{ 
              background: `linear-gradient(to bottom, ${theme.statusSuccess}, ${theme.statusSuccess}dd)`,
              borderColor: theme.statusSuccess 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded font-bold"
                style={{ 
                  backgroundColor: '#00000040',
                  color: '#000000',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#000000'
                }}
              >
                BELLY
              </span>
              <span className="font-bold text-base" style={{ color: '#000000' }}>10Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.background4,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>TW Mid:</span>
                <span style={{ color: '#000000' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold" style={{ color: '#000000' }}>Spread:</span>
                <span style={{ color: '#0055FF', fontWeight: 'bold' }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Quote:</span>
                <span style={{ color: '#000000' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Quote ECN:</span>
                <span style={{ color: '#000000' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Yield:</span>
                <span style={{ color: '#000000' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Broker Px:</span>
                <span style={{ color: '#FF6600', fontWeight: 'bold' }}>104-128 / 104-130</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>DV01:</span>
                <span style={{ color: '#0055FF', fontWeight: 'bold' }}>8.52</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Position:</span>
                <span style={{ color: '#000000' }}>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#000000' }}>Global Pos:</span>
                <span style={{ color: '#000000' }}>-182 MM</span>
              </div>
            </div>
          </div>

          {/* Leg 3 - 30Y Offer (Back Wing) */}
          <div 
            className="p-2 rounded border transition-colors"
            style={{ 
              backgroundColor: theme.statusCritical + '40',
              borderColor: theme.borderNeutral 
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: theme.background5,
                  color: theme.textDefault 
                }}
              >
                WING
              </span>
              <span className="font-bold text-base">30Y</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>WPS Mid:</span>
                <div 
                  className="w-14 h-5 border"
                  style={{ 
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.statusWarning 
                  }}
                ></div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>TW Mid:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Spread:</span>
                <span style={{ color: theme.brandPrimary }}>0-000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Quote ECN:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Yield:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Broker Px:</span>
                <span style={{ color: theme.statusWarning }}>97-044 / 97-053</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>DV01:</span>
                <span style={{ color: theme.brandPrimary }}>18.21</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Position:</span>
                <span>-</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.textHelp }}>Global Pos:</span>
                <span>24 MM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Butterfly Metrics - Offer */}
        <div 
          className="p-2 rounded border mb-2 transition-colors"
          style={{ 
            backgroundColor: theme.background4,
            borderColor: theme.borderNeutral 
          }}
        >
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <span style={{ color: theme.textHelp }}>Butterfly:</span>
              <span className="ml-2 font-semibold" style={{ color: theme.brandPrimary }}>0-000</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Net DV01:</span>
              <span className="ml-2 font-semibold" style={{ color: theme.brandPrimary }}>+9.89</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Sales Credit:</span>
              <span className="ml-2">0.0</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Skew:</span>
              <span className="ml-2">Neutral</span>
            </div>
          </div>
        </div>

        {/* Settlement */}
        <div className="mb-2 text-xs">
          <span style={{ color: theme.textHelp }}>Standard Settle:</span>
          <span className="ml-2">3/30/2026</span>
        </div>

        {/* Footer Info */}
        <div 
          className="grid grid-cols-2 gap-4 p-2 rounded mb-2 transition-colors"
          style={{ backgroundColor: theme.background4 }}
        >
          <div className="space-y-0.5 text-xs">
            <div>
              <span style={{ color: theme.textHelp }}>Dealers:</span> <span>4</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Name:</span> <span>BRIAN DELANEY</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Manual Reason:</span> <span>AQ DESK OFF</span>
            </div>
          </div>
          <div className="space-y-0.5 text-xs">
            <div>
              <span style={{ color: theme.textHelp }}>Trader:</span>
            </div>
            <div>
              <span style={{ color: theme.textHelp }}>Sales:</span> <span>Rob Rothery</span>
            </div>
          </div>
        </div>

        {/* Ticket ID */}
        <div className="text-[10px]" style={{ color: theme.textInactive }}>
          RFQ2062217_WFS_TRSV_608
        </div>
      </div>
    </div>
  );
}