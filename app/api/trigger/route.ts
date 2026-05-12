import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Config from '@/lib/models/Config';
import { sendTelegramMessage } from '@/lib/telegram';
import { fetchCoinDCXBalances, fetchCoinDCXMarketPrice, placeCoinDCXFuturesOrder } from '@/lib/coindcx';

export async function POST(request: Request) {
  try {
    const { price: binancePrice, ema: binanceEma, pair: binancePair } = await request.json();

    await dbConnect();
    const config = await Config.findOne();
    
    if (!config) {
      return NextResponse.json({ success: false, error: 'Config not found' }, { status: 400 });
    }

    const messages = [];
    const baseAsset = binancePair.replace('USDT', '');
    
    // Fallback if quoteCurrencies is missing
    const quoteCurrencies = config.quoteCurrencies?.length > 0 ? config.quoteCurrencies : ['USDT'];

    // 1. Send Telegram Notification
    if (config.telegramEnabled && config.telegramChatId) {
      const dropPercentage = (((binanceEma - binancePrice) / binanceEma) * 100).toFixed(2);
      const text = `🚨 <b>Price Alert: ${binancePair}</b>\n\nPrice has dropped below the EMA threshold!\n\nBinance Price: ${binancePrice}\n15m EMA: ${binanceEma.toFixed(2)}\nDrop: ${dropPercentage}%\n\n<i>Order Trailer Bot</i>`;
      await sendTelegramMessage(config.telegramChatId, text);
      messages.push('Telegram message sent.');
    }

    // 2. Place CoinDCX Futures Order
    if (config.autoOrderEnabled) {
      // Fetch current balances once
      const balanceRes = await fetchCoinDCXBalances();
      if (!balanceRes.success || !balanceRes.balances) {
         messages.push(`Failed to fetch CoinDCX balances.`);
         return NextResponse.json({ success: true, messages });
      }

      // Execute for each selected quote currency
      for (const quoteCurrency of quoteCurrencies) {
        const availableBalance = balanceRes.balances[quoteCurrency as keyof typeof balanceRes.balances] || 0;
        
        if (availableBalance <= 0) {
           messages.push(`Insufficient ${quoteCurrency} balance (${availableBalance}). skipping.`);
           continue;
        }

        // We need the local price on CoinDCX for the target market
        const targetMarket = `B-${baseAsset}_${quoteCurrency}`;
        const localPrice = await fetchCoinDCXMarketPrice(targetMarket);
        
        if (!localPrice) {
          messages.push(`Failed to fetch local price for ${targetMarket}. Skipping.`);
          continue;
        }

        const orderPercentage = config.orderPercentage;
        const leverage = config.leverage;

        // Calculate position size based on available balance * percentage * leverage
        const positionSizeLocal = availableBalance * (orderPercentage / 100) * leverage;
        const quantity = Number((positionSizeLocal / localPrice).toFixed(3));

        if (quantity <= 0) {
           messages.push(`Calculated quantity too small for ${quoteCurrency}: ${quantity}`);
           continue;
        }
        
        const orderRes = await placeCoinDCXFuturesOrder(
          baseAsset, 
          quoteCurrency, 
          'buy', 
          0, // Price is ignored for market orders
          quantity, 
          leverage,
          'market_order'
        );
        if (orderRes && orderRes.success) {
          messages.push(`CoinDCX Futures order placed for ${quoteCurrency}. Qty: ${quantity}`);
          if (config.telegramEnabled && config.telegramChatId) {
            await sendTelegramMessage(config.telegramChatId, `✅ <b>Futures Market Order Placed (${quoteCurrency})</b>\n\nAsset: ${baseAsset}\nMarket: ${targetMarket}\nApprox Price: ${localPrice} ${quoteCurrency}\nQuantity: ${quantity}\nLeverage: ${leverage}x\nCost: ${(positionSizeLocal/leverage).toFixed(2)} ${quoteCurrency}`);
          }
        } else {
          messages.push(`CoinDCX order failed for ${quoteCurrency}: ${JSON.stringify(orderRes?.error)}`);
          if (config.telegramEnabled && config.telegramChatId) {
            await sendTelegramMessage(config.telegramChatId, `❌ <b>Futures Order Failed (${quoteCurrency})</b>\n\nAsset: ${baseAsset}\nMarket: ${targetMarket}\nError: ${JSON.stringify(orderRes?.error)}`);
          }
        }
      }
    }

    // 3. Remove the asset from monitoring configuration
    config.pairs = config.pairs.filter((p: string) => p !== baseAsset);
    await config.save();
    messages.push(`Removed ${baseAsset} from active monitoring.`);

    return NextResponse.json({ success: true, messages });

  } catch (error) {
    console.error('Error in trigger:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
