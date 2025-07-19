import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/');
    const decodedPath = decodeURIComponent(filePath);
    
    // Получаем BLOB_URL из переменных окружения
    const blobBaseUrl = process.env.BLOB_URL;
    
    if (!blobBaseUrl) {
      console.error('BLOB_URL environment variable is not set');
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      );
    }
    
    // Формируем полный URL к файлу в Blob Storage
    const blobUrl = `${blobBaseUrl}/music/${decodedPath}`;
    
    console.log(`Fetching from Blob: ${blobUrl}`);
    
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      console.error(`Blob fetch failed: ${response.status} - ${response.statusText}`);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Определяем MIME-тип по расширению файла
    const mimeType = getMimeType(decodedPath);
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Error serving music file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Определение MIME-типов для аудиофайлов
function getMimeType(filePath: string): string {
  const extension = filePath.toLowerCase().split('.').pop();
  
  const mimeTypes: { [key: string]: string } = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

// Поддержка CORS для OPTIONS запросов
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
