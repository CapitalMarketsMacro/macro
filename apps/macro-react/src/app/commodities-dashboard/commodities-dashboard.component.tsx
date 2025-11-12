import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Logger } from '@macro/logger';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const logger = Logger.getLogger('CommoditiesDashboardComponent');

// Commodity types
type CommodityCategory = 'Energy' | 'Metals' | 'Agriculture';
type CommodityType =
  | 'Crude Oil'
  | 'Natural Gas'
  | 'Gold'
  | 'Silver'
  | 'Copper'
  | 'Corn'
  | 'SoyBeans';

interface CommodityData {
  symbol: string;
  name: CommodityType;
  category: CommodityCategory;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest: number;
  lastTrade: Date;
  // Futures curve data
  frontMonth: number;
  backMonth: number;
  curveType: 'contango' | 'backwardation';
}

interface PricePoint {
  time: string;
  price: number;
  volume: number;
}

interface OrderBookLevel {
  price: number;
  bidSize: number;
  askSize: number;
}

interface MarketStats {
  totalVolume: number;
  avgSpread: number;
  volatility: number;
  high24h: number;
  low24h: number;
}

// Commodity definitions
const COMMODITIES: Record<CommodityType, Omit<CommodityData, 'price' | 'bid' | 'ask' | 'spread' | 'change' | 'changePercent' | 'volume' | 'openInterest' | 'lastTrade' | 'frontMonth' | 'backMonth' | 'curveType'>> = {
  'Crude Oil': {
    symbol: 'CL',
    name: 'Crude Oil',
    category: 'Energy',
  },
  'Natural Gas': {
    symbol: 'NG',
    name: 'Natural Gas',
    category: 'Energy',
  },
  Gold: {
    symbol: 'GC',
    name: 'Gold',
    category: 'Metals',
  },
  Silver: {
    symbol: 'SI',
    name: 'Silver',
    category: 'Metals',
  },
  Copper: {
    symbol: 'HG',
    name: 'Copper',
    category: 'Metals',
  },
  Corn: {
    symbol: 'ZC',
    name: 'Corn',
    category: 'Agriculture',
  },
  SoyBeans: {
    symbol: 'ZS',
    name: 'SoyBeans',
    category: 'Agriculture',
  },
};

// Initial prices (realistic base prices)
const INITIAL_PRICES: Record<CommodityType, number> = {
  'Crude Oil': 75.50,
  'Natural Gas': 2.85,
  Gold: 2050.00,
  Silver: 24.50,
  Copper: 4.25,
  Corn: 4.80,
  SoyBeans: 12.50,
};

