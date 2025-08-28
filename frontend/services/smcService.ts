import { Time } from 'lightweight-charts';
import { 
    Candle, ChartData, Settings, SMCAnalysisResult, TradeSignal, 
    BacktestResults, ExecutedTrade, SwingPoint, POI, BOS, CHoCH, 
    Drawing, OptimizerSettings, OptimizationResults, OptimizationResultRow 
} from '../types';

const TEHRAN_OFFSET_SECONDS = 3.5 * 60 * 60;

// --- TELEGRAM SERVICE ---

/**
 * Sends a notification message to a specified Telegram chat.
 * @param message The text message to send.
 * @param token The Telegram bot token.
 * @param chatId The target chat ID.
 * @param useHtml Whether to parse the message as HTML. Defaults to false (plain text).
 * @returns A promise that resolves to an object indicating success or failure.
 */
export async function sendTelegramNotification(
    message: string, 
    token: string, 
    chatId: string,
    useHtml: boolean = false
): Promise<{ success: boolean; description?: string }> {
    if (!token || !chatId) {
        return { success: false, description: "Token or Chat ID is missing." };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const params: Record<string, string> = {
        chat_id: chatId,
        text: message,
    };
    
    if (useHtml) {
        params.parse_mode = 'HTML';
    }

    try {
        const response = await fetch(`${url}?${new URLSearchParams(params).toString()}`, { method: 'GET' });
        const data = await response.json();

        if (data.ok) {
            return { success: true };
        } else {
            console.error("Telegram API Error:", data);
            return { success: false, description: data.description };
        }
    } catch (error) {
        console.error("Network error sending Telegram message:", error);
        return { success: false, description: "Network error occurred." };
    }
}


// --- DATA FETCHING ---

async function internalFetchWithProxy(url: string, useProxy: boolean, dataSource: string) {
    const shouldProxy = useProxy || ['coinex', 'toobit', 'bitunix'].includes(dataSource);

    if (!shouldProxy) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.statusText} for URL: ${url}`);
        return response.json();
    }
    
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body');
        throw new Error(`Proxy Error: ${response.statusText}. URL: ${url}. Body: ${errorBody.substring(0,100)}`);
    }
    
    const data = await response.json();

    if (typeof data.contents !== 'string') {
         console.error("Proxy response did not contain 'contents' string:", data);
         throw new Error(`Invalid response from proxy for URL: ${url}`);
    }
    
    try {
         return JSON.parse(data.contents);
    } catch (e) {
        console.error("Failed to parse proxied content:", data.contents);
        throw new Error(`Invalid JSON in proxied content for URL: ${url}. Content: ${data.contents.substring(0, 100)}`);
    }
};

/**
 * Retries a function that returns a promise a specified number of times.
 * @param fn The async function to retry. It should return null on failure to trigger a retry.
 * @param attempts The total number of attempts.
 * @param delay The delay in ms between attempts.
 * @returns The result of the function if successful, or null if all attempts fail.
 */
export async function retry<T>(
    fn: () => Promise<T | null>, 
    attempts: number, 
    delay: number
): Promise<T | null> {
    for (let i = 0; i < attempts; i++) {
        try {
            const result = await fn();
            if (result !== null) {
                return result; // Success
            }
            // If result is null, it's a "soft" failure, so we'll retry.
            console.log(`Attempt ${i + 1}/${attempts} failed (returned null).`);
        } catch (error) {
            console.error(`Attempt ${i + 1}/${attempts} failed with an error:`, error);
        }

        if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    console.error(`All ${attempts} attempts failed.`);
    return null;
}


export async function fetchCurrentPriceCoinEx(symbol: string, useProxy: boolean): Promise<number | null> {
    try {
        const marketSymbol = symbol.toUpperCase().replace(/\.P$/, '');
        const apiUrl = `https://api.coinex.com/v1/market/ticker?market=${marketSymbol}`;
        
        const data = await internalFetchWithProxy(apiUrl, useProxy, 'coinex');

        if (data.code === 0 && data.data && data.data.ticker && data.data.ticker.last) {
            return parseFloat(data.data.ticker.last);
        } else {
            console.error("CoinEx Ticker API Error:", data.message || 'Invalid response format');
            return null;
        }
    } catch (error) {
        console.error(`Failed to fetch current price from CoinEx for ${symbol}:`, error);
        return null;
    }
}

