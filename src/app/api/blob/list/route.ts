// src/app/api/blob/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Получаем список всех файлов с префиксом 'music/'
    const { blobs } = await list({
      prefix: 'music/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`📂 Found ${blobs.length} files in Blob Storage`);

    return NextResponse.json({
      blobs: blobs.map(blob => ({
        pathname: blob.pathname,
        url: blob.url,
      }))
    });

  } catch (error) {
    console.error('Error listing blob files:', error);
    return NextResponse.json(
      { error: 'Failed to list blob files' },
      { status: 500 }
    );
  }
}
