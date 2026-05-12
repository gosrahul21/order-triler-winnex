import { fetchBinancePrice } from '@/lib/binance';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');

    if (!market) {
      return NextResponse.json({ success: false, error: 'Market parameter is required' }, { status: 400 });
    }

    // Convert CoinDCX format 'B-BTC_USDT' to Binance format 'BTCUSDT'
    const symbol = market.replace('B-', '').replace('_', '');

    const price = await fetchBinancePrice(symbol);
    if (price === null) {
      return NextResponse.json({ success: false, error: 'Price not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, price },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error fetching price:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
