// middleware.ts (в корне проекта)
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Обрабатываем запросы к музыкальным файлам
  if (pathname.startsWith('/music/')) {
    try {
      // Декодируем URL для работы с кириллицей и пробелами
      const decodedPath = decodeURIComponent(pathname);
      const filePath = path.join(process.cwd(), decodedPath);
      
      console.log('🎵 Serving music file:', filePath);
      
      // Проверяем безопасность пути (предотвращаем directory traversal)
      const safePath = path.resolve(process.cwd(), decodedPath.substring(1));
      const musicDir = path.resolve(process.cwd(), 'music');
      
      if (!safePath.startsWith(musicDir)) {
        console.warn('⚠️ Attempted directory traversal:', decodedPath);
        return new NextResponse('Access denied', { 
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      if (fs.existsSync(safePath)) {
        const stat = fs.statSync(safePath);
        
        if (stat.isFile()) {
          const fileBuffer = fs.readFileSync(safePath);
          const extension = path.extname(safePath).toLowerCase();
          
          let contentType = 'application/octet-stream';
          let cacheControl = 'public, max-age=31536000'; // 1 год для аудио
          
          // Определяем MIME тип и кэширование
          switch (extension) {
            case '.mp3':
              contentType = 'audio/mpeg';
              break;
            case '.wav':
              contentType = 'audio/wav';
              break;
            case '.flac':
              contentType = 'audio/flac';
              break;
            case '.m4a':
            case '.aac':
              contentType = 'audio/mp4';
              break;
            case '.ogg':
              contentType = 'audio/ogg';
              break;
            case '.jpg':
            case '.jpeg':
              contentType = 'image/jpeg';
              cacheControl = 'public, max-age=86400'; // 1 день для изображений
              break;
            case '.png':
              contentType = 'image/png';
              cacheControl = 'public, max-age=86400';
              break;
            case '.webp':
              contentType = 'image/webp';
              cacheControl = 'public, max-age=86400';
              break;
            default:
              contentType = 'application/octet-stream';
              cacheControl = 'public, max-age=3600'; // 1 час для неизвестных типов
          }
          
          // Поддержка Range requests для аудио стриминга
          const range = request.headers.get('range');
          
          if (range && contentType.startsWith('audio/')) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
            const chunksize = (end - start) + 1;
            const chunk = fileBuffer.slice(start, end + 1);
            
            return new NextResponse(chunk, {
              status: 206, // Partial Content
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileBuffer.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': contentType,
                'Cache-Control': cacheControl,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range',
                'Cross-Origin-Resource-Policy': 'cross-origin',
              },
            });
          }
          
          console.log(`✅ Serving ${extension} file: ${path.basename(safePath)} (${fileBuffer.length} bytes)`);
          
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': cacheControl,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Range',
              'Accept-Ranges': 'bytes',
              'Content-Length': fileBuffer.length.toString(),
              'Cross-Origin-Resource-Policy': 'cross-origin',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } else {
          console.log('📁 Path is directory, not file:', safePath);
        }
      } else {
        console.log('❌ File not found:', safePath);
      }
      
    } catch (error) {
      console.error('💥 Error serving music file:', error);
      
      return new NextResponse('Internal server error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    return new NextResponse('File not found', { 
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      }
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/music/:path*',
    // Исключаем API routes и static файлы
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
