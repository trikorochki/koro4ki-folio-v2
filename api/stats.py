# api/stats.py - Новый API-эндпоинт для выгрузки статистики

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url

# Настройка логирования для Vercel
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            logging.info("API call received at /api/stats.")
            
            # Используем тот же метод подключения, что и в /api/listen
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                logging.critical("FATAL: Environment variable REDIS_URL not found!")
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            redis_client.ping()
            logging.info("Successfully connected to Redis for stats retrieval.")
            
            # Получаем все данные из хеша 'listen_counts'
            listen_counts_bytes = redis_client.hgetall('listen_counts')
            
            # Декодируем байтовые строки в обычные строки и числа
            listen_counts = {
                key.decode('utf-8'): int(value.decode('utf-8'))
                for key, value in listen_counts_bytes.items()
            }
            
            logging.info(f"Successfully retrieved {len(listen_counts)} records.")

            # Отправляем успешный ответ с данными в формате JSON
            self.send_response(200)
            # Указываем кодировку UTF-8 для корректного отображения кириллицы
            self.send_header('Content-type', 'application/json; charset=utf-8')
            # Разрешаем кросс-доменные запросы, чтобы можно было обращаться к API с других сайтов
            self.send_header('Access-Control-Allow-Origin', '*') 
            self.end_headers()
            self.wfile.write(json.dumps(listen_counts, indent=4, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            logging.exception(f"An unexpected internal error occurred in /api/stats: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': "An internal server error occurred."}).encode('utf-8'))

