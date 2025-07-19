// src/app/api/listen/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { analytics } from '@/lib/analytics';

export async function POST(request: NextRequest) {
  try {
    const { trackId, event } = await request.json();
    
    if (!trackId || !event) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await analytics.recordListen(trackId, request);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording listen:', error);
    return NextResponse.json(
      { error: 'Failed to record listen' },
      { status: 500 }
    );
  }
}
