import React, { useState } from 'react';
import { Settings, OptimizerSettings, OptimizerParameter } from '../types';

interface ControlsProps {
  settings: Settings;
  optimizerSettings: OptimizerSettings;
  onSettingsChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onOptimizerSettingsChange: <K extends keyof OptimizerSettings>(key: K, value: OptimizerSettings[K]) => void;
  onRun: () => void;
  onStartReplay: () => void;
  onToggleLiveMode: () => void;
  onRunOptimizer: () => void;
  onTestTelegram: () => void;
  onSendTestSignal: () => void;
  isLoading: boolean;
  isReplayActive: boolean;
  isLiveMode: boolean;
  isOptimizing: boolean;
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 ${active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        {children}
    </button>
);

const SettingsGroup: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
    <div className={`flex flex-col md:flex-row md:items-start gap-4 p-2 border border-border-color-light dark:border-border-color rounded-lg bg-white dark:bg-content ${className}`}>
        <span className="font-bold text-sm md:pr-4 md:border-r-2 border-border-color-light dark:border-border-color md:min-w-[80px] md:pt-1 flex-shrink-0">{title}</span>
        <div className="flex items-center gap-4 flex-wrap">
            {children}
        </div>
    </div>
);

const FormControl: React.FC<{ label: string; children: React.ReactNode; title?: string }> = ({ label, children, title }) => (
    <div className="flex items-center gap-2" title={title}>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        {children}
    </div>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className={`bg-gray-50 dark:bg-bkg border border-gray-300 dark:border-border-color text-gray-900 dark:text-text-primary text-xs rounded-md focus:ring-primary focus:border-primary block p-1.5 ${props.className}`}>
        {props.children}
    </select>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`bg-gray-50 dark:bg-bkg border border-gray-300 dark:border-border-color text-gray-900 dark:text-text-primary text-xs rounded-md focus:ring-primary focus:border-primary block p-1.5 w-24 ${props.className}`} />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
    <button {...props} className={`px-4 py-2 text-xs font-bold text-white bg-primary rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${props.className}`}>
        {props.children}
    </button>
);

const OptimizerFormControl: React.FC<{
    label: string;
    param: OptimizerParameter;
    onChange: (newParam: OptimizerParameter) => void;
    disabled: boolean;
}> = ({ label, param, onChange, disabled }) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2 rounded-md bg-bkg-light dark:bg-bkg">
        <div className="flex items-center gap-2 basis-48">
            <input
                type="checkbox"
                checked={param.enabled}
                onChange={e => onChange({ ...param, enabled: e.target.checked })}
                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                disabled={disabled}
            />
            <label className="text-xs font-semibold w-32 shrink-0">{label}</label>
        </div>
        <div className="flex items-center gap-2 flex-wrap grow basis-64">
            <Input type="number" value={param.start} placeholder="Start" onChange={e => onChange({ ...param, start: Number(e.target.value) })} disabled={disabled || !param.enabled} className="w-20 grow"/>
            <Input type="number" value={param.end} placeholder="End" onChange={e => onChange({ ...param, end: Number(e.target.value) })} disabled={disabled || !param.enabled} className="w-20 grow"/>
            <Input type="number" value={param.step} placeholder="Step" step="0.1" onChange={e => onChange({ ...param, step: Number(e.target.value) })} disabled={disabled || !param.enabled} className="w-20 grow"/>
        </div>
    </div>
);


