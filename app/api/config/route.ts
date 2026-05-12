import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Config from '@/lib/models/Config';

export async function GET() {
  try {
    await dbConnect();
    let config = await Config.findOne();
    if (!config) {
      config = await Config.create({});
    }
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
    let config = await Config.findOne();
    if (config) {
      Object.assign(config, data);
      await config.save();
    } else {
      config = await Config.create(data);
    }
    
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json({ success: false, error: 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await Config.deleteMany({}); // Clear all config documents
    return NextResponse.json({ success: true, message: 'Configuration deleted and reset.' });
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete config' }, { status: 500 });
  }
}
