import os
import json
from http.server import BaseHTTPRequestHandler
from redis import from_url

class handler(BaseHTTPRequestHandler):
    """
    Vercel Serverless Function для обработки счетчика прослушиваний.
    """
    def do_POST(self):
        try:
            # Получаем длину тела запроса
            content_length = int(self.headers.get('Content-Length', 0))
            # Читаем тело запроса
            post_data_bytes = self.rfile.read(content_length)
            
            # Декодируем и парсим JSON
            data = json.loads(post_data_bytes.decode('utf-8'))
            track_id = data.get('trackId')

            if not track_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'trackId is required'}).encode('utf-8'))
                return

            # Подключаемся к Vercel KV (Redis) используя переменные окружения
            # Vercel автоматически предоставляет KV_URL при подключении хранилища
            redis_client = from_url(os.environ.get("KV_URL"))
            
            # Атомарно увеличиваем счетчик для трека в хеше 'listen_counts'
            # Это эффективный способ хранить все счетчики под одним ключом
            redis_client.hincrby('listen_counts', track_id, 1)

            # Отправляем успешный ответ
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'trackId': track_id}).encode('utf-8'))

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode('utf-8'))
        except Exception as e:
            # Логирование ошибок для отладки
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

