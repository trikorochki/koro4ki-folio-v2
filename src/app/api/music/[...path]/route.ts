// src/app/api/music/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

// ================================================================================
// CONSTANTS
// ================================================================================

const MIME_TYPES: Record<string, string> = {
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
} as const;

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

function getMimeType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || '';
  return MIME_TYPES[extension] || 'application/octet-stream';
}

function sanitizePath(rawPath: string[]): string | null {
  try {
    const filePath = rawPath.join('/');
    const decodedPath = decodeURIComponent(filePath);
    
    console.log(`[MUSIC API] Processing path: ${decodedPath}`);
    
    // Базовые проверки безопасности
    if (decodedPath.includes('..') || decodedPath.includes('\0')) {
      console.warn('[MUSIC API] Security violation detected:', decodedPath);
      return null;
    }
    
    // Ограничиваем длину
    if (decodedPath.length > 1000) {
      console.warn('[MUSIC API] Path too long:', decodedPath.length);
      return null;
    }
    
    return decodedPath.trim();
  } catch (error) {
    console.error('[MUSIC API] Path sanitization error:', error);
    return null;
  }
}

// ================================================================================
// MAIN HANDLER
// ================================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  try {
    console.log(`[MUSIC API] Request for:`, params.path);
    
    // 1. Валидация входных данных
    if (!params?.path || !Array.isArray(params.path) || params.path.length === 0) {
      console.warn('[MUSIC API] Invalid path parameters');
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    const sanitizedPath = sanitizePath(params.path);
    if (!sanitizedPath) {
      return NextResponse.json(
        { error: 'Invalid file path format' },
        { status: 400 }
      );
    }
    
    // 2. Проверка токена Blob Storage
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[MUSIC API] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // 3. Поиск файла в Blob Storage
    const targetPath = `music/${sanitizedPath}`;
    console.log(`[MUSIC API] Looking for blob: ${targetPath}`);
    
    try {
      const { blobs } = await list({
        prefix: targetPath,
        limit: 1,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      
      if (blobs.length === 0) {
        console.warn(`[MUSIC API] File not found: ${targetPath}`);
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      
      const blob = blobs[0];
      console.log(`[MUSIC API] Found blob: ${blob.pathname} -> ${blob.url}`);
      
      // 4. Редирект на прямой URL
      return NextResponse.redirect(blob.url, 302);
      
    } catch (blobError) {
      console.error('[MUSIC API] Blob storage error:', blobError);
      return NextResponse.json(
        { error: 'File storage error' },
        { status: 503 }
      );
    }
    
  } catch (error: any) {
    console.error('[MUSIC API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ================================================================================
// CORS SUPPORT
// ================================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
