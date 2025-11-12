import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { Logger } from '@macro/logger';
import { AgCharts } from 'ag-charts-angular';
import { AgChartOptions } from 'ag-charts-community';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import clone from "clone";


interface MicrostructureDataPoint {
  timestamp: Date; // Use Date object for time axis compatibility
  tradeCount: number;
  orderToTradeRatio: number;
  quoteUpdates: number;
  timeBetweenTrades: number; // in milliseconds
}

@Component({
  selector: 'app-treasury-microstructure',
  templateUrl: './treasury-microstructure.component.html',
  styleUrl: './treasury-microstructure.component.css',
  standalone: true,
  imports: [AgCharts],
})
export class TreasuryMicrostructureComponent implements OnInit, OnDestroy {
  private logger = Logger.getLogger('TreasuryMicrostructureComponent');
  private updateInterval?: ReturnType<typeof setInterval>;
  private themeObserver?: MutationObserver;

  // Inject dependencies for theme detection
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);


  // Chart options for each metric
  public tradeFrequencyOptions: AgChartOptions = {};
  public orderToTradeRatioOptions: AgChartOptions = {};
  public quoteUpdateFrequencyOptions: AgChartOptions = {};
  public timeBetweenTradesOptions: AgChartOptions = {};

  // Data storage
  private microstructureData: MicrostructureDataPoint[] = [];
  private readonly maxDataPoints = 50; // Keep last 50 data points
  private readonly updateIntervalMs = 1000; // Update every 1 second

  // Current theme
  private currentTheme: 'ag-default' | 'ag-default-dark' = 'ag-default';

  ngOnInit(): void {
    this.logger.info('Treasury Microstructure component initialized');
    this.detectTheme();
    this.setupThemeObserver();
    this.initializeCharts();
    this.generateInitialData();
    this.startDataUpdates();
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  /**
   * Detect current theme from document or localStorage
   */
  private detectTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document.documentElement;
    const isDark = root.classList.contains('dark') ||
                   localStorage.getItem('theme') === 'dark';

    this.currentTheme = isDark ? 'ag-default-dark' : 'ag-default';
  }

  /**
   * Setup observer to watch for theme changes
   */
  private setupThemeObserver(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document.documentElement;

    // Watch for class changes on document root
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = root.classList.contains('dark');
          const newTheme = isDark ? 'ag-default-dark' : 'ag-default';

          if (newTheme !== this.currentTheme) {
            this.currentTheme = newTheme;
            this.updateChartThemes();
          }
        }
      });
    });

    this.themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  /**
   * Update all chart themes
   */
  private updateChartThemes(): void {
    this.tradeFrequencyOptions = {
      ...this.tradeFrequencyOptions,
      theme: this.currentTheme,
    };
    this.orderToTradeRatioOptions = {
      ...this.orderToTradeRatioOptions,
      theme: this.currentTheme,
    };
    this.quoteUpdateFrequencyOptions = {
      ...this.quoteUpdateFrequencyOptions,
      theme: this.currentTheme,
    };
    this.timeBetweenTradesOptions = {
      ...this.timeBetweenTradesOptions,
      theme: this.currentTheme,
    };
  }

  private initializeCharts(): void {
    // Trade Frequency Chart (Bar Chart)
    this.tradeFrequencyOptions = {
      theme: this.currentTheme,
      animation: {
        enabled: false
      },
      title: {
        text: 'Trade Frequency per Interval',
      },
      subtitle: {
        text: 'Number of trades per 1-second interval',
      },
      data: [],
      series: [
        {
          type: 'bar',
          xKey: 'timestamp',
          yKey: 'tradeCount',
          yName: 'Trade Count',
          fill: '#4f46e5',
          stroke: '#4338ca',
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
          nice: true,
          label: {
            format: '%H:%M:%S',
          },
        },
        {
          type: 'number',
          position: 'left',
          nice: false,
          title: {
            text: 'Trade Count',
          },
        },
      ],
      legend: {
        enabled: false,
      },
    };

    // Order-to-Trade Ratio Chart (Line Chart)
    this.orderToTradeRatioOptions = {
      theme: this.currentTheme,
      animation: {
        enabled: false
      },
      title: {
        text: 'Order-to-Trade Ratio',
      },
      subtitle: {
        text: 'Ratio of orders to executed trades',
      },
      data: [],
      series: [
        {
          type: 'line',
          xKey: 'timestamp',
          yKey: 'orderToTradeRatio',
          yName: 'Order-to-Trade Ratio',
          stroke: '#10b981',
          marker: {
            fill: '#10b981',
            size: 4,
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
          nice: false,
          label: {
            format: '%H:%M:%S',
          },
        },
        {
          type: 'number',
          position: 'left',
          nice: false,
          title: {
            text: 'Ratio',
          },
        },
      ],
      legend: {
        enabled: false,
      },
    };

    // Quote Update Frequency Chart (Line Chart)
    this.quoteUpdateFrequencyOptions = {
      theme: this.currentTheme,
      animation: {
        enabled: false
      },
      title: {
        text: 'Quote Update Frequency',
      },
      subtitle: {
        text: 'Number of quote updates per interval',
      },
      data: [],
      series: [
        {
          type: 'line',
          xKey: 'timestamp',
          yKey: 'quoteUpdates',
          yName: 'Quote Updates',
          stroke: '#f59e0b',
          marker: {
            fill: '#f59e0b',
            size: 4,
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
          nice: false,
          label: {
            format: '%H:%M:%S',
          },
        },
        {
          type: 'number',
          position: 'left',
          nice: false,
          title: {
            text: 'Update Count',
          },
        },
      ],
      legend: {
        enabled: false,
      },
    };

    // Time Between Trades Chart (Line Chart)
    this.timeBetweenTradesOptions = {
      theme: this.currentTheme,
      animation: {
        enabled: false
      },
      title: {
        text: 'Time Between Trades',
      },
      subtitle: {
        text: 'Average time between trades (milliseconds)',
      },
      data: [],
      series: [
        {
          type: 'line',
          xKey: 'timestamp',
          yKey: 'timeBetweenTrades',
          yName: 'Time (ms)',
          stroke: '#ef4444',
          marker: {
            fill: '#ef4444',
            size: 4,
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
          nice: true,
          label: {
            format: '%H:%M:%S',
          },
        },
        {
          type: 'number',
          position: 'left',
          nice: false,
          title: {
            text: 'Time (ms)',
          },
        },
      ],
      legend: {
        enabled: false,
      },
    };
  }

  private generateInitialData(): void {
    const now = new Date();
    this.microstructureData = [];

    // Generate initial data points (last 50 seconds)
    for (let i = 49; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 1000);
      this.microstructureData.push(this.generateDataPoint(timestamp));
    }

    this.updateChartData();
  }

  private generateDataPoint(timestamp: Date): MicrostructureDataPoint {
    // Simulate realistic market microstructure data
    const baseTradeCount = 5 + Math.random() * 15; // 5-20 trades per second
    const baseOrderCount = baseTradeCount * (3 + Math.random() * 5); // 3-8x orders vs trades
    const baseQuoteUpdates = 20 + Math.random() * 30; // 20-50 quote updates per second
    const baseTimeBetweenTrades = 50 + Math.random() * 200; // 50-250ms between trades

    // Add some volatility
    const volatility = 0.3;
    const tradeCount = Math.max(0, Math.round(baseTradeCount * (1 + (Math.random() - 0.5) * volatility)));
    const orderToTradeRatio = baseOrderCount / Math.max(1, tradeCount);
    const quoteUpdates = Math.max(0, Math.round(baseQuoteUpdates * (1 + (Math.random() - 0.5) * volatility)));
    const timeBetweenTrades = Math.max(10, baseTimeBetweenTrades * (1 + (Math.random() - 0.5) * volatility));

    return {
      timestamp: timestamp, // Use Date object for time axis
      tradeCount,
      orderToTradeRatio: Math.round(orderToTradeRatio * 100) / 100,
      quoteUpdates,
      timeBetweenTrades: Math.round(timeBetweenTrades),
    };
  }

  private startDataUpdates(): void {
    this.updateInterval = setInterval(() => {
      const now = new Date();
      const newDataPoint = this.generateDataPoint(now);

      // Add new data point
      this.microstructureData.push(newDataPoint);

      // Remove oldest data point if we exceed max
      if (this.microstructureData.length > this.maxDataPoints) {
        this.microstructureData.shift();
      }

      this.updateChartData();
    }, this.updateIntervalMs);
  }

  private updateChartData(): void {
    // Update all charts with current data
    // ag-Charts automatically re-renders when the data array is updated
    // Just update the data property and Angular's change detection will handle the rest
    const chartData = [...this.microstructureData];

    // Directly update the data property - ag-Charts will automatically detect and update
    if (this.tradeFrequencyOptions) {
      const newOption = clone(this.tradeFrequencyOptions);
      newOption.data = chartData;

      this.tradeFrequencyOptions = newOption;
    }
    if (this.orderToTradeRatioOptions) {
      this.orderToTradeRatioOptions.data = chartData;
      const newOption = clone(this.orderToTradeRatioOptions);

      this.orderToTradeRatioOptions = newOption;


    }
    if (this.quoteUpdateFrequencyOptions) {
      this.quoteUpdateFrequencyOptions.data = chartData;
      const newOption = clone(this.quoteUpdateFrequencyOptions);
      this.quoteUpdateFrequencyOptions = newOption;
    }
    if (this.timeBetweenTradesOptions) {
      this.timeBetweenTradesOptions.data = chartData;
      const newOption = clone(this.timeBetweenTradesOptions);
      this.timeBetweenTradesOptions = newOption;
    }
  }
}

