"use client";
import { useState, useEffect } from 'react';
import { Save, AlertCircle, Trash2 } from 'lucide-react';

const AVAILABLE_PAIRS = ['BTC', 'XAG', 'PAXG', 'XRP'];

export default function ConfigPage() {
  const [formData, setFormData] = useState({
    pairs: [],
    emaPeriod: 15,
    dropThreshold: 1,
    autoOrderEnabled: false,
    telegramEnabled: true,
    desktopNotificationsEnabled: true,
    orderPercentage: 25,
    leverage: 1.0,
    quoteCurrencies: ['USDT','INR'],
    telegramChatId: ''
  });
  const [status, setStatus] = useState({ loading: true, saving: false, message: '' });

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          const loadedPairs = data.config.pairs || (data.config.pair ? [data.config.pair.replace('USDT', '')] : ['BTC']);
          setFormData(prev => ({ 
            ...prev, 
            ...data.config, 
            pairs: loadedPairs,
            quoteCurrencies: data.config.quoteCurrencies?.length ? data.config.quoteCurrencies : ['USDT']
          }));
        }
        setStatus(s => ({ ...s, loading: false }));
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: target.checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePairToggle = (pair: string) => {
    setFormData(prev => {
      const currentPairs = [...prev.pairs];
      if (currentPairs.includes(pair)) {
        return { ...prev, pairs: currentPairs.filter(p => p !== pair) };
      } else {
        return { ...prev, pairs: [...currentPairs, pair] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(s => ({ ...s, saving: true, message: '' }));
    
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      
      if (data.success) {
        setStatus(s => ({ ...s, saving: false, message: 'Configuration saved successfully!' }));
      } else {
        setStatus(s => ({ ...s, saving: false, message: 'Failed to save configuration.' }));
      }
    } catch (err) {
      setStatus(s => ({ ...s, saving: false, message: 'An error occurred while saving.' }));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to CLEAR the entire configuration? This will stop all monitoring and trades immediately.')) return;
    
    setStatus(s => ({ ...s, saving: true, message: '' }));
    try {
      const res = await fetch('/api/config', { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        setFormData({
          pairs: [],
          emaPeriod: 15,
          dropThreshold: 1,
          autoOrderEnabled: false,
          telegramEnabled: false,
          desktopNotificationsEnabled: false,
          orderPercentage: 25,
          leverage: 1.0,
          quoteCurrencies: ['USDT'],
          telegramChatId: ''
        });
        setStatus(s => ({ ...s, saving: false, message: 'Configuration cleared successfully!' }));
      } else {
        setStatus(s => ({ ...s, saving: false, message: 'Failed to clear configuration.' }));
      }
    } catch (err) {
      setStatus(s => ({ ...s, saving: false, message: 'An error occurred while deleting.' }));
    }
  };

  if (status.loading) return <div className="p-8 text-center text-gray-400">Loading configuration...</div>;

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="glass-panel p-8">
        <h1 className="text-3xl font-bold mb-6">System Configuration</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Monitored Assets (Binance USDT)</label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PAIRS.map(pair => (
                <button
                  key={pair}
                  type="button"
                  onClick={() => handlePairToggle(pair)}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    formData.pairs.includes(pair) 
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                      : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:border-slate-500'
                  }`}
                >
                  {pair}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Drop Threshold (%)</label>
              <input 
                type="number" 
                step="0.01"
                name="dropThreshold" 
                value={formData.dropThreshold} 
                onChange={handleChange} 
                className="input-field" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">EMA Period (min)</label>
              <input 
                type="number" 
                name="emaPeriod" 
                value={formData.emaPeriod} 
                onChange={handleChange} 
                className="input-field" 
              />
            </div>
          </div>

          <hr className="border-gray-700 my-6" />

          <div className="space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
              <AlertCircle size={20}/> Execution & Risk
            </h3>
            <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-gray-200">Auto-Order Execution</div>
                <p className="text-xs text-gray-500">Enable to place orders automatically on CoinDCX.</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" name="autoOrderEnabled" checked={formData.autoOrderEnabled} onChange={handleChange} />
                <span className="slider"></span>
              </label>
            </div>

            {formData.autoOrderEnabled && (
              <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Quote Currencies (Trade Markets)</label>
                    <div className="flex gap-4">
                      {['USDT', 'INR'].map(currency => (
                        <label key={currency} className="flex items-center gap-2 cursor-pointer p-2 rounded bg-slate-800/50 border border-slate-700 hover:border-slate-500 transition-colors">
                          <input 
                            type="checkbox" 
                            name="quoteCurrencies" 
                            value={currency} 
                            checked={formData.quoteCurrencies?.includes(currency)} 
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const val = e.target.value;
                              setFormData(prev => {
                                const current = prev.quoteCurrencies || [];
                                if (checked) {
                                  return { ...prev, quoteCurrencies: [...current, val] };
                                } else {
                                  return { ...prev, quoteCurrencies: current.filter(c => c !== val) };
                                }
                              });
                            }}
                            className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded"
                          />
                          <span className="text-sm font-medium">{currency}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 italic">Select one or both to execute trades in these markets.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Order Size (% of Balance)</label>
                    <select 
                      name="orderPercentage" 
                      value={formData.orderPercentage} 
                      onChange={handleChange} 
                      className="input-field bg-slate-800"
                    >
                      <option value="25">25%</option>
                      <option value="50">50%</option>
                      <option value="75">75%</option>
                      <option value="100">100%</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Leverage</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="1"
                      name="leverage" 
                      value={formData.leverage} 
                      onChange={handleChange} 
                      className="input-field" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-700 my-6" />

          <div className="space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
              <Save size={20}/> Notifications
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-200">Desktop Notifications</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" name="desktopNotificationsEnabled" checked={formData.desktopNotificationsEnabled} onChange={handleChange} />
                  <span className="slider"></span>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-200">Telegram Notifications</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" name="telegramEnabled" checked={formData.telegramEnabled} onChange={handleChange} />
                  <span className="slider"></span>
                </label>
              </div>

              {formData.telegramEnabled && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-medium text-gray-300">Telegram Chat ID</label>
                  <input 
                    type="text" 
                    name="telegramChatId" 
                    value={formData.telegramChatId} 
                    onChange={handleChange} 
                    className="input-field" 
                    placeholder="Enter your Telegram Chat ID"
                  />
                  <p className="text-xs text-gray-500 italic">You can get this from @userinfobot or similar.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <button 
              type="submit" 
              disabled={status.saving || formData.pairs.length === 0} 
              className="btn-primary flex-1 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> {status.saving ? 'Saving...' : 'Save Configuration'}
            </button>
            
            <button 
              type="button"
              onClick={handleDelete}
              disabled={status.saving}
              className="px-6 py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex justify-center items-center gap-2 disabled:opacity-50 font-bold"
            >
              <Trash2 size={18} /> Clear Config
            </button>
          </div>
          {status.message && (
            <p className={`mt-4 text-center text-sm ${status.message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
              {status.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