export default function CommoditiesDashboardComponent() {
  // State management
  const [selectedCategory, setSelectedCategory] = useState<CommodityCategory>('Energy');
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityType>('Crude Oil');
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [commodityData, setCommodityData] = useState<Record<CommodityType, CommodityData>>({} as Record<CommodityType, CommodityData>);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookLevel[]>([]);
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalVolume: 0,
    avgSpread: 0,
    volatility: 0,
    high24h: 0,
    low24h: 0,
  });

  // Refs
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousPricesRef = useRef<Record<CommodityType, number>>({} as Record<CommodityType, number>);
  const priceHistoryRef = useRef<PricePoint[]>([]);
  const maxHistoryPoints = 100;

  // Get commodities for selected category
  const availableCommodities = useMemo(() => {
    return Object.entries(COMMODITIES)
      .filter(([_, data]) => data.category === selectedCategory)
      .map(([name]) => name as CommodityType);
  }, [selectedCategory]);

  // Initialize commodity data
  useEffect(() => {
    const initialData: Record<CommodityType, CommodityData> = {} as Record<CommodityType, CommodityData>;
    Object.entries(COMMODITIES).forEach(([name, baseData]) => {
      const commodityName = name as CommodityType;
      const basePrice = INITIAL_PRICES[commodityName];
      const spread = basePrice * 0.0001; // 0.01% spread
      const bid = basePrice - spread / 2;
      const ask = basePrice + spread / 2;

      initialData[commodityName] = {
        ...baseData,
        price: basePrice,
        bid,
        ask,
        spread,
        change: 0,
        changePercent: 0,
        volume: Math.floor(Math.random() * 1000000) + 100000,
        openInterest: Math.floor(Math.random() * 500000) + 50000,
        lastTrade: new Date(),
        frontMonth: basePrice,
        backMonth: basePrice * (Math.random() > 0.5 ? 1.02 : 0.98),
        curveType: Math.random() > 0.5 ? 'contango' : 'backwardation',
      };
      previousPricesRef.current[commodityName] = basePrice;
    });
    setCommodityData(initialData);

    // Initialize price history for selected commodity
    const basePrice = INITIAL_PRICES[selectedCommodity];
    const now = new Date();
    const initialHistory: PricePoint[] = [];
    for (let i = maxHistoryPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 1000);
      // Add some variation to initial history
      const variation = (Math.random() - 0.5) * basePrice * 0.01;
      initialHistory.push({
        time: time.toLocaleTimeString(),
        price: basePrice + variation,
        volume: Math.floor(Math.random() * 1000) + 100,
      });
    }
    setPriceHistory(initialHistory);
    priceHistoryRef.current = initialHistory;

    // Initialize order book
    const initialOrderBook: OrderBookLevel[] = [];
    const orderBookBasePrice = INITIAL_PRICES[selectedCommodity];
    for (let i = 10; i >= 1; i--) {
      const offset = i * 0.01;
      initialOrderBook.push({
        price: orderBookBasePrice - offset,
        bidSize: Math.floor(Math.random() * 500) + 100,
        askSize: 0,
      });
    }
    for (let i = 1; i <= 10; i++) {
      const offset = i * 0.01;
      initialOrderBook.push({
        price: orderBookBasePrice + offset,
        bidSize: 0,
        askSize: Math.floor(Math.random() * 500) + 100,
      });
    }
    setOrderBook(initialOrderBook);
  }, []);

  // Update market data
  const updateMarketData = useCallback(() => {
    if (!isPlaying) return;

    setCommodityData((prev) => {
      const updated = { ...prev };
      Object.keys(COMMODITIES).forEach((name) => {
        const commodityName = name as CommodityType;
        const current = updated[commodityName];
        if (!current) return;

        const previousPrice = previousPricesRef.current[commodityName] || current.price;
        
        // Random walk with slight drift
        const volatility = current.price * 0.001; // 0.1% volatility
        const randomChange = (Math.random() - 0.5) * 2 * volatility * playbackSpeed;
        const newPrice = Math.max(0.01, previousPrice + randomChange);

        const spread = newPrice * 0.0001;
        const bid = newPrice - spread / 2;
        const ask = newPrice + spread / 2;
        const change = newPrice - INITIAL_PRICES[commodityName];
        const changePercent = (change / INITIAL_PRICES[commodityName]) * 100;

        // Update curve
        const curveChange = (Math.random() - 0.5) * 0.01;
        const newBackMonth = current.backMonth + curveChange;
        const newCurveType = newBackMonth > newPrice ? 'contango' : 'backwardation';

        updated[commodityName] = {
          ...current,
          price: newPrice,
          bid,
          ask,
          spread,
          change,
          changePercent,
          volume: current.volume + Math.floor(Math.random() * 1000),
          openInterest: current.openInterest + Math.floor((Math.random() - 0.5) * 100),
          lastTrade: new Date(),
          frontMonth: newPrice,
          backMonth: newBackMonth,
          curveType: newCurveType,
        };

        previousPricesRef.current[commodityName] = newPrice;
      });
      
      // Update price history for selected commodity using updated data
      const selectedCurrent = updated[selectedCommodity];
      if (selectedCurrent) {
        const newPoint: PricePoint = {
          time: new Date().toLocaleTimeString(),
          price: selectedCurrent.price,
          volume: Math.floor(Math.random() * 1000) + 100,
        };

        setPriceHistory((prev) => {
          const updatedHistory = [...prev, newPoint];
          if (updatedHistory.length > maxHistoryPoints) {
            updatedHistory.shift();
          }
          priceHistoryRef.current = updatedHistory;
          return updatedHistory;
        });

        // Update order book
        setOrderBook((prev) => {
          const updatedBook = prev.map((level) => {
            const distance = Math.abs(level.price - selectedCurrent.price);
            if (distance < 0.05) {
              // Update levels near current price
              return {
                ...level,
                bidSize: level.price < selectedCurrent.price ? Math.floor(Math.random() * 500) + 100 : level.bidSize,
                askSize: level.price > selectedCurrent.price ? Math.floor(Math.random() * 500) + 100 : level.askSize,
              };
            }
            return level;
          });
          return updatedBook;
        });
      }
      
      return updated;
    });

    // Update market stats
    const allCommodities = Object.values(commodityData);
    if (allCommodities.length > 0) {
      const totalVolume = allCommodities.reduce((sum, c) => sum + c.volume, 0);
      const avgSpread = allCommodities.reduce((sum, c) => sum + c.spread, 0) / allCommodities.length;
      const prices = allCommodities.map((c) => c.price);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance) / avgPrice;
      const high24h = Math.max(...prices);
      const low24h = Math.min(...prices);

      setMarketStats({
        totalVolume,
        avgSpread,
        volatility,
        high24h,
        low24h,
      });
    }
  }, [isPlaying, playbackSpeed, selectedCommodity]);

  // Start/stop data updates
  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / playbackSpeed; // Adjust interval based on speed
      updateIntervalRef.current = setInterval(updateMarketData, interval);
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, updateMarketData]);

  // Update price history when commodity changes
  useEffect(() => {
    const current = commodityData[selectedCommodity];
    if (current) {
      const now = new Date();
      const newHistory: PricePoint[] = [];
      for (let i = maxHistoryPoints - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 1000);
        newHistory.push({
          time: time.toLocaleTimeString(),
          price: current.price,
          volume: Math.floor(Math.random() * 1000) + 100,
        });
      }
      setPriceHistory(newHistory);
      priceHistoryRef.current = newHistory;
    }
  }, [selectedCommodity]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-2">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const currentCommodity = commodityData[selectedCommodity];
  const spreadColor = currentCommodity?.spread >= 0 ? '#10b981' : '#ef4444';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Commodities Trading Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Live indicator with Switch */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="live-mode"
                  checked={isPlaying}
                  onCheckedChange={setIsPlaying}
                />
                <Label htmlFor="live-mode" className="text-sm font-medium cursor-pointer">
                  {isPlaying ? 'LIVE' : 'PAUSED'}
                </Label>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  isPlaying ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
                }`}
              />
            </div>
            {/* Speed control */}
            <div className="flex items-center gap-2">
              <label className="text-sm">Speed:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="0.5">0.5x</option>
                <option value="1.0">1.0x</option>
                <option value="2.0">2.0x</option>
                <option value="4.0">4.0x</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Commodity Selector */}
        <div className="px-4 pb-4">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Energy Category */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">
                  Energy
                </span>
                <div className="flex gap-2">
                  {Object.entries(COMMODITIES)
                    .filter(([_, data]) => data.category === 'Energy')
                    .map(([name]) => {
                      const commodityName = name as CommodityType;
                      const isSelected = selectedCommodity === commodityName;
                      return (
                        <button
                          key={commodityName}
                          onClick={() => {
                            setSelectedCommodity(commodityName);
                            setSelectedCategory('Energy');
                          }}
                          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                            isSelected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {COMMODITIES[commodityName].symbol}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Metals Category */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">
                  Metals
                </span>
                <div className="flex gap-2">
                  {Object.entries(COMMODITIES)
                    .filter(([_, data]) => data.category === 'Metals')
                    .map(([name]) => {
                      const commodityName = name as CommodityType;
                      const isSelected = selectedCommodity === commodityName;
                      return (
                        <button
                          key={commodityName}
                          onClick={() => {
                            setSelectedCommodity(commodityName);
                            setSelectedCategory('Metals');
                          }}
                          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                            isSelected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {COMMODITIES[commodityName].symbol}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Agriculture Category */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">
                  Agriculture
                </span>
                <div className="flex gap-2">
                  {Object.entries(COMMODITIES)
                    .filter(([_, data]) => data.category === 'Agriculture')
                    .map(([name]) => {
                      const commodityName = name as CommodityType;
                      const isSelected = selectedCommodity === commodityName;
                      return (
                        <button
                          key={commodityName}
                          onClick={() => {
                            setSelectedCommodity(commodityName);
                            setSelectedCategory('Agriculture');
                          }}
                          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                            isSelected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {COMMODITIES[commodityName].symbol}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Left column - Controls and Order Book */}
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
            {/* Market Summary */}
            {currentCommodity && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0">
                <h2 className="text-lg font-semibold mb-4">Market Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Price:</span>
                    <span className="font-semibold">${currentCommodity.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Bid:</span>
                    <span className="font-semibold">${currentCommodity.bid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ask:</span>
                    <span className="font-semibold">${currentCommodity.ask.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Spread:</span>
                    <span
                      className="font-semibold"
                      style={{ color: spreadColor }}
                    >
                      ${currentCommodity.spread.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Change:</span>
                    <span
                      className={`font-semibold ${
                        currentCommodity.change >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {currentCommodity.change >= 0 ? '+' : ''}
                      {currentCommodity.change.toFixed(2)} (
                      {currentCommodity.changePercent >= 0 ? '+' : ''}
                      {currentCommodity.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Volume:</span>
                    <span className="font-semibold">
                      {currentCommodity.volume.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Open Interest:</span>
                    <span className="font-semibold">
                      {currentCommodity.openInterest.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Curve:</span>
                    <span className="font-semibold capitalize">
                      {currentCommodity.curveType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Order Book */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
              <h2 className="text-lg font-semibold mb-4 flex-shrink-0">Order Book</h2>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-1 text-sm">
                  <div className="grid grid-cols-3 gap-2 font-semibold text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                    <div>Bid Size</div>
                    <div className="text-center">Price</div>
                    <div className="text-right">Ask Size</div>
                  </div>
                  {orderBook
                    .slice()
                    .reverse()
                    .map((level, index) => {
                      const isCurrentPrice =
                        currentCommodity &&
                        Math.abs(level.price - currentCommodity.price) < 0.01;
                      return (
                        <div
                          key={index}
                          className={`grid grid-cols-3 gap-2 py-1 ${
                            isCurrentPrice
                              ? 'bg-blue-100 dark:bg-blue-900 font-semibold'
                              : ''
                          }`}
                        >
                          <div className="text-green-600 dark:text-green-400">
                            {level.bidSize > 0 ? level.bidSize.toLocaleString() : '-'}
                          </div>
                          <div className="text-center">{level.price.toFixed(2)}</div>
                          <div className="text-right text-red-600 dark:text-red-400">
                            {level.askSize > 0 ? level.askSize.toLocaleString() : '-'}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Charts and Statistics */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            {/* Price Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-[2] flex flex-col min-h-0">
              <h2 className="text-lg font-semibold mb-4 flex-shrink-0">
                {selectedCommodity} Price Chart
              </h2>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={priceHistory} 
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                      dataKey="time"
                      stroke="#6b7280"
                      tick={{ fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fill: '#6b7280' }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorPrice)"
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume Chart - Removed to save space */}
            
            {/* Live Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0">
              <h2 className="text-lg font-semibold mb-4">Live Statistics</h2>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {marketStats.totalVolume.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Total Volume
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${marketStats.avgSpread.toFixed(4)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Avg Spread
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {(marketStats.volatility * 100).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Volatility
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    ${marketStats.high24h.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    24h High
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${marketStats.low24h.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    24h Low
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

