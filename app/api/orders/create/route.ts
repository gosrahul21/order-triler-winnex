import { NextResponse } from 'next/server';
import { placeCoinDCXFuturesOrder, fetchCoinDCXBalances } from '@/lib/coindcx';
import { fetchBinancePrice } from '@/lib/binance';

export async function POST(request: Request) {
  try {
    const { asset, quoteCurrency, side, orderType, price, quantity, percentage, leverage } = await request.json();

    if (!asset || !quoteCurrency || !side || !orderType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let finalQuantity = quantity;

    // If percentage is provided instead of strict quantity, calculate it
    if (percentage && percentage > 0) {
      const balanceRes = await fetchCoinDCXBalances();
      if (!balanceRes.success || !balanceRes.balances) {
        return NextResponse.json({ success: false, error: 'Failed to fetch balances for calculation' }, { status: 500 });
      }

      const availableBalance = balanceRes.balances[quoteCurrency as keyof typeof balanceRes.balances] || 0;
      if (availableBalance <= 0) {
        return NextResponse.json({ success: false, error: `Insufficient ${quoteCurrency} balance` }, { status: 400 });
      }

      // Determine the price to use for calculation
      let calculationPrice = price;
      if (orderType === 'market_order' || !calculationPrice) {
        const symbol = `${asset}${quoteCurrency}`;
        calculationPrice = await fetchBinancePrice(symbol);
        if (!calculationPrice) {
          return NextResponse.json({ success: false, error: 'Failed to fetch market price for calculation' }, { status: 500 });
        }
      }

      const positionSizeLocal = availableBalance * (percentage / 100) * (leverage || 1);
      finalQuantity = Number((positionSizeLocal / calculationPrice).toFixed(3));

      if (finalQuantity <= 0) {
        return NextResponse.json({ success: false, error: 'Calculated quantity is too small' }, { status: 400 });
      }
    }

    if (!finalQuantity) {
      return NextResponse.json({ success: false, error: 'Quantity or Percentage must be provided' }, { status: 400 });
    }

    // Call the updated coindcx utility
    const orderRes = await placeCoinDCXFuturesOrder(
      asset,
      quoteCurrency,
      side,
      price || 0,
      finalQuantity,
      leverage || 1,
      orderType
    );

    if (orderRes && orderRes.success) {
      return NextResponse.json({ success: true, data: orderRes.data });
    } else {
      return NextResponse.json({ success: false, error: orderRes?.error || 'Order failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