export async function fetchCurrentPriceBinance(symbol: string, useProxy: boolean): Promise<number | null> {
    try {
        const isFutures = symbol.toUpperCase().endsWith('.P');
        const apiSymbol = symbol.toUpperCase().replace('.P', '');
        if (!isFutures) {
            console.warn("Binance price fetch is only configured for futures (.P symbols).");
            return null;
        }
        
        const apiUrl = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${apiSymbol}`;
        
        const data = await internalFetchWithProxy(apiUrl, useProxy, 'binance');

        if (data && data.price) {
            return parseFloat(data.price);
        } else {
            console.error("Binance Ticker API Error:", data.msg || 'Invalid response format');
            return null;
        }
    } catch (error) {
        console.error(`Failed to fetch current price from Binance for ${symbol}:`, error);
        return null;
    }
}

async function fetchCandles(symbol: string, interval: string, startTime: number, dataSource: string, useProxy: boolean): Promise<Candle[]> {
    try {
        switch (dataSource) {
            case 'binance': {
                let allCandles: any[] = [];
                let currentStartTime = startTime;
                const endTime = Date.now();

                const useFuturesApi = symbol.toUpperCase().endsWith('.P');
                const apiSymbol = symbol.toUpperCase().replace('.P', '');
                const apiHost = useFuturesApi ? 'https://fapi.binance.com' : 'https://api.binance.com';
                const apiPath = useFuturesApi ? '/fapi/v1/klines' : '/api/v3/klines';
                const limit = useFuturesApi ? 1500 : 1000; // Futures API allows up to 1500

                while (currentStartTime < endTime) {
                    const apiUrl = `${apiHost}${apiPath}?symbol=${apiSymbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
                    const data = await internalFetchWithProxy(apiUrl, useProxy, dataSource);
                    if (!Array.isArray(data) || data.length === 0) break;
                    allCandles = allCandles.concat(data);
                    currentStartTime = data[data.length - 1][0] + 1;
                }
                return allCandles.map(d => ({ time: (d[0] / 1000) as Time, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
            }
            
            case 'coinex': {
                const marketSymbol = symbol.toUpperCase().replace(/\.P$/, '');
                const coinexInterval = interval.replace('m', 'min').replace('h', 'hour').replace('d', 'day');
                const apiUrl = `https://api.coinex.com/v1/market/kline?market=${marketSymbol}&type=${coinexInterval}&limit=1000`;
                const data = await internalFetchWithProxy(apiUrl, useProxy, dataSource);

                if (data.code !== 0 || !Array.isArray(data.data)) {
                    throw new Error(`CoinEx API Error: ${data.message || 'Invalid response'}`);
                }
                
                return data.data.map((d: any[]) => ({
                    time: Number(d[0]) as Time,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[3]),
                    low: parseFloat(d[4]),
                    close: parseFloat(d[2]),
                })).sort((a, b) => (a.time as number) - (b.time as number));
            }
            case 'toobit': {
                const toobitApiUrl = `https://api.toobit.com/api/v1/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=1000`;
                const toobitData = await internalFetchWithProxy(toobitApiUrl, useProxy, dataSource);
                if (!Array.isArray(toobitData)) {
                    throw new Error(`Toobit API Error: Invalid response format`);
                }
                return toobitData.map((d: any[]) => ({
                    time: (d[0] / 1000) as Time,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                })).sort((a, b) => (a.time as number) - (b.time as number));
            }
            case 'bitunix': {
                const cleanSymbol = symbol.toUpperCase().replace('.P', '');
                const bitunixSymbol = cleanSymbol.replace(/USDT$/, '/USDT');
                const bitunixApiUrl = `https://api.bitunix.com/api/v1/market/klines?symbol=${bitunixSymbol}&interval=${interval}&limit=1000`;
                const bitunixData = await internalFetchWithProxy(bitunixApiUrl, useProxy, dataSource);
                if (String(bitunixData.code) !== '0' || !Array.isArray(bitunixData.data)) {
                    throw new Error(`Bitunix API Error: ${bitunixData.msg || 'Invalid response'}`);
                }
                return bitunixData.data.map((d: any[]) => ({
                    time: Number(d[0]) as Time,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                })).sort((a, b) => (a.time as number) - (b.time as number));
            }
            default:
                throw new Error(`Unsupported data source: ${dataSource}`);
        }
    } catch (error) {
        console.error(`Failed to fetch data from ${dataSource}:`, error);
        throw error;
    }
}

