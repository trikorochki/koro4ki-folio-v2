# api/stats.py - Финальная версия с авторизацией по токену

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # --- 1. Проверка авторизации (Ключевой шаг) ---
            expected_token = os.environ.get("STATS_API_SECRET")
            auth_header = self.headers.get('Authorization')
            
            # Проверяем, что секрет вообще задан на сервере
            if not expected_token:
                logging.error("FATAL: STATS_API_SECRET is not configured on the server.")
                self.send_error_response(500, "Server configuration error.")
                return
            
            # Проверяем наличие заголовка и соответствие токена
            if not auth_header or not auth_header.startswith('Bearer ') or auth_header.split(' ')[1] != expected_token:
                logging.warning(f"Unauthorized access attempt. IP: {self.client_address[0]}")
                self.send_error_response(401, "Unauthorized")
                return
            
            logging.info("Authorization successful. Proceeding to fetch stats.")
            
            # --- 2. Подключение к Redis и получение данных ---
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            listen_counts_bytes = redis_client.hgetall('listen_counts')
            
            listen_counts = {
                key.decode('utf-8'): int(value.decode('utf-8'))
                for key, value in listen_counts_bytes.items()
            }
            
            logging.info(f"Successfully retrieved {len(listen_counts)} records.")

            # --- 3. Отправка успешного ответа ---
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*') 
            self.end_headers()
            self.wfile.write(json.dumps(listen_counts, indent=4, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            logging.exception(f"An unexpected internal error occurred in /api/stats: {e}")
            self.send_error_response(500, "An internal server error occurred.")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))
