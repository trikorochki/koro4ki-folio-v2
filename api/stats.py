# api/stats.py - Финальная версия для вывода комплексной статистики

import os
import json
import logging
import re
from http.server import BaseHTTPRequestHandler
from redis import from_url
from collections import defaultdict
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # --- 1. Авторизация (без изменений) ---
            expected_token = os.environ.get("STATS_API_SECRET")
            auth_header = self.headers.get('Authorization')
            
            if not expected_token:
                self.send_error_response(500, "Server configuration error.")
                return
            
            if not auth_header or not auth_header.startswith('Bearer ') or auth_header.split(' ')[1] != expected_token:
                self.send_error_response(401, "Unauthorized")
                return
            
            # --- 2. Подключение к Redis ---
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            
            # --- 3. Получение всех данных одним запросом (pipeline) ---
            pipe = redis_client.pipeline()
            pipe.hgetall('v2:listen_counts')      # Основные счетчики прослушиваний
            pipe.hgetall('v2:stats:browsers')     # Статистика по браузерам
            pipe.hgetall('v2:stats:os')           # Статистика по ОС
            pipe.hgetall('v2:stats:devices')      # Статистика по устройствам
            pipe.hgetall('v2:stats:countries')    # Статистика по странам
            pipe.hgetall('v2:diagnostic_logs')    # Временные диагностические логи с IP
            results = pipe.execute()

            # --- 4. Обработка статистики по трекам ---
            listen_counts_bytes = results[0]
            grouped_stats = defaultdict(lambda: {'total_plays': 0, 'albums': defaultdict(lambda: {'total_plays': 0, 'tracks': []})})

            for full_url_bytes, plays_bytes in listen_counts_bytes.items():
                try:
                    full_url = full_url_bytes.decode('utf-8')
                    plays = int(plays_bytes.decode('utf-8'))
                    parsed_url = urlparse(full_url)
                    relative_path = parsed_url.path.lstrip('/')
                    parts = relative_path.split('/')

                    if len(parts) == 4 and parts[0] == 'music':
                        artist_name, album_raw, track_file = parts[1], parts[2], parts[3]
                        track_raw = os.path.splitext(track_file)[0]
                        album_name = re.sub(r'^(Album|EP|Demo)\.\s*', '', album_raw, flags=re.IGNORECASE).strip()
                        track_name = re.sub(r'^\d{1,2}[\s.\-_]*', '', track_raw).strip()
                        
                        # Получаем детальные события для этого трека
                        event_details_bytes = redis_client.hgetall(f'v2:events:{full_url}')
                        event_details = {k.decode('utf-8'): int(v.decode('utf-8')) for k, v in event_details_bytes.items()}

                        grouped_stats[artist_name]['total_plays'] += plays
                        grouped_stats[artist_name]['albums'][album_name]['total_plays'] += plays
                        grouped_stats[artist_name]['albums'][album_name]['tracks'].append({
                            'title': track_name,
                            'plays': plays,
                            'events': event_details
                        })
                except Exception:
                    continue # Пропускаем некорректные записи

            # --- 5. Сборка финального ответа ---
            final_response = {
                'track_stats': grouped_stats,
                'audience_stats': {
                    'browsers': {k.decode('utf-8'): int(v.decode('utf-8')) for k, v in results[1].items()},
                    'os': {k.decode('utf-8'): int(v.decode('utf-8')) for k, v in results[2].items()},
                    'devices': {k.decode('utf-8'): int(v.decode('utf-8')) for k, v in results[3].items()},
                    'countries': {k.decode('utf-8'): int(v.decode('utf-8')) for k, v in results[4].items()},
                },
                'diagnostic_logs': sorted([json.loads(v.decode('utf-8')) for k, v in results[5].items()], key=lambda x: x['timestamp'], reverse=True)
            }
            
            # --- 6. Отправка ответа ---
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(final_response, indent=4, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            logging.exception(f"Error in stats API v2: {e}")
            self.send_error_response(500, "An internal server error occurred.")
            
    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))
