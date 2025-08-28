import { Time } from 'lightweight-charts';

export interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SwingPoint {
    time: Time;
    price: number;
    type: 'high' | 'low';
}

export interface BOS {
    time: Time;
    price: number;
}

export interface POI {
    startTime: Time;
    endTime: Time;
    top: number;
    bottom: number;
}

export interface CHoCH {
    time: Time;
    price: number;
}

export interface Drawing {
    type: 'BOS' | 'POI' | 'CHoCH';
    data: any;
}

export interface TradeSignal {
    entryTime: Time;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    type: 'Bullish' | 'Bearish';
}

export interface ExecutedTrade {
    signalTime: Time;
    entryTime: Time | null;
    exitTime: Time | null;
    entryPrice: number;
    exitPrice: number | null;
    outcome: 'Win' | 'Loss' | 'Open';
    pnl: number;
    equity: number;
    type: 'Bullish' | 'Bearish';
    slPrice: number;
    tpPrice: number;
    returnOnEquityPercent: number;
    leverage: number;
}

export interface BacktestResults {
    trades: ExecutedTrade[];
    maxDrawdown: number;
    maxDrawdownAmount: number;
    netProfitPercent: number;
    winRate: number;
    profitFactor: number;
    finalEquity: number;
    totalTrades: number;
}

export interface SMCAnalysisResult {
    trades: TradeSignal[];
    drawings: Drawing[];
}

export interface ChartData {
    htf: Candle[];
    mtf: Candle[];
    ltf: Candle[];
}

export interface Settings {
    dataSource: string;
    symbol: string;
    timeRange: string;
    useProxy: boolean;
    theme: 'dark' | 'light';
    timezone: string;
    // Timeframe settings
    htfInterval: string;
    mtfInterval: string;
    ltfInterval: string;
    // SMC parameters
    htfSwingLookback: number;
    ltfChochLookback: number;
    discountZone: number; // e.g., 0.5 for 50%
    useFvgFilter: boolean;
    useLiquiditySweepFilter: boolean;
    // Backtest parameters
    initialCapital: number;
    orderSizePercent: number;
    rrRatio: number;
    commissionPercent: number;
    filterByCommission: boolean;
    slType: 'structure' | 'fixed';
    fixedSlValue: number;
    // Automation
    liveUpdateInterval: number; // in seconds
    // Other
    telegramEnabled: boolean;
    telegramToken: string;
    telegramChatId: string;
    // Exchange Integration
    orderExecutionExchange: 'none' | 'coinex' | 'binance';
    coinexAccessId: string;
    coinexSecretKey: string;
    useCoinExTestnet: boolean;
    binanceAccessId: string;
    binanceSecretKey: string;
    useBinanceTestnet: boolean;
}

export interface OrderStatus {
    id: string;
    symbol: string;
    type: 'Bullish' | 'Bearish';
    status: 'sending' | 'success' | 'error';
    message: string;
    timestamp: number;
}

// --- Optimizer Types ---
export interface OptimizerParameter {
    enabled: boolean;
    start: number;
    end: number;
    step: number;
}

export interface OptimizerSettings {
    htfSwingLookback: OptimizerParameter;
    ltfChochLookback: OptimizerParameter;
    discountZone: OptimizerParameter;
    rrRatio: OptimizerParameter;
    targetMetric: keyof BacktestResults;
}

export interface OptimizationResultRow {
    params: Partial<Settings>;
    results: BacktestResults;
    id: number;
}

export interface OptimizationResults {
    runs: OptimizationResultRow[];
    bestRun: OptimizationResultRow | null;
}