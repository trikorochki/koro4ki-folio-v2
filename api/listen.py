# api/listen.py - Финальная, исправленная и проверенная версия
import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url, RedisError
from user_agents import parse
from datetime import datetime, timezone

# --- Конфигурация логирования ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class handler(BaseHTTPRequestHandler):
    """
    Обрабатывает входящие события аналитики, такие как прослушивания треков,
    и собирает анонимную статистику и диагностическую информацию.
    """

    def _get_redis_client(self):
        """Подключается к Redis, выбрасывая исключение, если URL не найден."""
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            logging.error("REDIS_URL is not set in environment variables.")
            raise ConnectionError("Database configuration is missing.")
        try:
            # Важно: Не используем decode_responses=True для записи,
            # чтобы избежать конфликтов типов с hincrby.
            return from_url(redis_url)
        except RedisError as e:
            logging.error(f"Failed to connect to Redis: {e}")
            raise ConnectionError("Could not connect to the database.") from e

    def _send_response(self, status_code, content_type='application/json', body=None):
        """Отправляет HTTP-ответ клиенту."""
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.end_headers()
        if body:
            self.wfile.write(body.encode('utf-8'))

    def _send_error(self, status_code, message):
        """Форматирует и отправляет стандартизированный ответ с ошибкой."""
        error_payload = json.dumps({'error': message})
        self._send_response(status_code, body=error_payload)

    def do_POST(self):
        try:
            # --- 1. Сбор и валидация данных ---
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return self._send_error(400, "Request body is empty.")

            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            track_id = data.get('trackId')
            if not track_id:
                return self._send_error(400, "trackId is required.")

            # Определяем переменную в стандартном для Python стиле snake_case
            event_type = data.get('eventType', 'unknown')

            user_agent_string = self.headers.get('User-Agent', 'Unknown')
            user_agent = parse(user_agent_string)
            ip_address = self.headers.get('X-Forwarded-For', 'Not Found')
            country_code = self.headers.get('X-Vercel-IP-Country', 'XX')

            # --- 2. Работа с Redis ---
            redis_client = self._get_redis_client()
            pipe = redis_client.pipeline()

            # --- 3. Формирование команд для атомарной записи ---
            # Последовательно используем переменную event_type
            
            if event_type == '30s_listen':
                pipe.hincrby('v2:listen_counts', track_id, 1)

            pipe.hincrby(f'v2:events:{track_id}', event_type, 1)

            pipe.hincrby('v2:stats:browsers', user_agent.browser.family, 1)
            pipe.hincrby('v2:stats:os', user_agent.os.family, 1)
            pipe.hincrby('v2:stats:devices', 'Mobile' if user_agent.is_mobile else 'Desktop', 1)
            pipe.hincrby('v2:stats:countries', country_code, 1)
            
            timestamp = datetime.now(timezone.utc).isoformat()
            log_key = f"{timestamp}-{ip_address}"
            
            log_payload = json.dumps({
                'ip': ip_address,
                'country': country_code,
                'userAgent': user_agent_string,
                'trackId': track_id,
                'eventType': event_type,
                'timestamp': timestamp
            })
            pipe.hset('v2:diagnostic_logs', log_key, log_payload)
            
            # --- 4. Выполнение всех команд ---
            pipe.execute()

            logging.info(f"Successfully processed event '{event_type}' for track '{track_id}'.")
            
            # --- 5. Отправка успешного ответа ---
            self._send_response(204)

        except json.JSONDecodeError:
            logging.warning("Failed to decode JSON from request body.")
            self._send_error(400, "Invalid JSON format.")
        except ConnectionError as e:
            logging.critical(f"Redis connection failed: {e}")
            self._send_error(503, "Service Unavailable: Cannot connect to the database.")
        except Exception as e:
            logging.exception(f"An unexpected error occurred in listen handler: {e}")
            self._send_error(500, "An internal server error occurred.")
