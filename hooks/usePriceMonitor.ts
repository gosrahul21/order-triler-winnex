import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchBinanceKlines, calculateEMA } from '@/lib/binance';
import toast from 'react-hot-toast';

export function usePriceMonitor() {
  const [config, setConfig] = useState<any>(null);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [currentEmas, setCurrentEmas] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>('Initializing...');
  const [lastTriggerTimes, setLastTriggerTimes] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setStatus('Monitoring...');
        }
      })
      .catch(err => {
        console.error('Error fetching config', err);
        setStatus('Error loading config');
      });
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
    }
  };

  const triggerAlert = useCallback(async (price: number, ema: number, pair: string) => {
    const now = Date.now();
    // Prevent triggering multiple times for the SAME pair in a short window (5 minutes)
    if (lastTriggerTimes[pair] && now - lastTriggerTimes[pair] < 5 * 60 * 1000) return;
    
    setLastTriggerTimes(prev => ({ ...prev, [pair]: now }));

    // Desktop Notification (OS)
    if (config?.desktopNotificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`Price Alert: ${pair}`, {
        body: `Price ${price} dropped below ${ema.toFixed(2)} (Threshold: ${config.dropThreshold}%)`,
      });
    }

    // UI Notification (Toast)
    if (config?.desktopNotificationsEnabled) {
      toast.error(`Price Drop Alert: ${pair}\nPrice: ${price}\nEMA: ${ema.toFixed(2)}`, {
        duration: 5000,
        icon: '🚨',
      });
    }

    // Call API Trigger (Telegram + CoinDCX)
    try {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, ema, pair }),
      });
      const data = await res.json();
      console.log(`Trigger API response for ${pair}:`, data);

      if (data.success) {
        // Update local config to stop monitoring this pair immediately
        setConfig((prev: any) => {
          if (!prev) return prev;
          const baseAsset = pair.replace('USDT', '');
          return {
            ...prev,
            pairs: (prev.pairs || []).filter((p: string) => p !== baseAsset)
          };
        });
        toast.success(`Trade triggered for ${pair}. Monitoring stopped.`);
      }
    } catch (e) {
      console.error('Failed to call trigger API', e);
    }
  }, [config, lastTriggerTimes]);

  useEffect(() => {
    const pairsToMonitor = config?.pairs || (config?.pair ? [config.pair.replace('USDT', '')] : []);
    if (!config || pairsToMonitor.length === 0) {
      setStatus(config ? 'Idle (No pairs monitored)' : 'Initializing...');
      return;
    }

    const poll = async () => {
      try {
        const limit = Math.max(100, config.emaPeriod * 2);
        
        const newPrices: Record<string, number> = {};
        const newEmas: Record<string, number> = {};

        await Promise.all(pairsToMonitor.map(async (asset: string) => {
          const symbol = `${asset}USDT`;
          const klines = await fetchBinanceKlines(symbol, '15m', limit);
          
          if (klines.length > 0) {
            const prices = klines.map((k: { close: any; }) => k.close);
            const latestPrice = prices[prices.length - 1];
            const ema = calculateEMA(prices, config.emaPeriod);
            
            newPrices[asset] = latestPrice;
            if (ema) newEmas[asset] = ema;

            if (ema) {
              const dropThresholdValue = ema * (1 - (config.dropThreshold / 100));
              if (latestPrice < dropThresholdValue) {
                triggerAlert(latestPrice, ema, symbol);
              }
            }
          }
        }));

        setCurrentPrices(newPrices);
        setCurrentEmas(newEmas);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    poll(); // Initial poll
    const intervalId = setInterval(poll, 60000); // Poll every minute

    return () => clearInterval(intervalId);
  }, [config, triggerAlert]);

  return { config, currentPrices, currentEmas, status, lastUpdated, requestNotificationPermission };
}
