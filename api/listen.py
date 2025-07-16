# api/listen.py - Финальная версия с комплексным сбором аналитики

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url
from user_agents import parse
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # --- 1. Сбор всей информации из запроса и заголовков ---
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            track_id = data.get('trackId')
            event_type = data.get('eventType', 'unknown')
            
            user_agent_string = self.headers.get('User-Agent')
            user_agent = parse(user_agent_string)
            
            ip_address = self.headers.get('X-Forwarded-For', 'Not Found')
            country_code = self.headers.get('X-Vercel-IP-Country', 'XX')

            if not track_id:
                self.send_error_response(400, "trackId is required.")
                return

            # --- 2. Подключение к Redis ---
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            
            # --- 3. Атомарная запись всех данных через pipeline ---
            pipe = redis_client.pipeline()
            
            # Основной счетчик прослушиваний (только для ключевого события)
            if event_type == '30s_listen':
                pipe.hincrby('v2:listen_counts', track_id, 1)

            # Общий счетчик всех событий по каждому треку
            pipe.hincrby(f'v2:events:{track_id}', event_type, 1)

            # Агрегированная анонимная статистика
            pipe.hincrby('v2:stats:browsers', user_agent.browser.family, 1)
            pipe.hincrby('v2:stats:os', user_agent.os.family, 1)
            pipe.hincrby('v2:stats:devices', 'Mobile' if user_agent.is_mobile else 'Desktop', 1)
            pipe.hincrby('v2:stats:countries', country_code, 1)
            
            # Временное хранилище для IP-адресов (диагностика)
            timestamp = datetime.now(timezone.utc).isoformat()
            ip_record_key = f"{timestamp}-{ip_address}"
            ip_payload = json.dumps({'ip': ip_address, 'country': country_code, 'ua': user_agent_string})
            pipe.hset('v2:diagnostic_logs', ip_record_key, ip_payload)
            
            pipe.execute()

            logging.info(f"Event '{event_type}' for track '{track_id}' from IP {ip_address} processed.")

            # --- 4. Отправка успешного ответа ---
            self.send_response(204) # 204 No Content, идеально для фоновых запросов
            self.end_headers()

        except Exception as e:
            logging.exception(f"Error in listen API v2: {e}")
            self.send_error_response(500, "An internal server error occurred.")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))
