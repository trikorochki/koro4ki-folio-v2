// src/app/api/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';
import { generatePlaylistData } from '@/lib/playlist-generator';

export async function DELETE(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ANALYTICS_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get('artistName');
    const albumName = searchParams.get('albumName');
    const trackNumber = searchParams.get('trackNumber');
    const trackName = searchParams.get('trackName');

    if (!artistName) {
      return NextResponse.json(
        { error: 'artistName is required' },
        { status: 400 }
      );
    }

    let deletedFiles = [];
    let searchPrefix = artistName;

    if (albumName) {
      searchPrefix = `${artistName}/${albumName}`;
    }

    // Получаем список файлов для удаления
    const { blobs } = await list({
      prefix: `${searchPrefix}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    let filesToDelete = blobs;

    // Фильтруем файлы если указан конкретный трек
    if (trackNumber || trackName) {
      filesToDelete = blobs.filter(blob => {
        if (trackNumber) {
          return blob.pathname.includes(`${trackNumber.padStart(2, '0')} `);
        }
        if (trackName) {
          return blob.pathname.toLowerCase().includes(trackName.toLowerCase());
        }
        return false;
      });
    }

    if (filesToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No files found matching the criteria' },
        { status: 404 }
      );
    }

    // Удаляем файлы
    for (const blob of filesToDelete) {
      try {
        await del(blob.url, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        deletedFiles.push({
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
        });
      } catch (error) {
        console.error(`Failed to delete ${blob.pathname}:`, error);
      }
    }

    // Регенерируем плейлист после удаления
    await generatePlaylistData();

    return NextResponse.json({
      success: true,
      deletedFiles,
      message: `Successfully deleted ${deletedFiles.length} file(s)`,
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete files' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ANALYTICS_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { artistName, albumName, trackNumber, trackName, confirm } = body;

    if (!artistName) {
      return NextResponse.json(
        { error: 'artistName is required' },
        { status: 400 }
      );
    }

    if (!confirm) {
      return NextResponse.json(
        { error: 'confirm flag is required for safety' },
        { status: 400 }
      );
    }

    let deletedFiles = [];
    let searchPrefix = artistName;

    if (albumName) {
      searchPrefix = `${artistName}/${albumName}`;
    }

    // Получаем список файлов для удаления
    const { blobs } = await list({
      prefix: `${searchPrefix}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    let filesToDelete = blobs;

    // Фильтруем файлы если указан конкретный трек
    if (trackNumber || trackName) {
      filesToDelete = blobs.filter(blob => {
        if (trackNumber) {
          return blob.pathname.includes(`${trackNumber.padStart(2, '0')} `);
        }
        if (trackName) {
          return blob.pathname.toLowerCase().includes(trackName.toLowerCase());
        }
        return false;
      });
    }

    if (filesToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No files found matching the criteria' },
        { status: 404 }
      );
    }

    // Удаляем файлы
    for (const blob of filesToDelete) {
      try {
        await del(blob.url, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        deletedFiles.push({
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
        });
      } catch (error) {
        console.error(`Failed to delete ${blob.pathname}:`, error);
      }
    }

    // Регенерируем плейлист после удаления
    await generatePlaylistData();

    return NextResponse.json({
      success: true,
      deletedFiles,
      message: `Successfully deleted ${deletedFiles.length} file(s)`,
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete files' },
      { status: 500 }
    );
  }
}
