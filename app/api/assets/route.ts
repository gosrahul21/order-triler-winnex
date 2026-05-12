import { NextResponse } from 'next/server';
import { fetchCoinDCXAvailableAssets } from '@/lib/coindcx';

export async function GET() {
  try {
    const assets = await fetchCoinDCXAvailableAssets();
    return NextResponse.json({ success: true, assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
