import { NextResponse } from 'next/server';
import { closeCoinDCXPosition } from '@/lib/coindcx';

export async function POST(request: Request) {
  try {
    const { pair, side, quantity, marginCurrency } = await request.json();
    
    if (!pair || !side || !quantity || !marginCurrency) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const res = await closeCoinDCXPosition(pair, side.toLowerCase(), quantity, marginCurrency);
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error closing position:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
