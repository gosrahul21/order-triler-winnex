export async function fetchBinanceKlines(symbol: string, interval: string = '15m', limit: number = 100) {
  try {
    // 15m candlestick data from Binance Futures
    const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.map((k: any) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
    }));
  } catch (error) {
    console.error('Failed to fetch Binance klines:', error);
    return [];
  }
}

export async function fetchBinancePrice(symbol: string) {
  try {
    let querySymbol = symbol;
    let isINR = false;

    if (symbol.endsWith('INR')) {
      querySymbol = symbol.replace('INR', 'USDT');
      isINR = true;
    }

    const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${querySymbol}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    let price = parseFloat(data.price);

    // If it was an INR request, approximate by multiplying with typical USDTINR rate (e.g., 90) or fetch from CoinDCX
    if (isINR) {
      // Best effort static conversion for Binance UI bridging, 
      // ideally we would fetch live USDTINR from CoinDCX spot but this keeps it fast
      price = price * 96.6; 
    }
    console.log(symbol,price,"price of symbol")
    return price;
  } catch (error) {
    console.error(`Failed to fetch Binance price for ${symbol}:`, error);
    return null;
  }
}

export function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  
  const multiplier = 2 / (period + 1);
  
  // Calculate SMA for the first period to seed the EMA
  const initialPrices = prices.slice(0, period);
  let ema = initialPrices.reduce((a, b) => a + b, 0) / period;
  
  // Calculate EMA for the rest of the array
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}
