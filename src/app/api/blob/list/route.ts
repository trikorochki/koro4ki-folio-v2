// src/app/api/blob/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

interface ProcessedTrack {
  id: string;
  pathname: string;
  url: string;
  artistId: string;
  albumName: string;
  fileName: string;
  title: string;
  size: number;
  uploadedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN not configured' },
        { status: 500 }
      );
    }

    const { blobs } = await list({
      prefix: 'music/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`📂 Found ${blobs.length} files in Blob Storage`);

    const audioFiles = blobs
      .filter(blob => {
        const isAudio = blob.pathname.endsWith('.mp3') || 
                       blob.pathname.endsWith('.wav') || 
                       blob.pathname.endsWith('.m4a');
        return isAudio && blob.size > 0;
      })
      .map(blob => {
        try {
          const pathWithoutPrefix = blob.pathname.replace('music/', '');
          const pathParts = pathWithoutPrefix.split('/');
          
          if (pathParts.length >= 3) {
            const [artistId, albumRaw, ...fileNameParts] = pathParts;
            const fileName = fileNameParts.join('/');
            
            const albumName = albumRaw.replace(/^(Album|EP|Demo)\.\s*/i, '').trim();
            
            const title = fileName
              .replace(/^\d{1,2}[\s.\-_]*/, '')
              .replace(/\.[^.]+$/, '')
              .trim();
            
            const trackId = `${artistId}_${albumName.replace(/\s/g, '_')}_${title.replace(/\s/g, '_')}`;
            
            return {
              id: trackId,
              pathname: blob.pathname,
              url: blob.url,
              artistId,
              albumName,
              fileName,
              title,
              size: blob.size,
              uploadedAt: typeof blob.uploadedAt === 'string'
                ? blob.uploadedAt
                : (blob.uploadedAt instanceof Date
                    ? blob.uploadedAt.toISOString()
                    : String(blob.uploadedAt))
            } as ProcessedTrack;
          }
          
          console.warn(`Skipping malformed path: ${blob.pathname}`);
          return null;
        } catch (error) {
          console.error(`Error processing blob ${blob.pathname}:`, error);
          return null;
        }
      })
      .filter((track): track is ProcessedTrack => track !== null)
      .sort((a, b) => {
        const artistCompare = a.artistId.localeCompare(b.artistId);
        if (artistCompare !== 0) return artistCompare;
        
        const albumCompare = a.albumName.localeCompare(b.albumName);
        if (albumCompare !== 0) return albumCompare;
        
        return a.title.localeCompare(b.title);
      });

    console.log(`✅ Processed ${audioFiles.length} valid audio tracks`);

    return NextResponse.json({
      success: true,
      total: audioFiles.length,
      tracks: audioFiles
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });

  } catch (error) {
    console.error('Error listing blob files:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list blob files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