export async function fetchAllData(settings: Settings): Promise<ChartData> {
    const now = new Date();
    let startTime;
    switch (settings.timeRange) {
        case '1d': startTime = now.setDate(now.getDate() - 1); break;
        case '3d': startTime = now.setDate(now.getDate() - 3); break;
        case '7d': startTime = now.setDate(now.getDate() - 7); break;
        case '1M': startTime = now.setMonth(now.getMonth() - 1); break;
        case '3M': startTime = now.setMonth(now.getMonth() - 3); break;
        case '6M': startTime = now.setMonth(now.getMonth() - 6); break;
        case '1Y': startTime = now.setFullYear(now.getFullYear() - 1); break;
        default: startTime = now.setMonth(now.getMonth() - 1);
    }

    const intervals = {
        htf: settings.htfInterval,
        mtf: settings.mtfInterval,
        ltf: settings.ltfInterval,
    };

    const dataPromises = Object.entries(intervals).map(async ([key, value]) => {
        try {
            const data = await fetchCandles(settings.symbol, value, startTime, settings.dataSource, settings.useProxy);
            return { key, status: 'fulfilled', value: data };
        } catch (error) {
            return { key, status: 'rejected', reason: `Failed to fetch ${key.toUpperCase()} (${value})`, interval: value };
        }
    });

    const results = await Promise.all(dataPromises);
    
    const failedFetches = results.filter(r => r.status === 'rejected');
    if (failedFetches.length > 0) {
        const errorDetails = failedFetches.map(f => `${f.key} (${f.interval})`).join(', ');
        throw new Error(`Failed to fetch data for: ${errorDetails}`);
    }

    const chartData: ChartData = { htf: [], mtf: [], ltf: [] };
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            chartData[result.key as keyof ChartData] = result.value.sort((a, b) => (a.time as number) - (b.time as number));
        }
    });

    return chartData;
}


// --- SMC ANALYSIS ---

function findSwingPoints(data: Candle[], lookback: number): { highs: SwingPoint[], lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];
    if (data.length < lookback * 2 + 1) {
        return { highs, lows };
    }
    for (let i = lookback; i < data.length - lookback; i++) {
        let isHigh = true;
        let isLow = true;
        for (let j = 1; j <= lookback; j++) {
            if (data[i].high < data[i - j].high || data[i].high <= data[i + j].high) isHigh = false;
            if (data[i].low > data[i - j].low || data[i].low >= data[i + j].low) isLow = false;
        }
        if (isHigh) highs.push({ time: data[i].time, price: data[i].high, type: 'high' });
        if (isLow) lows.push({ time: data[i].time, price: data[i].low, type: 'low' });
    }
    return { highs, lows };
}

