import { useState, useEffect } from 'react';
import { usePriceMonitor } from '../hooks/usePriceMonitor';
import { Activity, TrendingDown, Wallet, BarChart3, Eye, EyeOff, Zap, PackageOpen, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ipcService } from '../lib/ipc-service';

export default function Home() {
  const { config, currentPrices, currentEmas, status, lastUpdated } = usePriceMonitor();
  const [balances, setBalances] = useState<{ USDT: number; INR: number } | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [tpSlModal, setTpSlModal] = useState<{ pos: any; takeProfit: string; stopLoss: string; submitting: boolean } | null>(null);

  // Trade Terminal State
  const [tradeForm, setTradeForm] = useState({
    asset: 'BTC',
    quoteCurrency: 'USDT',
    side: 'buy',
    orderType: 'market_order',
    price: '',
    quantity: '',
    percentage: '0',
    leverage: '1',
    usePercentage: false
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<string[]>(['BTC', 'XAG']); // Default fallback
  const [selectedMarketPrice, setSelectedMarketPrice] = useState<number | null>(null);

  useEffect(() => {
    // Clear old price while loading new one
    setSelectedMarketPrice(null);
    
    const fetchSelectedPrice = async () => {
      try {
        const symbol = `${tradeForm.asset}${tradeForm.quoteCurrency}`;
        const data = await ipcService.getPrice(symbol);
        if (data.success) {
          console.log(`Updated price for ${symbol}: ${data.price}`);
          setSelectedMarketPrice(data.price);
        }
      } catch (e) {
        console.error('Failed to fetch selected market price');
      }
    };
    
    fetchSelectedPrice();
    const intervalId = setInterval(fetchSelectedPrice, 5000);
    return () => clearInterval(intervalId);
  }, [tradeForm.asset, tradeForm.quoteCurrency]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeForm.usePercentage && (!tradeForm.quantity || isNaN(Number(tradeForm.quantity)))) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    if (tradeForm.usePercentage && (!tradeForm.percentage || Number(tradeForm.percentage) <= 0)) {
      toast.error('Please select a valid percentage.');
      return;
    }
    if (tradeForm.orderType === 'limit_order' && (!tradeForm.price || isNaN(Number(tradeForm.price)))) {
      toast.error('Please enter a valid price for limit order.');
      return;
    }

    const sizeStr = tradeForm.usePercentage ? `${tradeForm.percentage}% of balance` : `${tradeForm.quantity} ${tradeForm.asset}`;
    if (!confirm(`Place ${tradeForm.side.toUpperCase()} order for ${sizeStr} on ${tradeForm.quoteCurrency} market?`)) return;

    setPlacingOrder(true);
    toast.loading('Placing order...', { id: 'place-order' });

    try {
      const data = await ipcService.placeOrder({
        asset: tradeForm.asset,
        quoteCurrency: tradeForm.quoteCurrency,
        side: tradeForm.side,
        orderType: tradeForm.orderType,
        price: Number(tradeForm.price),
        quantity: tradeForm.usePercentage ? 0 : Number(tradeForm.quantity),
        percentage: tradeForm.usePercentage ? Number(tradeForm.percentage) : 0,
        leverage: Number(tradeForm.leverage)
      });
      
      if (data.success) {
        toast.success('Order placed successfully!', { id: 'place-order' });
        setTradeForm(prev => ({ ...prev, quantity: '', price: '', percentage: '0' }));
        // Refresh
        ipcService.getPositions().then(d => d.success && setPositions(d.positions));
        ipcService.getBalance().then(d => d.success && setBalances(d.balances));
      } else {
        toast.error(`Failed: ${JSON.stringify(data.error)}`, { id: 'place-order' });
      }
    } catch (err) {
      toast.error('An error occurred while placing the order.', { id: 'place-order' });
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleClosePosition = async (pos: any) => {
    const side = (parseFloat(pos.active_pos) || 0) >= 0 ? 'buy' : 'sell';
    const quantity = Math.abs(parseFloat(pos.active_pos) || 0);
    
    if (!confirm(`Are you sure you want to CLOSE your ${pos.pair} position?`)) return;

    toast.loading('Closing position...', { id: 'close-pos' });
    
    try {
      const data = await ipcService.closePosition({
        pair: pos.pair,
        side: side,
        quantity: quantity,
        marginCurrency: pos.margin_currency_short_name
      });
      
      if (data.success) {
        toast.success('Position closed successfully!', { id: 'close-pos' });
        ipcService.getPositions().then(d => d.success && setPositions(d.positions));
      } else {
        toast.error(`Failed to close: ${JSON.stringify(data.error)}`, { id: 'close-pos' });
      }
    } catch (err) {
      toast.error('An error occurred while closing the position.', { id: 'close-pos' });
    }
  };

  const handleSetTpSl = async () => {
    if (!tpSlModal) return;
    const { pos, takeProfit, stopLoss } = tpSlModal;
    if (!takeProfit && !stopLoss) {
      toast.error('Enter at least one of Take Profit or Stop Loss price.');
      return;
    }
    setTpSlModal(prev => prev ? { ...prev, submitting: true } : null);
    toast.loading('Setting TP/SL...', { id: 'tpsl' });
    try {
      const side = (parseFloat(pos.active_pos) || 0) >= 0 ? 'BUY' : 'SELL';
      const quantity = Math.abs(parseFloat(pos.active_pos) || 0);
      const data = await ipcService.setTpSl({
        pair: pos.pair,
        side,
        quantity,
        leverage: parseFloat(pos.leverage) || 1,
        marginCurrency: pos.margin_currency_short_name,
        takeProfitPrice: takeProfit ? Number(takeProfit) : null,
        stopLossPrice: stopLoss ? Number(stopLoss) : null,
      });
      if (data.success) {
        toast.success('TP/SL orders placed successfully!', { id: 'tpsl' });
        setTpSlModal(null);
      } else {
        toast.error(`Failed: ${JSON.stringify(data.error)}`, { id: 'tpsl' });
        setTpSlModal(prev => prev ? { ...prev, submitting: false } : null);
      }
    } catch {
      toast.error('An error occurred.', { id: 'tpsl' });
      setTpSlModal(prev => prev ? { ...prev, submitting: false } : null);
    }
  };

  useEffect(() => {
    ipcService.getBalance()
      .then(data => {
        if (data.success) {
          setBalances(data.balances);
        }
      })
      .catch(err => console.error("Failed to fetch balances", err));

    ipcService.getPositions()
      .then(data => {
        if (data.success) {
          setPositions(data.positions);
        }
        setLoadingPositions(false);
      })
      .catch(err => {
        console.error("Failed to fetch positions", err);
        setLoadingPositions(false);
      });

    ipcService.getAssets()
      .then(assets => {
        if (assets && assets.length > 0) {
          setAvailableAssets(assets);
        }
      })
      .catch(err => console.error("Failed to fetch assets", err));
  }, []);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* TP/SL Modal */}
      {tpSlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Target size={18} className="text-amber-400" />
                Set TP / SL — {tpSlModal.pos.pair}
              </h3>
              <button onClick={() => setTpSlModal(null)} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500">Position TPSL closes your entire position at market when the trigger price is hit. Leave a field empty to skip it.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-green-400">Take Profit Price</label>
                <input
                  type="number" step="any"
                  value={tpSlModal.takeProfit}
                  onChange={e => setTpSlModal(prev => prev ? { ...prev, takeProfit: e.target.value } : null)}
                  placeholder="e.g. 90000"
                  className="input-field py-2 text-sm border-green-500/30 focus:border-green-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-red-400">Stop Loss Price</label>
                <input
                  type="number" step="any"
                  value={tpSlModal.stopLoss}
                  onChange={e => setTpSlModal(prev => prev ? { ...prev, stopLoss: e.target.value } : null)}
                  placeholder="e.g. 75000"
                  className="input-field py-2 text-sm border-red-500/30 focus:border-red-500"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-gray-700/50 text-xs text-gray-500 space-y-0.5">
              <div className="flex justify-between"><span>Entry Price</span><span className="font-mono">{parseFloat(tpSlModal.pos.avg_price || 0).toFixed(4)}</span></div>
              <div className="flex justify-between"><span>Mark Price</span><span className="font-mono">{parseFloat(tpSlModal.pos.mark_price || 0).toFixed(4)}</span></div>
              <div className="flex justify-between"><span>Size</span><span className="font-mono">{Math.abs(parseFloat(tpSlModal.pos.active_pos || 0))}</span></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setTpSlModal(null)}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-white/5 transition-all text-sm"
              >Cancel</button>
              <button
                onClick={handleSetTpSl}
                disabled={tpSlModal.submitting}
                className="flex-1 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all text-sm font-bold disabled:opacity-50"
              >{tpSlModal.submitting ? 'Placing...' : 'Confirm TP/SL'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Balance Summary */}
      <div className="flex justify-between items-center -mb-4">
        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-widest text-xs">Account Overview</h2>
        <button 
          onClick={() => setShowBalances(!showBalances)}
          className="p-2 rounded-full hover:bg-white/5 text-gray-400 transition-all"
          title={showBalances ? "Hide Balances" : "Show Balances"}
        >
          {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 flex items-center justify-between overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 text-green-500/10 rotate-12">
            <Wallet size={120} />
          </div>
          <div>
            <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-1">USDT Balance</h3>
            <div className="text-3xl font-mono font-bold text-green-400">
              {showBalances ? (balances ? balances.USDT.toFixed(2) : '0.00') : '••••••'} <span className="text-xs text-gray-500">USDT</span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs ${config?.quoteCurrencies?.includes('USDT') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-gray-500'}`}>
            {config?.quoteCurrencies?.includes('USDT') ? 'Trading Enabled' : 'Balance Only'}
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center justify-between overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 text-blue-500/10 rotate-12">
            <Wallet size={120} />
          </div>
          <div>
            <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-1">INR Balance</h3>
            <div className="text-3xl font-mono font-bold text-blue-400">
              {showBalances ? `₹${balances ? balances.INR.toFixed(2) : '0.00'}` : '₹ ••••••'}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs ${config?.quoteCurrencies?.includes('INR') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-gray-500'}`}>
            {config?.quoteCurrencies?.includes('INR') ? 'Trading Enabled' : 'Balance Only'}
          </div>
        </div>
      </div>
 
      {/* Strategy Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">EMA Strategy</span>
          <div className="text-lg font-bold">
            {config?.emaPeriod || 15}m <span className="text-gray-500 text-sm font-normal">/</span> {config?.dropThreshold || 1}% <span className="text-xs text-gray-500 font-normal ml-1">drop</span>
          </div>
        </div>
        <div className={`glass-panel p-4 flex flex-col justify-center border-l-4 ${config?.autoOrderEnabled ? 'border-l-purple-500' : 'border-l-gray-600'}`}>
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Position Risk</span>
          <div className="text-lg font-bold text-gray-300">
            {config?.autoOrderEnabled ? (
              <>
                {config?.orderPercentage || 0}% <span className="text-gray-500 text-sm font-normal">size</span> <span className="text-gray-500 text-sm font-normal mx-1">@</span> {config?.leverage || 1}x
              </>
            ) : (
              <span className="text-gray-500 italic text-sm">Execution Disabled</span>
            )}
          </div>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-center border-l-4 border-l-orange-500">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider">System Status</span>
            <span className={`w-2 h-2 rounded-full ${status.includes('Monitoring') ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-yellow-500'}`}></span>
          </div>
          <div className="text-lg font-bold">
            {(config?.pairs || []).length} Assets <span className="text-xs text-gray-500 font-normal ml-1">({(config?.pairs || []).join(', ')})</span>
          </div>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-center border-l-4 border-l-red-500">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Execution</span>
          <div className={`text-lg font-bold ${config?.autoOrderEnabled ? 'text-green-400' : 'text-red-400'}`}>
            {config?.autoOrderEnabled ? 'AUTO-ORDER LIVE' : 'MANUAL ONLY'}
          </div>
        </div>
      </div>



      {!config ? (
        <div className="glass-panel p-12 text-center text-gray-400">
          <Activity className="animate-pulse mx-auto mb-4" size={32} />
          Loading configuration...
        </div>
      ) : (
        <>
          {/* Last updated + live indicator */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-gray-500 -mt-4">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot inline-block"></span>
              Last updated {lastUpdated.toLocaleTimeString()} · refreshes every 60s
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(config.pairs || []).length === 0 ? (
              <div className="lg:col-span-3 glass-panel p-10 flex flex-col items-center justify-center gap-3 text-center border-dashed">
                <Zap size={36} className="text-blue-500/50" />
                <p className="font-semibold text-gray-300">No assets being monitored</p>
                <p className="text-sm text-gray-500">Add assets in Settings to start watching prices.</p>
              </div>
            ) : (
              (config.pairs || []).map((asset: string) => {
                const price = currentPrices[asset];
                const ema = currentEmas[asset];
                const drop = price && ema ? ((price - ema) / ema) * 100 : null;
                const triggered = drop !== null && drop <= -config.dropThreshold;
                // Proximity: 0% = safe, 100% = at threshold
                const proximity = drop !== null ? Math.min(100, Math.max(0, (-drop / config.dropThreshold) * 100)) : 0;
                const barColor = proximity < 50 ? '#22c55e' : proximity < 80 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={asset} className={`glass-panel p-6 relative overflow-hidden flex flex-col justify-center transition-all ${triggered ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : ''}`}>
                    <TrendingDown className="absolute -bottom-4 -right-4 text-blue-500/10" size={100} />
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold">{asset}/USDT</h3>
                      {triggered && (
                        <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">⚡ ALERT</span>
                      )}
                    </div>

                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs text-gray-400">Price</span>
                      <span className="text-2xl font-mono">{price ? `$${price.toFixed(4)}` : <span className="skeleton h-7 w-28 inline-block" />}</span>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                      <span className="text-xs text-gray-400">{config.emaPeriod}m EMA</span>
                      <span className="text-lg font-mono text-blue-400">{ema ? `$${ema.toFixed(4)}` : <span className="skeleton h-5 w-24 inline-block" />}</span>
                    </div>

                    {price && ema && (
                      <>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Drop vs EMA</span>
                          <span className={triggered ? 'text-red-400 font-bold' : proximity > 50 ? 'text-amber-400' : 'text-gray-300'}>
                            {drop!.toFixed(2)}%
                          </span>
                        </div>
                        <div className="threshold-bar">
                          <div className="threshold-bar-fill" style={{ width: `${proximity}%`, backgroundColor: barColor }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                          <span>0%</span>
                          <span>Threshold: -{config.dropThreshold}%</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Positions */}
            <div className="glass-panel p-6 lg:col-span-2">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-400" /> Active Positions
              </h2>
              {loadingPositions ? (
                <div className="space-y-3">
                  {[1,2].map(i => <div key={i} className="skeleton h-12 w-full" />)}
                </div>
              ) : positions.filter(p => parseFloat(p.active_pos) !== 0).length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-3 text-center border border-dashed border-gray-700/60 rounded-xl">
                  <PackageOpen size={36} className="text-gray-600" />
                  <p className="font-medium text-gray-400">No Open Positions</p>
                  <p className="text-xs text-gray-600">Your futures positions on CoinDCX will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left text-sm border-separate border-spacing-x-2">
                    <thead className="text-gray-400 border-b border-gray-700">
                      <tr>
                        <th className="pb-3 whitespace-nowrap px-2">Market</th>
                        <th className="pb-3 whitespace-nowrap px-2 text-center">Wallet</th>
                        <th className="pb-3 whitespace-nowrap px-2 text-center">Side</th>
                        <th className="pb-3 whitespace-nowrap px-2 text-center">Leverage</th>
                        <th className="pb-3 whitespace-nowrap px-2">Size</th>
                        <th className="pb-3 whitespace-nowrap px-2">Entry Price</th>
                        <th className="pb-3 whitespace-nowrap px-2">Liq Price</th>
                        <th className="pb-3 whitespace-nowrap px-2">Mark Price</th>
                        <th className="pb-3 whitespace-nowrap px-2 text-right">PNL</th>
                        <th className="pb-3 whitespace-nowrap px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions
                        .filter(pos => parseFloat(pos.active_pos) !== 0)
                        .map((pos, i) => {
                          const side = (parseFloat(pos.active_pos) || 0) >= 0 ? 'BUY' : 'SELL';
                          const quantity = Math.abs(parseFloat(pos.active_pos) || 0);
                          const entryPrice = parseFloat(pos.avg_price) || 0;
                          const markPrice = parseFloat(pos.mark_price) || 0;
                          const liqPrice = parseFloat(pos.liquid_price) || 0;
                          const leverage = pos.leverage || '1';
                          
                          // API PNL fallback to manual calculation
                          let pnl = parseFloat(pos.pnl || pos.unrealized_pnl) || 0;
                          if (pnl === 0 && entryPrice > 0 && markPrice > 0) {
                            if (side === 'BUY') {
                              pnl = (markPrice - entryPrice) * quantity;
                            } else {
                              pnl = (entryPrice - markPrice) * quantity;
                            }
                          }
                          
                          const quote = (pos.pair || '').split('_')[1] || 'USDT';

                          return (
                            <tr key={i} className="border-b border-gray-800/30 hover:bg-white/5 transition-colors">
                              <td className="py-4 font-bold whitespace-nowrap px-2">{pos.pair}</td>
                              <td className="py-4 whitespace-nowrap px-2 text-center">
                                <span className="px-2 py-1 rounded bg-slate-800 text-xs border border-slate-700">
                                  {pos.margin_currency_short_name}
                                </span>
                              </td>
                              <td className={`py-4 whitespace-nowrap px-2 text-center font-bold ${side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                {side}
                              </td>
                              <td className="py-4 whitespace-nowrap px-2 text-center">
                                <span className="text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20">
                                  {leverage}x
                                </span>
                              </td>
                              <td className="py-4 font-mono whitespace-nowrap px-2">{quantity}</td>
                              <td className="py-4 font-mono whitespace-nowrap px-2">{entryPrice.toFixed(4)}</td>
                              <td className="py-4 font-mono whitespace-nowrap px-2 text-red-300">
                                {liqPrice > 0 ? liqPrice.toFixed(4) : 'Isolated'}
                              </td>
                              <td className="py-4 font-mono whitespace-nowrap px-2 text-gray-400">{markPrice.toFixed(4)}</td>
                              <td className={`py-4 text-right whitespace-nowrap px-2 font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pnl.toFixed(2)} {quote}
                              </td>
                              <td className="py-4 text-right whitespace-nowrap px-2">
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => setTpSlModal({ pos, takeProfit: '', stopLoss: '', submitting: false })}
                                    className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-xs font-bold"
                                  >TP/SL</button>
                                  <button
                                    onClick={() => handleClosePosition(pos)}
                                    className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-xs font-bold"
                                  >CLOSE</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Trade Terminal */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Zap size={18} className="text-amber-400" /> Quick Trade
              </h2>
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Asset</label>
                    <select
                      value={tradeForm.asset}
                      onChange={(e) => setTradeForm({...tradeForm, asset: e.target.value})}
                      className="input-field py-2 text-sm bg-slate-800 w-full"
                    >
                      {availableAssets.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Quote</label>
                    <select 
                      value={tradeForm.quoteCurrency}
                      onChange={(e) => setTradeForm({...tradeForm, quoteCurrency: e.target.value})}
                      className="input-field py-2 text-sm bg-slate-800 w-full"
                    >
                      <option value="USDT">USDT</option>
                      <option value="INR">INR</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-800/50 p-1 rounded-lg">
                  <button type="button" onClick={() => setTradeForm({...tradeForm, side: 'buy'})} className={`py-2 text-sm rounded-md font-bold transition-colors ${tradeForm.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:bg-slate-700/50'}`}>BUY (Long)</button>
                  <button type="button" onClick={() => setTradeForm({...tradeForm, side: 'sell'})} className={`py-2 text-sm rounded-md font-bold transition-colors ${tradeForm.side === 'sell' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:bg-slate-700/50'}`}>SELL (Short)</button>
                </div>

                <div className="flex gap-4 border-b border-gray-700 pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={tradeForm.orderType === 'market_order'} onChange={() => setTradeForm({...tradeForm, orderType: 'market_order'})} className="accent-blue-500" /> Market
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={tradeForm.orderType === 'limit_order'} onChange={() => setTradeForm({...tradeForm, orderType: 'limit_order'})} className="accent-blue-500" /> Limit
                  </label>
                </div>

                {tradeForm.orderType === 'limit_order' && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Limit Price</label>
                    <input 
                      type="number" step="any"
                      value={tradeForm.price}
                      onChange={(e) => setTradeForm({...tradeForm, price: e.target.value})}
                      className="input-field py-2 text-sm" placeholder={`Price in ${tradeForm.quoteCurrency}`}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-400">Position Size</label>
                    <button type="button" onClick={() => setTradeForm({...tradeForm, usePercentage: !tradeForm.usePercentage})} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      Use {tradeForm.usePercentage ? 'Asset Amount' : 'Balance %'}
                    </button>
                  </div>
                  {tradeForm.usePercentage ? (
                    <div className="space-y-3 bg-slate-800/30 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Percent of {tradeForm.quoteCurrency} Balance</span>
                        <span className="font-bold text-white">{tradeForm.percentage}%</span>
                      </div>
                      <input 
                        type="range" min="1" max="100" step="1"
                        value={tradeForm.percentage}
                        onChange={(e) => setTradeForm({...tradeForm, percentage: e.target.value})}
                        className="w-full accent-blue-500"
                      />
                      <div className="flex justify-between gap-2">
                        {[25, 50, 75, 100].map(pct => (
                          <button type="button" key={pct} onClick={() => setTradeForm({...tradeForm, percentage: pct.toString()})} className={`flex-1 py-1 text-xs rounded border transition-colors ${tradeForm.percentage === pct.toString() ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-gray-400'}`}>{pct}%</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input 
                      type="number" step="any"
                      value={tradeForm.quantity}
                      onChange={(e) => setTradeForm({...tradeForm, quantity: e.target.value})}
                      className="input-field py-2 text-sm w-full" placeholder={`e.g. 0.01 ${tradeForm.asset}`}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-400">Leverage ({tradeForm.leverage}x)</label>
                  </div>
                  <div className="flex gap-2 mb-1">
                    {[1, 3, 5, 10, 20].map(lv => (
                      <button
                        type="button"
                        key={lv}
                        onClick={() => setTradeForm({...tradeForm, leverage: lv.toString()})}
                        className={`flex-1 py-0.5 text-xs rounded border transition-colors ${Number(tradeForm.leverage) === lv ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-gray-400'}`}
                      >{lv}x</button>
                    ))}
                  </div>
                  <input
                    type="range" min="1" max="20" step="0.1"
                    value={tradeForm.leverage}
                    onChange={(e) => setTradeForm({...tradeForm, leverage: e.target.value})}
                    className="w-full accent-blue-500"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={placingOrder}
                  className={`w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 ${tradeForm.side === 'buy' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                >
                  {placingOrder ? 'Placing Order...' : `${tradeForm.side === 'buy' ? 'Buy / Long' : 'Sell / Short'} ${tradeForm.asset}`}
                </button>

                {/* Trade Summary */}
                <div className="pt-2 border-t border-gray-700/50 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Market Price:</span>
                    <span className="font-mono text-gray-300">
                      {selectedMarketPrice ? `${selectedMarketPrice.toFixed(4)} ${tradeForm.quoteCurrency}` : 'Loading...'}
                    </span>
                  </div>
                  
                  {(() => {
                    if (!selectedMarketPrice && (!tradeForm.price || tradeForm.orderType !== 'limit_order')) return null;
                    const calcPrice = tradeForm.orderType === 'limit_order' && tradeForm.price ? Number(tradeForm.price) : selectedMarketPrice;
                    
                    let margin = 0;
                    let posSize = 0;

                    if (tradeForm.usePercentage && balances) {
                      const availableBalance = balances[tradeForm.quoteCurrency as 'USDT' | 'INR'] || 0;
                      margin = availableBalance * (Number(tradeForm.percentage) / 100);
                      posSize = (margin * Number(tradeForm.leverage)) / (calcPrice || 1);
                    } else {
                      posSize = Number(tradeForm.quantity || 0);
                      margin = (posSize * (calcPrice || 0)) / Number(tradeForm.leverage || 1);
                    }
                    
                    return (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Position Size:</span>
                          <span className="font-mono text-gray-300">
                            {posSize > 0 ? `${posSize.toFixed(3)} ${tradeForm.asset}` : '---'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-400">Margin Required:</span>
                          <span className="text-blue-400">
                            {margin > 0 ? `~${margin.toFixed(2)} ${tradeForm.quoteCurrency}` : '---'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold mb-4">Active Configuration</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <span className="text-gray-400 block">Monitored Assets</span>
                {(config.pairs || []).length > 0 ? (config.pairs || []).join(', ') : 'None'}
              </div>
              <div>
                <span className="text-gray-400 block">Quote Currency</span>
                <span className="font-bold text-blue-400">{config.quoteCurrency || 'USDT'}</span>
              </div>
              <div>
                <span className="text-gray-400 block">EMA Period</span>
                {config.emaPeriod || 15}m
              </div>
              <div>
                <span className="text-gray-400 block">Size</span>
                {config.autoOrderEnabled ? `${config.orderPercentage || 0}%` : 'N/A'}
              </div>
              <div>
                <span className="text-gray-400 block">Leverage</span>
                {config.autoOrderEnabled ? `${config.leverage || 1}x` : 'N/A'}
              </div>
              <div>
                <span className="text-gray-400 block">Auto-Order</span>
                <span className={config.autoOrderEnabled ? 'text-green-400' : 'text-red-400'}>
                  {config.autoOrderEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="mt-6">
              <Link to="/config">
                <button className="btn-primary w-full md:w-auto">Edit Configuration</button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
