import crypto from 'crypto';
import axios from 'axios';

const BASE_URL = 'https://api.coindcx.com';

function getHeaders(apiKey: string, signature: string) {
  return {
    'Content-Type': 'application/json',
    'X-AUTH-APIKEY': apiKey,
    'X-AUTH-SIGNATURE': signature,
  };
}

export async function fetchCoinDCXBalances() {
  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Credentials missing' };
  }

  const body = {
    timestamp: Math.floor(Date.now()),
  };
  
  const payload = Buffer.from(JSON.stringify(body)).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  
  try {
    const response = await axios.request({
      url: `${BASE_URL}/exchange/v1/derivatives/futures/wallets`,
      method: "GET",
      headers: getHeaders(apiKey, signature),
      data: body,
    });
    
    const data = response.data;
    
    // Structure: Array of { currency: string, balance: number, ... }
    const usdt = data.find((b: any) => b.currency_short_name === 'USDT');
    const inr = data.find((b: any) => b.currency_short_name === 'INR');

    return { 
      success: true, 
      balances: {
        USDT: usdt ? parseFloat(usdt.balance) : 0,
        INR: inr ? parseFloat(inr.balance) : 0
      }
    };
  } catch(e: any) {
    console.error('CoinDCX Balance Fetch Error:', e.response?.data || e.message);
    return { success: false, error: e.response?.data || e.message };
  }
}

export async function fetchCoinDCXMarketPrice(market: string) {
  try {
    const res = await axios.get(`${BASE_URL}/exchange/ticker`);
    const data = res.data;
    // For futures like 'B-BTC_USDT', the ticker endpoint uses 'BTCUSDT' (spot price approx) or similar
    const symbol = market.split('_').join('').slice(2);
    const ticker = data.find((t: any) => t.market === symbol);
    return ticker ? parseFloat(ticker.last_price) : null;
  } catch (e) {
    console.error('CoinDCX Ticker Error:', e);
    return null;
  }
}

export async function fetchCoinDCXAvailableAssets() {
  try {
    // Fetch actual futures active instruments directly from derivatives API
    const res = await axios.get(`${BASE_URL}/exchange/v1/derivatives/futures/data/active_instruments`);
    const data = res.data; // e.g. ['B-BTC_USDT', 'B-XAG_USDT']
    
    const assets = new Set<string>();
    if (Array.isArray(data)) {
      data.forEach((market: string) => {
        if (market.startsWith('B-')) {
          const parts = market.split('_');
          if (parts.length === 2) {
            const baseAsset = parts[0].replace('B-', '');
            assets.add(baseAsset);
          }
        }
      });
    }
    
    return Array.from(assets).sort();
  } catch (e) {
    console.error('CoinDCX Fetch Assets Error:', e);
    return [];
  }
}

export async function placeCoinDCXFuturesOrder(asset: string, quoteCurrency: string, side: 'buy' | 'sell', price: number, quantity: number, leverage: number, orderType: 'limit_order' | 'market_order' = 'market_order') {
  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Credentials missing' };
  }
  
  const market = `B-${asset}_${quoteCurrency}`;

  const order: any = {
    side: side,
    pair: market,
    order_type: orderType,
    total_quantity: Number(quantity.toFixed(3)),
    leverage: leverage || 1,
    time_in_force: "good_till_cancel",
    hidden: false,
    post_only: false,
    margin_currency_short_name: quoteCurrency
  };

  if (orderType === 'limit_order') {
    order.price = price;
  }

  const body = {
    timestamp: Math.floor(Date.now()),
    order: order
  };

  
  const payload = Buffer.from(JSON.stringify(body)).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/exchange/v1/derivatives/futures/orders/create`,
      body,
      {
        headers: getHeaders(apiKey, signature),
      }
    );
    return { success: true, data: response.data };
  } catch(e: any) {
    console.error('CoinDCX Order Error:', e.response?.data || e.message);
    return { success: false, error: e.response?.data || e.message };
  }
}

export async function fetchCoinDCXPositions() {
  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Credentials missing' };
  }

  const body = {
    timestamp: Math.floor(Date.now()),
    page: 1,
    size: 50,
    margin_currency_short_name: ["USDT", "INR"]
  };
  
  const payload = Buffer.from(JSON.stringify(body)).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/exchange/v1/derivatives/futures/positions`,
      body,
      {
        headers: getHeaders(apiKey, signature),
      }
    );

    return { success: true, positions: Array.isArray(response.data) ? response.data : [] };
  } catch(e: any) {
    console.error('CoinDCX Positions Error:', e.response?.data || e.message);
    return { success: false, error: e.response?.data || e.message };
  }
}

export async function closeCoinDCXPosition(pair: string, side: 'buy' | 'sell', quantity: number, marginCurrency: string) {
  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Credentials missing' };
  }

  const closeSide = side === 'buy' ? 'sell' : 'buy';

  const body = {
    timestamp: Math.floor(Date.now()),
    order: {
      side: closeSide,
      pair: pair,
      order_type: "market_order",
      total_quantity: Number(Math.abs(quantity).toFixed(3)),
      leverage: 1,
      notification: "email_notification",
      margin_currency_short_name: marginCurrency
    }
  };
  
  const payload = Buffer.from(JSON.stringify(body)).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/exchange/v1/derivatives/futures/orders/create`,
      body,
      {
        headers: getHeaders(apiKey, signature),
      }
    );
    return { success: true, data: response.data };
  } catch(e: any) {
    console.error('CoinDCX Close Error:', e.response?.data || e.message);
    return { success: false, error: e.response?.data || e.message };
  }
}

export async function setCoinDCXTpSl(
  pair: string,
  side: 'buy' | 'sell',
  quantity: number,
  leverage: number,
  marginCurrency: string,
  takeProfitPrice: number | null,
  stopLossPrice: number | null
) {
  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;

  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Credentials missing' };
  }

  // Closing side is opposite to position side
  const closeSide = side === 'buy' ? 'sell' : 'buy';
  const results: any[] = [];

  const placeOrder = async (orderType: 'take_profit_market' | 'stop_market', triggerPrice: number) => {
    const body = {
      timestamp: Date.now(),
      order: {
        side: closeSide,
        pair,
        order_type: orderType,
        stop_price: triggerPrice,
        total_quantity: Number(Math.abs(quantity).toFixed(3)),
        leverage: leverage || 1,
        margin_currency_short_name: marginCurrency,
      },
    };

    const payload = Buffer.from(JSON.stringify(body)).toString();
    const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');

    const response = await axios.post(
      `${BASE_URL}/exchange/v1/derivatives/futures/orders/create`,
      body,
      { headers: getHeaders(apiKey, signature) }
    );
    return response.data;
  };

  try {
    if (takeProfitPrice) {
      const tp = await placeOrder('take_profit_market', takeProfitPrice);
      results.push({ type: 'take_profit', data: tp });
    }
    if (stopLossPrice) {
      const sl = await placeOrder('stop_market', stopLossPrice);
      results.push({ type: 'stop_loss', data: sl });
    }
    return { success: true, results };
  } catch (e: any) {
    console.error('CoinDCX TP/SL Error:', e.response?.data || e.message);
    return { success: false, error: e.response?.data || e.message };
  }
}
