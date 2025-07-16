# api/listen.py - Финальная версия, использующая REDIS_URL

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url, RedisError

# Настройка логирования для Vercel
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            logging.info("API call received at /api/listen.")
            
            # 1. Чтение и парсинг запроса
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error_response(400, "Request body is empty.")
                return
                
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            track_id = data.get('trackId')

            if not track_id:
                self.send_error_response(400, "trackId is required.")
                return

            # 2. Получение переменной REDIS_URL (Ключевой шаг)
            redis_url = os.environ.get("REDIS_URL")

            if not redis_url:
                logging.critical("FATAL: Environment variable REDIS_URL not found!")
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            logging.info("REDIS_URL found. Attempting to connect...")
            
            # 3. Подключение к Redis с использованием from_url
            redis_client = from_url(redis_url)
            
            redis_client.ping()
            logging.info("Successfully connected to Redis.")
            
            # 4. Инкремент счетчика
            new_count = redis_client.hincrby('listen_counts', track_id, 1)
            logging.info(f"Counter for '{track_id}' incremented to {new_count}.")

            # 5. Отправка успешного ответа
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'trackId': track_id, 'newCount': new_count}).encode('utf-8'))

        except Exception as e:
            logging.exception(f"An unexpected internal error occurred: {e}")
            self.send_error_response(500, "An unexpected internal error occurred.")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))

