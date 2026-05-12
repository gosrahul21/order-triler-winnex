import { NextResponse } from 'next/server';
import { setCoinDCXTpSl } from '@/lib/coindcx';

export async function POST(request: Request) {
  try {
    const { pair, side, quantity, leverage, marginCurrency, takeProfit, stopLoss } = await request.json();

    if (!pair || !side || !quantity) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!takeProfit && !stopLoss) {
      return NextResponse.json({ success: false, error: 'At least one of takeProfit or stopLoss must be provided' }, { status: 400 });
    }

    const result = await setCoinDCXTpSl(
      pair,
      side === 'BUY' ? 'buy' : 'sell',
      quantity,
      leverage || 1,
      marginCurrency || 'USDT',
      takeProfit ? Number(takeProfit) : null,
      stopLoss ? Number(stopLoss) : null
    );

    if (result.success) {
      return NextResponse.json({ success: true, results: result.results });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error('Error setting TP/SL:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
