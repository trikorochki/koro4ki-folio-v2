// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
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

    if (!file || !artistName || !albumName || !trackNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: file, artistName, albumName, trackNumber' },
        { status: 400 }
      );
    }

    // Проверяем тип файла
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'File must be an audio file' },
        { status: 400 }
      );
    }

    // Создаем путь для файла
    const fileName = `${trackNumber.padStart(2, '0')} ${file.name}`;
    const filePath = `${artistName}/${albumName}/${fileName}`;

    // Загружаем файл в Vercel Blob
    const blob = await put(filePath, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Регенерируем плейлист после загрузки
    await generatePlaylistData();

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      message: `Track uploaded successfully: ${fileName}`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
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

    const uploadResults = [];

    // Загружаем обложку альбома если есть
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

    // Загружаем все треки
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
      message: `Album "${albumName}" uploaded successfully with ${files.length} tracks`,
    });

  } catch (error) {
    console.error('Album upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload album' },
      { status: 500 }
    );
  }
}
