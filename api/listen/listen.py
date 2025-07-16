# api/listen.py - Финальная версия с расширенным логированием

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url

# Настройка логирования
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            logger.info("Функция /api/listen вызвана.")
            
            # --- 1. Чтение тела запроса ---
            content_length = int(self.headers.get('Content-Length', 0))
            post_data_bytes = self.rfile.read(content_length)
            logger.info(f"Тело запроса получено, длина: {content_length} байт.")
            
            # --- 2. Парсинг JSON ---
            data = json.loads(post_data_bytes.decode('utf-8'))
            track_id = data.get('trackId')
            logger.info(f"JSON успешно распарсен. trackId: {track_id}")

            if not track_id:
                logger.warning("trackId отсутствует в запросе.")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'trackId is required'}).encode('utf-8'))
                return

            # --- 3. Подключение к Vercel KV ---
            kv_url = os.environ.get("KV_URL")
            if not kv_url:
                logger.error("Критическая ошибка: переменная окружения KV_URL не найдена!")
                raise ValueError("KV_URL environment variable is not set.")
            
            logger.info(f"Переменная KV_URL найдена. Попытка подключения к Redis...")
            
            # Используем from_url для подключения
            redis_client = from_url(kv_url)
            logger.info("Подключение к Redis успешно установлено.")
            
            # --- 4. Обновление счетчика ---
            logger.info(f"Увеличение счетчика для трека: {track_id}")
            new_count = redis_client.hincrby('listen_counts', track_id, 1)
            logger.info(f"Счетчик для '{track_id}' успешно обновлен. Новое значение: {new_count}")

            # --- 5. Отправка успешного ответа ---
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'trackId': track_id, 'newCount': new_count}).encode('utf-8'))
            logger.info("Успешный ответ 200 отправлен клиенту.")

        except json.JSONDecodeError as e:
            logger.error(f"Ошибка декодирования JSON: {e}", exc_info=True)
            self.send_error_response(400, "Invalid JSON format.")
        except ValueError as e:
            logger.error(f"Ошибка значения (вероятно, отсутствует KV_URL): {e}", exc_info=True)
            self.send_error_response(500, f"Configuration error: {e}")
        except Exception as e:
            # Логируем любую другую непредвиденную ошибку
            logger.error(f"Непредвиденная ошибка в функции: {e}", exc_info=True)
            self.send_error_response(500, "An unexpected error occurred.")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))