export function analyzeSMC(chartData: ChartData, settings: Settings): SMCAnalysisResult {
    const allTrades: TradeSignal[] = [];
    const allDrawings: Drawing[] = [];
    const { htf, mtf, ltf } = chartData;

    if (htf.length < settings.htfSwingLookback * 2 + 1 || mtf.length < 10 || ltf.length < 10) {
        return { trades: [], drawings: [] };
    }

    // --- Step 1 & 2: Identify all HTF BOS and subsequent MTF POIs from the full history ---
    const htfSwings = findSwingPoints(htf, settings.htfSwingLookback);
    const htfSwingHighs = htfSwings.highs.sort((a, b) => (a.time as number) - (b.time as number));
    const htfSwingLows = htfSwings.lows.sort((a, b) => (a.time as number) - (b.time as number));
    
    const potentialPois: (POI & { direction: 'Bullish' | 'Bearish' })[] = [];

    // Bullish Structure Analysis
    for (let i = 1; i < htfSwingHighs.length; i++) {
        const prevHigh = htfSwingHighs[i - 1];
        const currentHigh = htfSwingHighs[i];
        if (currentHigh.price > prevHigh.price) { // Bullish BOS
            const bos: BOS = { time: currentHigh.time, price: prevHigh.price };
            allDrawings.push({ type: 'BOS', data: bos });

            const impulseLowCandle = htfSwings.lows.filter(l => (l.time as number) > (prevHigh.time as number) && (l.time as number) < (currentHigh.time as number)).sort((a, b) => a.price - b.price)[0];
            if (!impulseLowCandle) continue;

            // LIQUIDITY SWEEP FILTER
            if (settings.useLiquiditySweepFilter) {
                const priorLow = htfSwingLows.filter(l => (l.time as number) < (impulseLowCandle.time as number)).pop();
                if (!priorLow || impulseLowCandle.price >= priorLow.price) {
                    continue; // This leg did not sweep liquidity, so skip it
                }
            }

            const discountLevel = impulseLowCandle.price + (currentHigh.price - impulseLowCandle.price) * settings.discountZone;
            const mtfCandlesInLeg = mtf.filter(c => (c.time as number) >= (impulseLowCandle.time as number) && (c.time as number) <= (currentHigh.time as number));
            
            const mtfDataMap = new Map(mtf.map(c => [c.time, c]));
            
            for (const obCandle of [...mtfCandlesInLeg].reverse()) {
                if (obCandle.open > obCandle.close && obCandle.high < discountLevel) {
                    // FVG/IMBALANCE FILTER
                    if (settings.useFvgFilter) {
                        const obCandleIndex = mtf.findIndex(c => c.time === obCandle.time);
                        if (obCandleIndex < 0 || obCandleIndex + 2 >= mtf.length) continue;
                        const secondCandleAfterOb = mtf[obCandleIndex + 2];
                        if (secondCandleAfterOb.low <= obCandle.high) {
                            continue; // No FVG found, skip this POI
                        }
                    }

                    potentialPois.push({ 
                        startTime: obCandle.time, 
                        endTime: currentHigh.time,
                        top: obCandle.high, 
                        bottom: obCandle.low,
                        direction: 'Bullish'
                    });
                }
            }
        }
    }

    // Bearish Structure Analysis
    for (let i = 1; i < htfSwingLows.length; i++) {
        const prevLow = htfSwingLows[i - 1];
        const currentLow = htfSwingLows[i];
        if (currentLow.price < prevLow.price) { // Bearish BOS
            const bos: BOS = { time: currentLow.time, price: prevLow.price };
            allDrawings.push({ type: 'BOS', data: bos });
    
            const impulseHighCandle = htfSwings.highs.filter(h => (h.time as number) > (prevLow.time as number) && (h.time as number) < (currentLow.time as number)).sort((a, b) => b.price - a.price)[0];
            if (!impulseHighCandle) continue;

            // LIQUIDITY SWEEP FILTER
            if (settings.useLiquiditySweepFilter) {
                const priorHigh = htfSwingHighs.filter(h => (h.time as number) < (impulseHighCandle.time as number)).pop();
                if (!priorHigh || impulseHighCandle.price <= priorHigh.price) {
                    continue; // This leg did not sweep liquidity, so skip it
                }
            }
    
            const premiumLevel = impulseHighCandle.price - (impulseHighCandle.price - currentLow.price) * settings.discountZone;
            const mtfCandlesInLeg = mtf.filter(c => (c.time as number) >= (impulseHighCandle.time as number) && (c.time as number) <= (currentLow.time as number));
    
            for (const obCandle of [...mtfCandlesInLeg].reverse()) {
                if (obCandle.open < obCandle.close && obCandle.low > premiumLevel) {
                    // FVG/IMBALANCE FILTER
                     if (settings.useFvgFilter) {
                        const obCandleIndex = mtf.findIndex(c => c.time === obCandle.time);
                        if (obCandleIndex < 0 || obCandleIndex + 2 >= mtf.length) continue;
                        const secondCandleAfterOb = mtf[obCandleIndex + 2];
                        if (secondCandleAfterOb.high >= obCandle.low) {
                            continue; // No FVG found, skip this POI
                        }
                    }

                    potentialPois.push({
                        startTime: obCandle.time,
                        endTime: currentLow.time,
                        top: obCandle.high,
                        bottom: obCandle.low,
                        direction: 'Bearish'
                    });
                }
            }
        }
    }
    
    let activePois = [...potentialPois]
        .sort((a, b) => (a.startTime as number) - (b.startTime as number))
        .filter((poi, index, self) => 
            index === self.findIndex(p => p.startTime === poi.startTime && p.top === poi.top && p.bottom === poi.bottom)
        );

    activePois.forEach(p => allDrawings.push({ type: 'POI', data: { ...p, endTime: ltf[ltf.length - 1].time } }));


    // --- Step 3: Iterate through LTF, candle by candle, to find entries ---
    let monitoredPoi: (POI & { direction: 'Bullish' | 'Bearish' }) | null = null;
    let ltfDataForChoch: Candle[] = [];

    for (let i = 0; i < ltf.length; i++) {
        const currentLtfCandle = ltf[i];
        
        if (monitoredPoi) {
            const isInvalidated = (monitoredPoi.direction === 'Bullish' && currentLtfCandle.low < monitoredPoi.bottom) ||
                                  (monitoredPoi.direction === 'Bearish' && currentLtfCandle.high > monitoredPoi.top);

            if (isInvalidated) {
                monitoredPoi = null;
                ltfDataForChoch = [];
                continue;
            }
            
            ltfDataForChoch.push(currentLtfCandle);
            if (ltfDataForChoch.length < settings.ltfChochLookback * 2 + 1) continue;

            const ltfLocalSwings = findSwingPoints(ltfDataForChoch, settings.ltfChochLookback);

            if (monitoredPoi.direction === 'Bullish') {
                const lastLtfHigh = ltfLocalSwings.highs.pop();
                if (lastLtfHigh && currentLtfCandle.high > lastLtfHigh.price) { // Bullish CHoCH
                    const choch: CHoCH = { time: currentLtfCandle.time, price: lastLtfHigh.price };
                    allDrawings.push({ type: 'CHoCH', data: choch });
                    
                    const chochLowPoint = ltfLocalSwings.lows.filter(l => (l.time as number) < (choch.time as number)).pop();
                    if (!chochLowPoint) {
                        monitoredPoi = null; ltfDataForChoch = []; continue;
                    }

                    const entryLegCandles = ltfDataForChoch.filter(c => (c.time as number) >= (chochLowPoint.time as number) && (c.time as number) <= (choch.time as number));
                    const entryOB = [...entryLegCandles].reverse().find(c => c.open > c.close);

                    if (entryOB) {
                        const entryPrice = entryOB.high;
                        const stopLoss = settings.slType === 'structure' ? chochLowPoint.price : entryPrice * (1 - (settings.fixedSlValue / 100));
                        const risk = entryPrice - stopLoss;
                        if (risk > 0) {
                            const takeProfit = entryPrice + (risk * settings.rrRatio);
                             if (!allTrades.some(t => t.entryTime === entryOB.time)) {
                                allTrades.push({ entryTime: entryOB.time, entryPrice, stopLoss, takeProfit, type: 'Bullish' });
                            }
                        }
                    }
                    monitoredPoi = null; ltfDataForChoch = [];
                }
            } else { // Bearish direction
                const lastLtfLow = ltfLocalSwings.lows.pop();
                if (lastLtfLow && currentLtfCandle.low < lastLtfLow.price) { // Bearish CHoCH
                    const choch: CHoCH = { time: currentLtfCandle.time, price: lastLtfLow.price };
                    allDrawings.push({ type: 'CHoCH', data: choch });

                    const chochHighPoint = ltfLocalSwings.highs.filter(h => (h.time as number) < (choch.time as number)).pop();
                    if (!chochHighPoint) {
                        monitoredPoi = null; ltfDataForChoch = []; continue;
                    }

                    const entryLegCandles = ltfDataForChoch.filter(c => (c.time as number) >= (chochHighPoint.time as number) && (c.time as number) <= (choch.time as number));
                    const entryOB = [...entryLegCandles].reverse().find(c => c.open < c.close);

                    if (entryOB) {
                        const entryPrice = entryOB.low;
                        const stopLoss = settings.slType === 'structure' ? chochHighPoint.price : entryPrice * (1 + (settings.fixedSlValue / 100));
                        const risk = stopLoss - entryPrice;
                        if (risk > 0) {
                            const takeProfit = entryPrice - (risk * settings.rrRatio);
                             if (!allTrades.some(t => t.entryTime === entryOB.time)) {
                                allTrades.push({ entryTime: entryOB.time, entryPrice, stopLoss, takeProfit, type: 'Bearish' });
                            }
                        }
                    }
                    monitoredPoi = null; ltfDataForChoch = [];
                }
            }
        } else {
            for (const poi of activePois) {
                if ((currentLtfCandle.time as number) < (poi.startTime as number)) continue;

                const hasEntered = (poi.direction === 'Bullish' && currentLtfCandle.low <= poi.top && currentLtfCandle.high >= poi.bottom) || 
                                   (poi.direction === 'Bearish' && currentLtfCandle.high >= poi.bottom && currentLtfCandle.low <= poi.top);
                
                if (hasEntered) {
                    monitoredPoi = poi;
                    ltfDataForChoch = [currentLtfCandle];
                    activePois = activePois.filter(p => p !== poi);
                    break;
                }
            }
        }
    }
    
    allTrades.sort((a, b) => (a.entryTime as number) - (b.entryTime as number));
    return { trades: allTrades, drawings: allDrawings };
}


