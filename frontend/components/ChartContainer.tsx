import React, { useRef, useEffect, useState } from 'react';
// FIX: Removed invalid 'ICandlestickSeriesApi' and 'ILineSeriesApi' type imports.
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickData,
    Time,
    LineStyle,
    SeriesMarker,
    ColorType,
    MouseEventParams,
    UTCTimestamp,
    LineData,
    WhitespaceData,
    CandlestickSeriesOptions,
    DeepPartial,
} from 'lightweight-charts';
import { Candle, ExecutedTrade, Drawing, Settings } from '../types';

interface ChartContainerProps {
  settings: Settings;
  candleData: Candle[];
  trades: ExecutedTrade[];
  drawings: Drawing[];
  onReplayStartClick: (time: Time) => void;
  isReplayMode: boolean;
  isWaitingForReplayStart: boolean;
  isPlaying: boolean;
  replaySpeedMultiplier: number;
  onPlayPause: () => void;
  onNext: () => void;
  onExitReplay: () => void;
  onSpeedChange: (multiplier: number) => void;
  onJumpTo: (index: number) => void;
  replayIndex: number;
  totalReplayCandles: number;
}

// SVG Icons for controls
const PlayIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>;
const PauseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>;
const NextIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg>;
const ExitIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>;


const ReplayControls: React.FC<{
    onPlayPause: () => void;
    onNext: () => void;
    onExit: () => void;
    onSpeedChange: (multiplier: number) => void;
    onJumpTo: (index: number) => void;
    isPlaying: boolean;
    speedMultiplier: number;
    currentIndex: number;
    totalCandles: number;
}> = ({ onPlayPause, onNext, onExit, onSpeedChange, onJumpTo, isPlaying, speedMultiplier, currentIndex, totalCandles }) => {
    const [showJumpInput, setShowJumpInput] = useState(false);
    const [jumpValue, setJumpValue] = useState('');

    const handleJump = () => {
        const index = parseInt(jumpValue, 10) - 1; // User enters 1-based, we use 0-based
        if (!isNaN(index) && index >= 0 && index < totalCandles) {
            onJumpTo(index);
            setJumpValue('');
            setShowJumpInput(false);
        }
    };
    
    const progressPercent = totalCandles > 1 ? (currentIndex / (totalCandles - 1)) * 100 : 0;
    
    return (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 bg-opacity-80 backdrop-blur-sm p-3 rounded-lg shadow-2xl flex flex-col items-center gap-3 text-white z-20 w-full max-w-lg">
            {/* Progress Bar and Candle Count */}
            <div className="w-full flex items-center gap-4 text-xs px-2">
                <span>Candle</span>
                <div className="flex-grow bg-gray-600 rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <span>{currentIndex + 1} / {totalCandles}</span>
            </div>

            {/* Main Controls */}
            <div className="flex items-center gap-4 flex-wrap justify-center">
                <button onClick={onExit} title="Exit Replay" className="p-2 hover:bg-red-500 rounded-full transition-colors"><ExitIcon /></button>
                <button onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'} className="p-2 bg-primary hover:bg-blue-500 rounded-full transition-colors">
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={onNext} title="Next Candle" className="p-2 hover:bg-primary rounded-full transition-colors">
                    <NextIcon />
                </button>
                
                {/* Speed Controls */}
                <div className="flex items-center flex-wrap justify-center gap-2">
                    <span className="text-xs font-medium w-16 text-center">Speed: {speedMultiplier}x</span>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={speedMultiplier}
                        onChange={e => onSpeedChange(Number(e.target.value))}
                        className="w-28 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                </div>

                {/* Jump Controls */}
                <div className="relative">
                    <button onClick={() => setShowJumpInput(!showJumpInput)} className="px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-primary rounded-md transition-colors">
                        Jump To
                    </button>
                    {showJumpInput && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 p-2 rounded-md shadow-lg flex gap-2">
                            <input
                                type="number"
                                value={jumpValue}
                                onChange={e => setJumpValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleJump()}
                                placeholder={`1-${totalCandles}`}
                                className="bg-bkg text-text-primary text-xs rounded-md p-1.5 w-24 border border-border-color focus:ring-primary focus:border-primary"
                                autoFocus
                            />
                            <button onClick={handleJump} className="px-3 py-1 text-xs font-bold text-white bg-primary rounded-md hover:bg-blue-700">Go</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChartContainer: React.FC<ChartContainerProps> = ({
  settings,
  candleData,
  trades,
  drawings,
  onReplayStartClick,
  isReplayMode,
  isWaitingForReplayStart,
  isPlaying,
  replaySpeedMultiplier,
  onPlayPause,
  onNext,
  onExitReplay,
  onSpeedChange,
  onJumpTo,
  replayIndex,
  totalReplayCandles
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // FIX: Using `any` for series refs because of broken lightweight-charts typings in this project environment.
  // The correct type `ISeriesApi<'Candlestick'>` is missing the `setMarkers` method.
  const candleSeriesRef = useRef<any>(null);
  const poiSeriesRef = useRef<any>(null);
  const slSeriesRef = useRef<any>(null);
  const tpSeriesRef = useRef<any>(null);
  const entrySeriesRef = useRef<any>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: settings.theme === 'dark' ? '#131722' : '#ffffff' },
        textColor: settings.theme === 'dark' ? '#d1d4dc' : '#131722',
      },
      grid: {
        vertLines: { color: settings.theme === 'dark' ? '#2A2E39' : '#E6E6E6' },
        horzLines: { color: settings.theme === 'dark' ? '#2A2E39' : '#E6E6E6' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });
    chartRef.current = chart;

    // Fix: Cast chart to 'any' to bypass incorrect type errors for add...Series methods.
    // This is likely due to a type definition mismatch in the project's environment.
    candleSeriesRef.current = (chart as any).addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderDownColor: '#ef5350', borderUpColor: '#26a69a',
      wickDownColor: '#ef5350', wickUpColor: '#26a69a',
    });

    poiSeriesRef.current = (chart as any).addCandlestickSeries({
        upColor: 'rgba(156, 39, 176, 0.2)', downColor: 'rgba(156, 39, 176, 0.2)',
        wickVisible: false, borderVisible: false, priceLineVisible: false, lastValueVisible: false,
    });

    slSeriesRef.current = (chart as any).addLineSeries({
      color: '#ef5350',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    tpSeriesRef.current = (chart as any).addLineSeries({
      color: '#26a69a',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    
    entrySeriesRef.current = (chart as any).addLineSeries({
      color: '#2962ff',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const resizeObserver = new ResizeObserver(entries => {
        // Wrap resize logic in requestAnimationFrame to prevent observer loop errors.
        window.requestAnimationFrame(() => {
            if (!entries || entries.length === 0) {
                return;
            }
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                chart.resize(width, height);
            }
        });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [settings.theme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleClick = (param: MouseEventParams) => {
        if (isWaitingForReplayStart && param.time) {
            onReplayStartClick(param.time);
        }
    };

    chart.subscribeClick(handleClick);

    return () => {
        chart.unsubscribeClick(handleClick);
    };
  }, [isWaitingForReplayStart, onReplayStartClick]);


  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const poiSeries = poiSeriesRef.current;
    const slSeries = slSeriesRef.current;
    const tpSeries = tpSeriesRef.current;
    const entrySeries = entrySeriesRef.current;

    if (!chart || !candleSeries || !poiSeries || !slSeries || !tpSeries || !entrySeries) return;
    
    const timeZone = settings.timezone === 'Local' ? undefined : settings.timezone;

    chart.applyOptions({
        layout: {
            background: { type: ColorType.Solid, color: settings.theme === 'dark' ? '#131722' : '#ffffff' },
            textColor: settings.theme === 'dark' ? '#d1d4dc' : '#131722',
        },
        grid: {
            vertLines: { color: settings.theme === 'dark' ? '#2A2E39' : '#E6E6E6' },
            horzLines: { color: settings.theme === 'dark' ? '#2A2E39' : '#E6E6E6' },
        },
        localization: {
            timeFormatter: (time: UTCTimestamp) => {
                const date = new Date(time * 1000);
                 const options: Intl.DateTimeFormatOptions = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: timeZone,
                };
                // Using a locale that gives a YYYY-MM-DD format, like swedish
                return new Intl.DateTimeFormat('sv-SE', options).format(date);
            },
        },
        timeScale: {
            tickMarkFormatter: (time: UTCTimestamp, tickMarkType: number, locale: string) => {
                const date = new Date(time * 1000);
                const options: Intl.DateTimeFormatOptions = { timeZone };
        
                // from lightweight-charts source: 0: Year, 1: Month, 2: DayOfMonth, 3: Time, 4: TimeWithSeconds
                switch (tickMarkType) {
                    case 0: options.year = 'numeric'; break;
                    case 1: options.month = 'short'; break;
                    case 2: options.day = 'numeric'; break;
                    case 3: options.hour12 = false; options.hour = '2-digit'; options.minute = '2-digit'; break;
                    case 4: options.hour12 = false; options.hour = '2-digit'; options.minute = '2-digit'; options.second = '2-digit'; break;
                }
        
                return new Intl.DateTimeFormat(locale, options).format(date);
            },
        },
    });

    // Clear previous drawings
    candleSeries.setMarkers([]);
    poiSeries.setData([]);

    // Set candle data first
    const formattedCandleData = candleData.map(c => ({
        time: (c.time as number) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
    }));
    candleSeries.setData(formattedCandleData);
    
    // Create and set trade entry/exit markers
    const tradeMarkers: SeriesMarker<UTCTimestamp>[] = [];
    if(trades && trades.length > 0) {
        trades.forEach(trade => {
            const isBullish = trade.type === 'Bullish';
            if(trade.signalTime) {
                tradeMarkers.push({
                    time: trade.signalTime as UTCTimestamp,
                    position: isBullish ? 'belowBar' : 'aboveBar',
                    color: isBullish ? '#82b1ff' : '#ff8a80',
                    shape: isBullish ? 'arrowUp' : 'arrowDown',
                });
            }
            if(trade.entryTime) {
                tradeMarkers.push({
                    time: trade.entryTime as UTCTimestamp,
                    position: isBullish ? 'belowBar' : 'aboveBar',
                    color: isBullish ? '#2962ff' : '#d50000',
                    shape: 'circle',
                    text: 'Entry'
                });
            }
            if (trade.exitTime && trade.outcome !== 'Open') {
                 tradeMarkers.push({
                    time: trade.exitTime as UTCTimestamp,
                    position: isBullish ? 'aboveBar' : 'belowBar',
                    color: trade.outcome === 'Win' ? '#26a69a' : '#ef5350',
                    shape: isBullish ? 'arrowDown' : 'arrowUp',
                    text: 'Exit'
                });
            }
        });
        candleSeries.setMarkers(tradeMarkers);
    }
    

    // Create SL/TP/Entry line segments
    const slData: (LineData | WhitespaceData)[] = [];
    const tpData: (LineData | WhitespaceData)[] = [];
    const entryData: (LineData | WhitespaceData)[] = [];
    const lastCandleTime = candleData.length > 0 ? candleData[candleData.length - 1].time : undefined;

    // Filter for trades that have an entry and sort them chronologically
    const executedTrades = trades.filter(t => t.entryTime).sort((a, b) => (a.entryTime as number) - (b.entryTime as number));

    executedTrades.forEach((trade, index) => {
        // Determine the end time for the lines for the current trade.
        // It extends to the start of the next trade, or to the end of the chart.
        const nextTrade = executedTrades[index + 1];
        const endTime = nextTrade ? nextTrade.entryTime : lastCandleTime;

        if (trade.entryTime && endTime && (endTime as number) > (trade.entryTime as number)) {
            // Add data points for the SL line segment
            slData.push({ time: trade.entryTime as UTCTimestamp, value: trade.slPrice });
            slData.push({ time: endTime as UTCTimestamp, value: trade.slPrice });
            slData.push({ time: endTime as UTCTimestamp }); // Whitespace to create a gap

            // Add data points for the TP line segment
            tpData.push({ time: trade.entryTime as UTCTimestamp, value: trade.tpPrice });
            tpData.push({ time: endTime as UTCTimestamp, value: trade.tpPrice });
            tpData.push({ time: endTime as UTCTimestamp }); // Whitespace to create a gap

            // Add data points for the Entry line segment
            entryData.push({ time: trade.entryTime as UTCTimestamp, value: trade.entryPrice });
            entryData.push({ time: endTime as UTCTimestamp, value: trade.entryPrice });
            entryData.push({ time: endTime as UTCTimestamp }); // Whitespace to create a gap
        }
    });
    
    slSeries.setData(slData);
    tpSeries.setData(tpData);
    entrySeries.setData(entryData);
    
    const poiData: CandlestickData[] = [];
    drawings.forEach(drawing => {
        if (drawing.type === 'BOS' || drawing.type === 'CHoCH') {
            // Intentionally not rendered for a cleaner chart
        } else if (drawing.type === 'POI') {
            // POIs are intentionally not rendered to keep the chart clean,
            // as per user request. The analysis logic remains active.
        }
    });
    
    poiSeries.setData(poiData);

    if (candleData.length > 1) {
      chart.timeScale().setVisibleRange({ from: candleData[0].time, to: candleData[candleData.length - 1].time });
    }

  }, [candleData, trades, drawings, settings.theme, settings.timezone]);

  return (
    <div className="w-full h-full relative">
        {isWaitingForReplayStart && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-md shadow-lg z-20">
                Click on the chart to select a starting point
            </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
        {isReplayMode && (
             <ReplayControls
                onPlayPause={onPlayPause}
                onNext={onNext}
                onExit={onExitReplay}
                onSpeedChange={onSpeedChange}
                onJumpTo={onJumpTo}
                isPlaying={isPlaying}
                speedMultiplier={replaySpeedMultiplier}
                currentIndex={replayIndex}
                totalCandles={totalReplayCandles}
            />
        )}
    </div>
  );
};

export default ChartContainer;