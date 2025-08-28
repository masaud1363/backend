import React, { useState, useMemo } from 'react';
import { BacktestResults, ExecutedTrade, Settings, OptimizationResults, OptimizationResultRow, OrderStatus } from '../types';

interface ResultsPanelProps {
    results: BacktestResults | null;
    optimizerResults: OptimizationResults | null;
    settings: Settings;
    orderStatuses: OrderStatus[];
    onHeightChange: (height: number) => void;
    onApplySettings: (settings: Partial<Settings>) => void;
    isOptimizing: boolean;
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 ${active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        {children}
    </button>
);


const formatTimestamp = (unixTimestamp: any, timezone: string) => {
    if (!unixTimestamp) return '-';
    const date = new Date((unixTimestamp as number) * 1000);
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    };
    if (timezone !== 'Local') {
        options.timeZone = timezone;
    }
    return date.toLocaleString('en-US', options);
};

const TradesModal: React.FC<{ isOpen: boolean; onClose: () => void; trades: ExecutedTrade[], settings: Settings }> = ({ isOpen, onClose, trades, settings }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-content-light dark:bg-content rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col p-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-color-light dark:border-border-color">
                    <h2 className="text-xl font-bold">Trades List</h2>
                    <button onClick={onClose} className="text-2xl font-bold">&times;</button>
                </div>
                <div className="flex-grow overflow-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="sticky top-0 bg-gray-200 dark:bg-gray-700">
                            <tr>
                                {['#', 'Type', 'Outcome', 'Entry Time', 'Entry Price', 'Exit Time', 'Exit Price', 'Adj. Leverage', 'PnL ($)', 'Return (%)', 'Equity'].map(h =>
                                    <th key={h} className="p-2">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((trade, index) => (
                                <tr key={index} className="border-b border-border-color-light dark:border-border-color hover:bg-gray-200 dark:hover:bg-gray-700">
                                    <td className="p-2">{index + 1}</td>
                                    <td className="p-2">{trade.type}</td>
                                    <td className={`p-2 font-bold ${trade.outcome === 'Win' ? 'text-win' : 'text-loss'}`}>{trade.outcome}</td>
                                    <td className="p-2">{formatTimestamp(trade.entryTime, settings.timezone)}</td>
                                    <td className="p-2">{trade.entryPrice.toFixed(4)}</td>
                                    <td className="p-2">{formatTimestamp(trade.exitTime, settings.timezone)}</td>
                                    <td className="p-2">{trade.exitPrice?.toFixed(4) ?? '-'}</td>
                                    <td className="p-2">{trade.leverage > 0 ? `${Math.ceil(trade.leverage)}x` : '-'}</td>
                                    <td className="p-2">{trade.pnl.toFixed(2)}</td>
                                    <td className={`p-2 ${trade.returnOnEquityPercent >= 0 ? 'text-win' : 'text-loss'}`}>{trade.returnOnEquityPercent.toFixed(2)}%</td>
                                    <td className="p-2">{trade.equity.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const SummaryItem: React.FC<{ label: string; value: React.ReactNode; colorClass?: string }> = ({ label, value, colorClass = "" }) => (
    <div className="bg-bkg-light dark:bg-bkg p-3 rounded-lg border border-border-color-light dark:border-border-color">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
    </div>
);

const SummaryPanel: React.FC<{ results: BacktestResults, settings: Settings }> = ({ results, settings }) => {
    if (results.totalTrades > 0) {
        const netProfitAmount = results.finalEquity - settings.initialCapital;
        const numberFormatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <SummaryItem
                    label="Net Profit"
                    value={
                        <div className="flex items-baseline">
                            <span>{numberFormatter.format(results.netProfitPercent)}%</span>
                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                                (${numberFormatter.format(netProfitAmount)})
                            </span>
                        </div>
                    }
                    colorClass={results.netProfitPercent >= 0 ? 'text-win' : 'text-loss'}
                />
                <SummaryItem label="Total Trades" value={results.totalTrades} />
                <SummaryItem label="Win Rate" value={`${numberFormatter.format(results.winRate)}%`} />
                <SummaryItem label="Profit Factor" value={isFinite(results.profitFactor) ? numberFormatter.format(results.profitFactor) : '∞'} />
                <SummaryItem
                    label="Max Drawdown"
                    value={
                        <div className="flex items-baseline">
                            <span>{numberFormatter.format(results.maxDrawdown)}%</span>
                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                                (${numberFormatter.format(results.maxDrawdownAmount)})
                            </span>
                        </div>
                    }
                    colorClass="text-loss"
                />
                <SummaryItem label="Final Equity" value={`$${numberFormatter.format(results.finalEquity)}`} />
            </div>
        );
    }
    return <p>No trades were executed based on the current strategy and data.</p>;
};

const OptimizerPanel: React.FC<{
    optimizerResults: OptimizationResults;
    onApplySettings: (settings: Partial<Settings>) => void;
}> = ({ optimizerResults, onApplySettings }) => {
    const { runs, bestRun } = optimizerResults;
    const [sortConfig, setSortConfig] = useState<{ key: keyof BacktestResults | 'params', direction: 'asc' | 'desc' } | null>(null);

    const sortedRuns = useMemo(() => {
        if (!sortConfig) return runs;
        return [...runs].sort((a, b) => {
            let valA, valB;
            if (sortConfig.key === 'params') {
                valA = JSON.stringify(a.params);
                valB = JSON.stringify(b.params);
            } else {
                valA = a.results[sortConfig.key as keyof BacktestResults] as number;
                valB = b.results[sortConfig.key as keyof BacktestResults] as number;
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [runs, sortConfig]);
    
    const requestSort = (key: keyof BacktestResults | 'params') => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const paramKeys = runs.length > 0 ? Object.keys(runs[0].params) : [];
    const metricKeys = ['netProfitPercent', 'totalTrades', 'winRate', 'profitFactor', 'maxDrawdown'] as const;

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-sm font-bold p-2">Optimization Results ({runs.length} runs)</h3>
            <div className="flex-grow overflow-auto">
                <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-gray-200 dark:bg-gray-700">
                        <tr>
                            <th className="p-2">#</th>
                            {paramKeys.map(key => <th key={key} className="p-2">{key}</th>)}
                            {metricKeys.map(key => <th key={key} className="p-2 cursor-pointer" onClick={() => requestSort(key)}>{key}</th>)}
                            <th className="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRuns.map((run, index) => (
                            <tr key={run.id} className={`border-b border-border-color-light dark:border-border-color hover:bg-gray-200 dark:hover:bg-gray-700 ${run.id === bestRun?.id ? 'bg-primary/20' : ''}`}>
                                <td className="p-2">{run.id + 1}</td>
                                {paramKeys.map(key => <td key={key} className="p-2">{run.params[key as keyof typeof run.params]}</td>)}
                                {metricKeys.map(key => <td key={key} className="p-2">{typeof run.results[key] === 'number' ? (run.results[key] as number).toFixed(2) : run.results[key]}</td>)}
                                <td className="p-2">
                                    <button onClick={() => onApplySettings(run.params)} className="px-2 py-1 text-xs font-bold text-white bg-primary/80 rounded-md hover:bg-primary">
                                        Apply
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ExecutionLogPanel: React.FC<{ orderStatuses: OrderStatus[] }> = ({ orderStatuses }) => {
    if (orderStatuses.length === 0) {
        return <p className="p-4 text-center text-gray-500 dark:text-gray-400">No orders have been sent in this session.</p>;
    }

    const getStatusIndicator = (status: 'sending' | 'success' | 'error') => {
        switch (status) {
            case 'sending': return <div className="w-3 h-3 border-2 border-t-primary border-gray-200 dark:border-gray-600 rounded-full animate-spin" title="Sending..."></div>;
            case 'success': return <div className="w-3 h-3 rounded-full bg-win" title="Success"></div>;
            case 'error': return <div className="w-3 h-3 rounded-full bg-loss" title="Error"></div>;
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow overflow-auto">
                <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-gray-200 dark:bg-gray-700">
                        <tr>
                            <th className="p-2 w-12 text-center">Status</th>
                            <th className="p-2">Time</th>
                            <th className="p-2">Symbol</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...orderStatuses].reverse().map(order => (
                            <tr key={order.id} className="border-b border-border-color-light dark:border-border-color">
                                <td className="p-2"><div className="flex justify-center items-center">{getStatusIndicator(order.status)}</div></td>
                                <td className="p-2">{new Date(order.timestamp).toLocaleTimeString('en-US', { hour12: false })}</td>
                                <td className="p-2">{order.symbol}</td>
                                <td className={`p-2 font-bold ${order.type === 'Bullish' ? 'text-win' : 'text-loss'}`}>{order.type}</td>
                                <td className="p-2">{order.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
    results, 
    optimizerResults, 
    settings, 
    onHeightChange, 
    onApplySettings, 
    isOptimizing, 
    orderStatuses
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'optimizer' | 'log'>('summary');
    
    React.useEffect(() => {
        if (optimizerResults) {
            setActiveTab('optimizer');
        } else if (!isOptimizing) { // Avoid switching away from log when optimizer finishes
            setActiveTab('summary');
        }
    }, [optimizerResults, isOptimizing]);

    React.useEffect(() => {
        // Switch to log tab automatically when a new order is sent
        if (orderStatuses.length > 0) {
            const latestStatus = orderStatuses[orderStatuses.length - 1];
            if (latestStatus.status === 'sending') {
                setActiveTab('log');
            }
        }
    }, [orderStatuses]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = e.currentTarget.parentElement?.offsetHeight || 300;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newHeight = startHeight - (moveEvent.clientY - startY);
            if (newHeight > 50 && newHeight < window.innerHeight - 200) {
                onHeightChange(newHeight);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="w-full h-full flex-shrink-0 bg-content-light dark:bg-content border-t border-border-color-light dark:border-border-color flex flex-col overflow-hidden">
            <div
                className="w-full h-8 flex-shrink-0 bg-gray-300 dark:bg-gray-700 cursor-ns-resize flex items-center justify-center relative group"
                onMouseDown={handleMouseDown}
                title="Drag to resize"
            >
                <div className="w-10 h-1 bg-gray-400 dark:bg-gray-600 rounded-full group-hover:bg-gray-500 dark:group-hover:bg-gray-500 transition-colors"></div>
            </div>
            
            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-2 border-b border-border-color-light dark:border-border-color">
                    <div className="flex">
                        <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>Performance Summary</TabButton>
                         {optimizerResults && <TabButton active={activeTab === 'optimizer'} onClick={() => setActiveTab('optimizer')}>Optimizer</TabButton>}
                         <TabButton active={activeTab === 'log'} onClick={() => setActiveTab('log')}>
                            Execution Log
                            {orderStatuses.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-primary rounded-full">{orderStatuses.length}</span>
                            )}
                        </TabButton>
                    </div>
                    {activeTab === 'summary' && (
                        <button onClick={() => setIsModalOpen(true)} className="px-3 py-1 text-xs font-bold text-white bg-primary rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={!results || results.trades.length === 0}>
                            Show Trades
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-auto">
                     {isOptimizing && activeTab !== 'log' ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-4 border-t-primary border-gray-200 rounded-full animate-spin"></div>
                            <span className="ml-4">Running Optimization...</span>
                        </div>
                    ) : activeTab === 'summary' ? (
                         results ? <div className="p-4"><SummaryPanel results={results} settings={settings} /></div> : <p className="p-4">Run a backtest to see the performance summary.</p>
                    ) : activeTab === 'optimizer' ? (
                        optimizerResults ? <OptimizerPanel optimizerResults={optimizerResults} onApplySettings={onApplySettings} /> : <p className="p-4">Run an optimization to see results.</p>
                    ) : (
                        <ExecutionLogPanel orderStatuses={orderStatuses} />
                    )}
                </div>
            </div>
            {results && <TradesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} trades={results.trades} settings={settings} />}
        </div>
    );
};

export default ResultsPanel;