const Controls: React.FC<ControlsProps> = ({ 
    settings, 
    optimizerSettings,
    onSettingsChange, 
    onOptimizerSettingsChange,
    onRun, 
    onStartReplay, 
    onToggleLiveMode,
    onRunOptimizer,
    onTestTelegram,
    onSendTestSignal,
    isLoading, 
    isReplayActive,
    isLiveMode,
    isOptimizing
}) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'optimizer'>('settings');

    const handleGenericChange = (key: keyof Settings, value: string | number | boolean) => {
        if (typeof settings[key] === 'number' && typeof value !== 'number') {
            onSettingsChange(key, Number(value) as any);
        } else {
            onSettingsChange(key, value as any);
        }
    }

    const handleOptimizerParamChange = (key: keyof Omit<OptimizerSettings, 'targetMetric'>, value: OptimizerParameter) => {
        onOptimizerSettingsChange(key, value);
    };

    const isBinance = settings.dataSource === 'binance';
    const isGenerallyBusy = isLoading || isReplayActive || isOptimizing;
    const controlsDisabled = isGenerallyBusy || isLiveMode;

    return (
        <div className="p-2 bg-content-light dark:bg-content border-b border-border-color-light dark:border-border-color flex flex-col gap-3">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2">
                 <div className="border-b border-border-color-light dark:border-border-color w-full md:w-auto">
                    <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>Settings</TabButton>
                    <TabButton active={activeTab === 'optimizer'} onClick={() => setActiveTab('optimizer')}>Optimizer</TabButton>
                </div>
                 <div className="flex gap-2 items-center flex-wrap w-full md:w-auto justify-start md:justify-end">
                     <Button onClick={onRun} disabled={controlsDisabled}>
                        {isLoading ? 'Loading Data...' : 'Fetch New Data'}
                    </Button>
                    <Button onClick={onStartReplay} disabled={controlsDisabled}>
                        Start Replay
                    </Button>
                    <Button
                        onClick={onToggleLiveMode}
                        disabled={isGenerallyBusy}
                        className={isLiveMode ? '!bg-loss hover:!bg-red-700' : '!bg-win hover:!bg-green-700'}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-white animate-pulse' : 'bg-gray-300'}`}></span>
                            {isLiveMode ? 'Stop Live Mode' : 'Start Live Mode'}
                        </div>
                    </Button>
                </div>
            </div>

            {activeTab === 'settings' && (
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-3">
                             <SettingsGroup title="Chart">
                                <FormControl label="Data Source">
                                    <Select value={settings.dataSource} onChange={e => handleGenericChange('dataSource', e.target.value)} disabled={controlsDisabled}>
                                        <option value="binance">Binance</option>
                                        <option value="coinex">CoinEx</option>
                                        <option value="toobit">Toobit</option>
                                        <option value="bitunix">Bitunix</option>
                                    </Select>
                                </FormControl>
                                <FormControl label="Symbol">
                                    <Input 
                                        type="text" 
                                        value={settings.symbol} 
                                        onChange={e => handleGenericChange('symbol', e.target.value.replace(/[^A-Z0-9.]/g, '').toUpperCase())} 
                                        disabled={controlsDisabled}
                                    />
                                </FormControl>
                                {isBinance && (
                                    <FormControl label="Date Range">
                                        <Select value={settings.timeRange} onChange={e => handleGenericChange('timeRange', e.target.value)} disabled={controlsDisabled}>
                                            <option value="1d">1 Day</option><option value="3d">3 Days</option><option value="7d">7 Days</option><option value="1M">1 Month</option><option value="3M">3 Months</option><option value="6M">6 Months</option><option value="1Y">1 Year</option>
                                        </Select>
                                    </FormControl>
                                )}
                                <FormControl label="Use Proxy">
                                    <input
                                        type="checkbox"
                                        title="Use a proxy for API requests. This is required and automatically enabled for CoinEx."
                                        checked={settings.useProxy}
                                        onChange={e => handleGenericChange('useProxy', e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                        disabled={controlsDisabled}
                                    />
                                </FormControl>
                                 <FormControl label="Theme">
                                    <Select value={settings.theme} onChange={e => handleGenericChange('theme', e.target.value)}>
                                        <option value="dark">Dark</option><option value="light">Light</option>
                                    </Select>
                                </FormControl>
                                <FormControl label="Timezone">
                                    <Select value={settings.timezone} onChange={e => handleGenericChange('timezone', e.target.value)}>
                                        <option value="Local">Local</option>
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">New York</option>
                                        <option value="Europe/London">London</option>
                                        <option value="Asia/Tokyo">Tokyo</option>
                                        <option value="Asia/Tehran">Tehran</option>
                                    </Select>
                                </FormControl>
                            </SettingsGroup>

                             <SettingsGroup title="SMC Strategy">
                                 <FormControl label="HTF (Structure)">
                                    <Select value={settings.htfInterval} onChange={e => handleGenericChange('htfInterval', e.target.value)} disabled={controlsDisabled}>
                                       <option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option>
                                    </Select>
                                </FormControl>
                                <FormControl label="MTF (POI)">
                                    <Select value={settings.mtfInterval} onChange={e => handleGenericChange('mtfInterval', e.target.value)} disabled={controlsDisabled}>
                                       <option value="15m">15m</option><option value="30m">30m</option><option value="1h">1h</option>
                                    </Select>
                                </FormControl>
                                <FormControl label="LTF (Entry)">
                                    <Select value={settings.ltfInterval} onChange={e => handleGenericChange('ltfInterval', e.target.value)} disabled={controlsDisabled}>
                                       <option value="1m">1m</option><option value="5m">5m</option><option value="15m">15m</option>
                                    </Select>
                                </FormControl>
                                <FormControl label="HTF Lookback">
                                    <Input type="number" value={settings.htfSwingLookback} onChange={e => handleGenericChange('htfSwingLookback', e.target.value)} disabled={controlsDisabled} />
                                </FormControl>
                                <FormControl label="LTF Lookback">
                                    <Input type="number" value={settings.ltfChochLookback} onChange={e => handleGenericChange('ltfChochLookback', e.target.value)} disabled={controlsDisabled} />
                                </FormControl>
                                <FormControl label="Premium/Discount Zone">
                                    <Input type="number" value={settings.discountZone} step="0.1" min="0" max="1" onChange={e => handleGenericChange('discountZone', e.target.value)} disabled={controlsDisabled} />
                                </FormControl>
                                <FormControl label="Filter POIs by Liquidity Sweep" title="Only consider impulse legs that swept a prior HTF high/low.">
                                    <input type="checkbox" checked={settings.useLiquiditySweepFilter} onChange={e => handleGenericChange('useLiquiditySweepFilter', e.target.checked)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary" disabled={controlsDisabled}/>
                                </FormControl>
                                <FormControl label="Filter POIs by FVG" title="Only consider POIs that create a Fair Value Gap / Imbalance.">
                                    <input type="checkbox" checked={settings.useFvgFilter} onChange={e => handleGenericChange('useFvgFilter', e.target.checked)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary" disabled={controlsDisabled}/>
                                </FormControl>
                            </SettingsGroup>
                             <SettingsGroup title="Telegram Bot">
                                <FormControl label="Enable">
                                    <input
                                        type="checkbox"
                                        checked={settings.telegramEnabled}
                                        onChange={e => handleGenericChange('telegramEnabled', e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                                        disabled={controlsDisabled}
                                    />
                                </FormControl>
                                <FormControl label="Bot Token">
                                    <Input 
                                        type="text" 
                                        value={settings.telegramToken} 
                                        onChange={e => handleGenericChange('telegramToken', e.target.value)} 
                                        disabled={controlsDisabled || !settings.telegramEnabled}
                                        className="w-40"
                                        placeholder="Your bot token"
                                    />
                                </FormControl>
                                <FormControl label="Chat ID">
                                    <Input 
                                        type="text" 
                                        value={settings.telegramChatId} 
                                        onChange={e => handleGenericChange('telegramChatId', e.target.value)} 
                                        disabled={controlsDisabled || !settings.telegramEnabled}
                                        className="w-40"
                                        placeholder="Your chat ID"
                                    />
                                </FormControl>
                                <Button onClick={onTestTelegram} disabled={controlsDisabled || !settings.telegramEnabled || !settings.telegramToken || !settings.telegramChatId}>
                                    Test
                                </Button>
                            </SettingsGroup>
                        </div>
                        <div className="flex flex-col gap-3">
                             <SettingsGroup title="Backtest">
                                <FormControl label="Initial Capital"><Input type="number" value={settings.initialCapital} onChange={e => handleGenericChange('initialCapital', e.target.value)} disabled={controlsDisabled} /></FormControl>
                                <FormControl label="Order Size (%)"><Input type="number" value={settings.orderSizePercent} onChange={e => handleGenericChange('orderSizePercent', e.target.value)} disabled={controlsDisabled}/></FormControl>
                                <FormControl label="R:R Ratio"><Input type="number" value={settings.rrRatio} onChange={e => handleGenericChange('rrRatio', e.target.value)} disabled={controlsDisabled}/></FormControl>
                                 <FormControl label="Commission (%)"><Input type="number" value={settings.commissionPercent} step="0.01" onChange={e => handleGenericChange('commissionPercent', e.target.value)} disabled={controlsDisabled}/></FormControl>
                                <FormControl label="SL Type">
                                    <Select value={settings.slType} onChange={e => handleGenericChange('slType', e.target.value)} disabled={controlsDisabled}>
                                        <option value="structure">Structure</option>
                                        <option value="fixed">Fixed %</option>
                                    </Select>
                                </FormControl>
                                {settings.slType === 'fixed' && (
                                     <FormControl label="Fixed SL (%)"><Input type="number" value={settings.fixedSlValue} step="0.1" onChange={e => handleGenericChange('fixedSlValue', e.target.value)} disabled={controlsDisabled}/></FormControl>
                                )}
                                 <FormControl label="Profitability Filter">
                                    <input
                                        id="commission-filter"
                                        type="checkbox"
                                        title="If enabled, trades where potential profit is less than commission will be skipped."
                                        checked={settings.filterByCommission}
                                        onChange={e => handleGenericChange('filterByCommission', e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                        disabled={controlsDisabled}
                                    />
                                </FormControl>
                                <FormControl label="Live Update (s)">
                                    <Input type="number" value={settings.liveUpdateInterval} onChange={e => handleGenericChange('liveUpdateInterval', e.target.value)} disabled={controlsDisabled} className="w-20" />
                                </FormControl>
                            </SettingsGroup>
                            <SettingsGroup title="Order Execution">
                                <FormControl label="Execute Orders On">
                                    <Select 
                                        value={settings.orderExecutionExchange} 
                                        onChange={e => handleGenericChange('orderExecutionExchange', e.target.value)} 
                                        disabled={controlsDisabled}
                                        title="Select the exchange to send live orders to"
                                    >
                                        <option value="none">None</option>
                                        <option value="coinex">CoinEx</option>
                                        <option value="binance">Binance</option>
                                    </Select>
                                </FormControl>
                                {settings.orderExecutionExchange === 'coinex' && (
                                    <>
                                        <FormControl label="Use Testnet (Demo)">
                                            <input
                                                type="checkbox"
                                                checked={settings.useCoinExTestnet}
                                                onChange={e => handleGenericChange('useCoinExTestnet', e.target.checked)}
                                                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary disabled:cursor-not-allowed"
                                                disabled={controlsDisabled}
                                                title={"Send orders to the CoinEx testnet/demo environment"}
                                            />
                                        </FormControl>
                                        <FormControl label="Access ID">
                                            <Input 
                                                type="text" 
                                                value={settings.coinexAccessId} 
                                                onChange={e => handleGenericChange('coinexAccessId', e.target.value)} 
                                                disabled={controlsDisabled}
                                                className="w-40"
                                                placeholder="Your CoinEx Access ID"
                                            />
                                        </FormControl>
                                        <FormControl label="Secret Key">
                                            <Input 
                                                type="password" 
                                                value={settings.coinexSecretKey} 
                                                onChange={e => handleGenericChange('coinexSecretKey', e.target.value)} 
                                                disabled={controlsDisabled}
                                                className="w-40"
                                                placeholder="Your CoinEx Secret Key"
                                            />
                                        </FormControl>
                                        <Button 
                                            onClick={onSendTestSignal} 
                                            disabled={controlsDisabled || !settings.coinexAccessId || !settings.coinexSecretKey}
                                            title="Sends a fake bullish limit order based on the last candle price"
                                        >
                                            Send Test Signal
                                        </Button>
                                    </>
                                )}
                                {settings.orderExecutionExchange === 'binance' && (
                                    <>
                                        <FormControl label="Use Testnet (Demo)">
                                            <input
                                                type="checkbox"
                                                checked={settings.useBinanceTestnet}
                                                onChange={e => handleGenericChange('useBinanceTestnet', e.target.checked)}
                                                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary disabled:cursor-not-allowed"
                                                disabled={controlsDisabled}
                                                title={"Send orders to the Binance testnet/demo environment"}
                                            />
                                        </FormControl>
                                        <FormControl label="API Key">
                                            <Input 
                                                type="text" 
                                                value={settings.binanceAccessId} 
                                                onChange={e => handleGenericChange('binanceAccessId', e.target.value)} 
                                                disabled={controlsDisabled}
                                                className="w-40"
                                                placeholder="Your Binance API Key"
                                            />
                                        </FormControl>
                                        <FormControl label="Secret Key">
                                            <Input 
                                                type="password" 
                                                value={settings.binanceSecretKey} 
                                                onChange={e => handleGenericChange('binanceSecretKey', e.target.value)} 
                                                disabled={controlsDisabled}
                                                className="w-40"
                                                placeholder="Your Binance Secret Key"
                                            />
                                        </FormControl>
                                        <Button 
                                            onClick={onSendTestSignal} 
                                            disabled={controlsDisabled || !settings.binanceAccessId || !settings.binanceSecretKey}
                                            title="Sends a fake bullish limit order based on the last candle price"
                                        >
                                            Send Test Signal
                                        </Button>
                                    </>
                                )}
                            </SettingsGroup>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'optimizer' && (
                <div className="flex flex-col gap-3">
                    <SettingsGroup title="Parameters">
                       <div className="flex flex-col gap-2 w-full">
                           <OptimizerFormControl label="HTF Lookback" param={optimizerSettings.htfSwingLookback} onChange={v => handleOptimizerParamChange('htfSwingLookback', v)} disabled={isGenerallyBusy} />
                           <OptimizerFormControl label="LTF Lookback" param={optimizerSettings.ltfChochLookback} onChange={v => handleOptimizerParamChange('ltfChochLookback', v)} disabled={isGenerallyBusy} />
                           <OptimizerFormControl label="P/D Zone" param={optimizerSettings.discountZone} onChange={v => handleOptimizerParamChange('discountZone', v)} disabled={isGenerallyBusy} />
                           <OptimizerFormControl label="R:R Ratio" param={optimizerSettings.rrRatio} onChange={v => handleOptimizerParamChange('rrRatio', v)} disabled={isGenerallyBusy} />
                       </div>
                    </SettingsGroup>
                     <SettingsGroup title="Configuration">
                        <FormControl label="Target Metric">
                             <Select 
                                value={optimizerSettings.targetMetric} 
                                onChange={e => onOptimizerSettingsChange('targetMetric', e.target.value as any)} 
                                disabled={isGenerallyBusy}
                            >
                                <option value="netProfitPercent">Net Profit %</option>
                                <option value="profitFactor">Profit Factor</option>
                                <option value="winRate">Win Rate</option>
                                <option value="maxDrawdown">Max Drawdown</option>
                                <option value="totalTrades">Total Trades</option>
                            </Select>
                        </FormControl>
                        <Button onClick={onRunOptimizer} disabled={isGenerallyBusy}>
                            {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
                        </Button>
                    </SettingsGroup>
                </div>
            )}
        </div>
    );
};

export default Controls;