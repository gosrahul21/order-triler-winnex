import { NextResponse } from 'next/server';
import { fetchCoinDCXBalances } from '@/lib/coindcx';

export async function GET() {
  try {
    const res = await fetchCoinDCXBalances();
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error fetching balances:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