// --- BACKTESTING ---

export function runBacktest(ltfData: Candle[], tradeSignals: TradeSignal[], settings: Settings, startingEquity?: number): BacktestResults {
    const initialCapitalForRun = startingEquity ?? settings.initialCapital;
    let equity = initialCapitalForRun;
    let peakEquity = initialCapitalForRun;
    let maxDrawdown = 0;
    let maxDrawdownAmount = 0;
    const executedTrades: ExecutedTrade[] = [];
    let activeTrade: ExecutedTrade | null = null;
    let pendingSignals = [...tradeSignals].sort((a, b) => (a.entryTime as number) - (b.entryTime as number));

    for (const candle of ltfData) {
        // 1. Check to close an active trade
        if (activeTrade) {
            let outcome: 'Win' | 'Loss' | null = null;
            let exitPrice: number | null = null;

            const hitSL = activeTrade.type === 'Bullish' ? candle.low <= activeTrade.slPrice : candle.high >= activeTrade.slPrice;
            const hitTP = activeTrade.type === 'Bullish' ? candle.high >= activeTrade.tpPrice : candle.low <= activeTrade.tpPrice;

            if (hitSL) {
                outcome = 'Loss';
                exitPrice = activeTrade.slPrice;
            } else if (hitTP) {
                outcome = 'Win';
                exitPrice = activeTrade.tpPrice;
            }

            if (outcome && exitPrice) {
                const equityBefore = activeTrade.equity;
                const amountToRisk = Math.abs(activeTrade.pnl); // Base risk amount was stored here
                const positionValue = activeTrade.leverage * equityBefore;

                const finalPnl = outcome === 'Win' ? amountToRisk * settings.rrRatio : -amountToRisk;
                const finalCommissionCost = positionValue * (settings.commissionPercent / 100) * 2;
                const netPnl = finalPnl - finalCommissionCost;

                equity += netPnl;
                if (equity > peakEquity) peakEquity = equity;

                const drawdownPercent = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
                if (drawdownPercent > maxDrawdown) {
                    maxDrawdown = drawdownPercent;
                    maxDrawdownAmount = peakEquity - equity;
                }

                // Update the trade object that's already in the executedTrades array
                activeTrade.outcome = outcome;
                activeTrade.exitTime = candle.time;
                activeTrade.exitPrice = exitPrice;
                activeTrade.pnl = netPnl;
                activeTrade.equity = equity;
                activeTrade.returnOnEquityPercent = (netPnl / equityBefore) * 100;

                activeTrade = null; // Position is now closed
            }
        }

        // 2. Check to open a new trade (only if no active trade)
        if (!activeTrade) {
            for (let i = 0; i < pendingSignals.length; i++) {
                const signal = pendingSignals[i];

                if ((candle.time as number) < (signal.entryTime as number)) continue;

                const isBullishEntry = signal.type === 'Bullish' && candle.low <= signal.entryPrice && candle.high >= signal.entryPrice;
                const isBearishEntry = signal.type === 'Bearish' && candle.high >= signal.entryPrice && candle.low <= signal.entryPrice;

                if (isBullishEntry || isBearishEntry) {
                    const equityBefore = equity;
                    const amountToRiskOriginal = equityBefore * (settings.orderSizePercent / 100);
                    const riskPerUnit = Math.abs(signal.entryPrice - signal.stopLoss);
                    if (riskPerUnit <= 0) continue;

                    const positionSizeInUnitsOriginal = amountToRiskOriginal / riskPerUnit;
                    const positionValueOriginal = positionSizeInUnitsOriginal * signal.entryPrice;

                    if (settings.filterByCommission) {
                        const commissionCost = positionValueOriginal * (settings.commissionPercent / 100) * 2;
                        const potentialProfit = amountToRiskOriginal * settings.rrRatio;
                        if (potentialProfit <= commissionCost) continue;
                    }

                    const exactLeverage = positionValueOriginal / equityBefore;
                    const appliedLeverage = Math.ceil(exactLeverage);
                    const finalPositionValue = equityBefore * appliedLeverage;
                    const finalPositionSizeInUnits = finalPositionValue / signal.entryPrice;
                    const finalAmountToRisk = finalPositionSizeInUnits * riskPerUnit;

                    activeTrade = {
                        signalTime: signal.entryTime,
                        entryTime: candle.time,
                        outcome: 'Open',
                        exitTime: null,
                        exitPrice: null,
                        entryPrice: signal.entryPrice,
                        type: signal.type,
                        pnl: finalAmountToRisk, // Temporarily store amountToRisk, it will be replaced on close
                        equity: equityBefore, // Store equity at time of entry
                        slPrice: signal.stopLoss,
                        tpPrice: signal.takeProfit,
                        returnOnEquityPercent: 0,
                        leverage: appliedLeverage,
                    };

                    executedTrades.push(activeTrade);
                    pendingSignals.splice(i, 1);
                    i--; // Adjust index after splice
                    break; // Only one trade can open per candle
                }
            }
        }
    }

    const closedTrades = executedTrades.filter(t => t.outcome !== 'Open');
    const totalTrades = closedTrades.length;

    if (totalTrades === 0) {
        return { trades: executedTrades, maxDrawdown: 0, maxDrawdownAmount: 0, netProfitPercent: 0, winRate: 0, profitFactor: 0, finalEquity: equity, totalTrades: 0 };
    }

    const wins = closedTrades.filter(t => t.outcome === 'Win').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const finalEquity = equity;
    const netProfitPercent = ((finalEquity - initialCapitalForRun) / initialCapitalForRun) * 100;
    const totalWinPnl = closedTrades.filter(t => t.outcome === 'Win').reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(closedTrades.filter(t => t.outcome === 'Loss').reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : Infinity;

    return {
        trades: executedTrades,
        maxDrawdown,
        maxDrawdownAmount,
        netProfitPercent,
        winRate,
        profitFactor,
        finalEquity,
        totalTrades
    };
}


// --- OPTIMIZER ---

function generateCombinations(optimizerSettings: OptimizerSettings, baseSettings: Settings): Partial<Settings>[] {
    const paramsToOptimize: { key: keyof OptimizerSettings, values: number[] }[] = [];

    (Object.keys(optimizerSettings) as Array<keyof OptimizerSettings>).forEach(key => {
        if (key !== 'targetMetric' && optimizerSettings[key].enabled) {
            const { start, end, step } = optimizerSettings[key];
            const values: number[] = [];
            for (let v = start; v <= end; v += step) {
                values.push(v);
            }
            paramsToOptimize.push({ key, values });
        }
    });

    if (paramsToOptimize.length === 0) return [{}];

    const combinations: Partial<Settings>[] = [];
    const max = paramsToOptimize.length - 1;

    function helper(combo: Partial<Settings>, i: number) {
        for (let j = 0, l = paramsToOptimize[i].values.length; j < l; j++) {
            const nextCombo = {
                ...combo,
                [paramsToOptimize[i].key as keyof Settings]: paramsToOptimize[i].values[j]
            };
            if (i === max) {
                combinations.push(nextCombo);
            } else {
                helper(nextCombo, i + 1);
            }
        }
    }
    helper({}, 0);
    return combinations;
}


export async function runOptimizer(
    chartData: ChartData,
    baseSettings: Settings,
    optimizerSettings: OptimizerSettings
): Promise<OptimizationResults> {
    const combinations = generateCombinations(optimizerSettings, baseSettings);
    const runs: OptimizationResultRow[] = [];

    if (combinations.length > 500) {
        throw new Error(`Too many combinations to test: ${combinations.length}. Please narrow the optimization range.`);
    }

    for (let i = 0; i < combinations.length; i++) {
        const params = combinations[i];
        const currentSettings = { ...baseSettings, ...params };

        const analysis = analyzeSMC(chartData, currentSettings);
        const results = runBacktest(chartData.ltf, analysis.trades, currentSettings);
        
        runs.push({ id: i, params, results });
    }

    if (runs.length === 0) return { runs: [], bestRun: null };

    runs.sort((a, b) => {
        const metric = optimizerSettings.targetMetric;
        const valA = a.results[metric] as number;
        const valB = b.results[metric] as number;
        
        // For drawdown, less is better
        if (metric === 'maxDrawdown' || metric === 'maxDrawdownAmount') {
            return valA - valB;
        }
        // For other metrics, more is better
        return valB - valA;
    });

    return {
        runs,
        bestRun: runs[0],
    };
}

// --- ORDER EXECUTION ---

export async function sendOrderToCoinEx(
    signal: TradeSignal,
    settings: Settings,
    currentEquity: number
): Promise<{ success: boolean; description?: string }> {
    if (!settings.coinexAccessId || !settings.coinexSecretKey) {
        return { success: false, description: "CoinEx API keys are missing." };
    }

    // Calculate position size and leverage based on current equity
    const amountToRisk = currentEquity * (settings.orderSizePercent / 100);
    const riskPerUnit = Math.abs(signal.entryPrice - signal.stopLoss);

    if (riskPerUnit <= 0) {
        return { success: false, description: "Invalid risk: SL and entry price are too close." };
    }

    const positionSizeInUnits = amountToRisk / riskPerUnit;
    const positionValue = positionSizeInUnits * signal.entryPrice;
    const leverage = Math.max(1, Math.ceil(positionValue / currentEquity)); // Ensure leverage is at least 1
    const marketSymbol = settings.symbol.toUpperCase().replace(/\.P$/, '');

    const finalParams: Record<string, any> = {
        access_id: settings.coinexAccessId,
        tonce: Date.now(),
        market: marketSymbol,
        side: signal.type === 'Bullish' ? 2 : 1, // 2 for buy, 1 for sell
        amount: positionSizeInUnits.toFixed(8), // Using high precision, may need adjustment per market
        price: signal.entryPrice.toFixed(8),
        leverage: leverage,
        stop_loss_price: signal.stopLoss.toFixed(8),
        take_profit_price: signal.takeProfit.toFixed(8)
    };

    // Create signature for CoinEx API
    const sortedKeys = Object.keys(finalParams).sort();
    let queryString = sortedKeys.map(key => `${key}=${finalParams[key]}`).join('&');
    queryString += `&secret_key=${settings.coinexSecretKey}`;

    const signature = md5(queryString).toUpperCase();
    
    const baseUrl = settings.useCoinExTestnet ? 'https://api.testnet.coinex.com' : 'https://api.coinex.com';
    const apiUrl = `${baseUrl}/v1/perpetual/order/put-limit`;

    const proxyUrl = 'https://thingproxy.freeboard.io/fetch/';
    const proxiedApiUrl = `${proxyUrl}${apiUrl}`;

    try {
        const response = await fetch(proxiedApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': signature
            },
            body: JSON.stringify(finalParams)
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error("CoinEx Proxy Error:", response.status, errorText);
             return { success: false, description: `Proxy Error: ${response.status}. Please try again.` };
        }

        const data = await response.json();

        if (data.code === 0) {
            return { success: true };
        } else {
            console.error("CoinEx API Error:", data);
            return { success: false, description: data.message };
        }
    } catch (error: any) {
        console.error("Network error sending order to CoinEx:", error);
        if (error instanceof SyntaxError) {
             return { success: false, description: "Invalid response from server. Check proxy." };
        }
        return { success: false, description: error.message || "Network error occurred." };
    }
}

