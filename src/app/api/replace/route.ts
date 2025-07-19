// src/app/api/replace/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { put, del, list } from '@vercel/blob';
import { generatePlaylistData } from '@/lib/playlist-generator';

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const artistName = formData.get('artistName') as string;
    const albumName = formData.get('albumName') as string;
    const trackNumber = formData.get('trackNumber') as string;
    const oldTrackName = formData.get('oldTrackName') as string;

    if (!file || !artistName || !albumName || !trackNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: file, artistName, albumName, trackNumber' },
        { status: 400 }
      );
    }

    // Ищем старый файл для удаления
    const { blobs } = await list({
      prefix: `${artistName}/${albumName}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    let oldFile = null;
    if (oldTrackName) {
      oldFile = blobs.find(blob => 
        blob.pathname.includes(oldTrackName) || 
        blob.pathname.includes(trackNumber.padStart(2, '0'))
      );
    } else {
      // Ищем по номеру трека
      oldFile = blobs.find(blob => 
        blob.pathname.includes(`${trackNumber.padStart(2, '0')} `)
      );
    }

    // Удаляем старый файл если найден
    if (oldFile) {
      await del(oldFile.url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    }

    // Загружаем новый файл
    const fileName = `${trackNumber.padStart(2, '0')} ${file.name}`;
    const filePath = `${artistName}/${albumName}/${fileName}`;

    const blob = await put(filePath, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Регенерируем плейлист
    await generatePlaylistData();

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      oldFile: oldFile?.pathname || null,
      message: `Track replaced successfully: ${fileName}`,
    });

  } catch (error) {
    console.error('Replace track error:', error);
    return NextResponse.json(
      { error: 'Failed to replace track' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const artistName = formData.get('artistName') as string;
    const albumName = formData.get('albumName') as string;
    const coverFile = formData.get('cover') as File;

    if (!files.length || !artistName || !albumName) {
      return NextResponse.json(
        { error: 'Missing required fields: files, artistName, albumName' },
        { status: 400 }
      );
    }

    // Удаляем старый альбом
    const { blobs } = await list({
      prefix: `${artistName}/${albumName}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    for (const blob of blobs) {
      await del(blob.url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    }

    const uploadResults = [];

    // Загружаем новую обложку если есть
    if (coverFile) {
      const coverPath = `${artistName}/${albumName}/cover.jpg`;
      const coverBlob = await put(coverPath, coverFile, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      uploadResults.push({
        type: 'cover',
        url: coverBlob.url,
        pathname: coverBlob.pathname,
      });
    }

    // Загружаем новые треки
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const trackNumber = (i + 1).toString().padStart(2, '0');
      const fileName = `${trackNumber} ${file.name}`;
      const filePath = `${artistName}/${albumName}/${fileName}`;

      const blob = await put(filePath, file, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      uploadResults.push({
        type: 'track',
        trackNumber: i + 1,
        url: blob.url,
        pathname: blob.pathname,
        filename: fileName,
      });
    }

    // Регенерируем плейлист
    await generatePlaylistData();

    return NextResponse.json({
      success: true,
      uploadResults,
      deletedFiles: blobs.length,
      message: `Album "${albumName}" replaced successfully with ${files.length} tracks`,
    });

  } catch (error) {
    console.error('Replace album error:', error);
    return NextResponse.json(
      { error: 'Failed to replace album' },
      { status: 500 }
    );
  }
}
