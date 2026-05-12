import { NextResponse } from 'next/server';
import { fetchCoinDCXPositions } from '@/lib/coindcx';

export async function GET() {
  try {
    const res = await fetchCoinDCXPositions();
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