export async function sendOrderToBinance(
    signal: TradeSignal,
    settings: Settings,
    currentEquity: number
): Promise<{ success: boolean; description?: string }> {
    if (!settings.binanceAccessId || !settings.binanceSecretKey) {
        return { success: false, description: "Binance API keys are missing." };
    }

    // --- Placeholder Implementation ---
    // A full implementation requires HMAC-SHA256 signing of the request payload,
    // which is complex to handle securely in a browser environment without dedicated
    // crypto libraries or a backend proxy. This function demonstrates the
    // parameter calculation and confirms the UI is wired correctly.

    console.log("--- Preparing to send order to Binance (Placeholder) ---");

    // 1. Calculate position size and leverage
    const amountToRisk = currentEquity * (settings.orderSizePercent / 100);
    const riskPerUnit = Math.abs(signal.entryPrice - signal.stopLoss);

    if (riskPerUnit <= 0) {
        const desc = "Invalid risk: SL and entry price are too close.";
        console.error(`Binance Order Error: ${desc}`);
        return { success: false, description: desc };
    }

    const positionSizeInUnits = amountToRisk / riskPerUnit;
    const positionValue = positionSizeInUnits * signal.entryPrice;
    const leverage = Math.max(1, Math.ceil(positionValue / currentEquity));
    const marketSymbol = settings.symbol.toUpperCase().replace(/\.P$/, '');

    // 2. Log calculated parameters
    console.log(`Symbol: ${marketSymbol}`);
    console.log(`Side: ${signal.type === 'Bullish' ? 'BUY' : 'SELL'}`);
    console.log(`Type: LIMIT`);
    console.log(`Quantity: ${positionSizeInUnits.toFixed(3)}`); // Precision depends on symbol
    console.log(`Price: ${signal.entryPrice.toFixed(4)}`);
    console.log(`Leverage: ${leverage}`);
    console.log(`Stop Loss: ${signal.stopLoss.toFixed(4)}`);
    console.log(`Take Profit: ${signal.takeProfit.toFixed(4)}`);
    console.log(`Using Testnet: ${settings.useBinanceTestnet}`);
    
    // In a real implementation, you would now:
    // a. Construct the request body/query string with these params + timestamp.
    // b. Generate an HMAC-SHA256 signature using the secret key.
    // c. Make a POST request to the Binance Futures API endpoint for creating an order.
    //    (e.g., https://fapi.binance.com/fapi/v1/order)
    // d. Include the API key in the 'X-MBX-APIKEY' header.
    // e. Handle the response from the Binance API.
    
    console.log("--- End of Placeholder ---");

    return { success: true, description: "Placeholder function executed successfully. Check console for details." };
}


// --- MD5 HASH IMPLEMENTATION (for CoinEx API) ---
// This is a self-contained, dependency-free MD5 implementation.
function md5(string: string) {
    function rotateLeft(lValue: number, iShiftBits: number) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX: number, lY: number) {
        let lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        if (lX4 | lY4) {
            if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        } else return (lResult ^ lX8 ^ lY8);
    }
    function F(x: number, y: number, z: number) { return (x & y) | ((~x) & z); }
    function G(x: number, y: number, z: number) { return (x & z) | (y & (~z)); }
    function H(x: number, y: number, z: number) { return (x ^ y ^ z); }
    function I(x: number, y: number, z: number) { return (y ^ (x | (~z))); }
    function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(string: string) {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue: number) {
        let WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    function utf8Encode(string: string) {
        string = string.replace(/\r\n/g, "\n");
        let utftext = "";
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }
    let x = Array<any>();
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756); c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A); c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF); c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193); c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340); c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x2441453); c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6); c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8); c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681); c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9); c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA); c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5); c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97); c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92); c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0); c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235); c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
    return temp.toLowerCase();
}