# api/stats.py - Финальная версия с группировкой данных на сервере

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from redis import from_url
from collections import defaultdict
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # --- 1. Проверка авторизации ---
            expected_token = os.environ.get("STATS_API_SECRET")
            auth_header = self.headers.get('Authorization')
            
            if not expected_token:
                self.send_error_response(500, "Server configuration error.")
                return
            
            if not auth_header or not auth_header.startswith('Bearer ') or auth_header.split(' ')[1] != expected_token:
                self.send_error_response(401, "Unauthorized")
                return
            
            # --- 2. Подключение к Redis и получение данных ---
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            listen_counts_bytes = redis_client.hgetall('listen_counts')
            
            # --- 3. Группировка и обработка данных (Ключевое изменение) ---
            stats = defaultdict(lambda: {'total_plays': 0, 'albums': defaultdict(lambda: {'total_plays': 0, 'tracks': []})})

            for path_bytes, plays_bytes in listen_counts_bytes.items():
                try:
                    path = path_bytes.decode('utf-8')
                    plays = int(plays_bytes.decode('utf-8'))
                    
                    # Парсим путь: music/artist/album/track.mp3
                    parts = path.split('/')
                    if len(parts) >= 4 and parts[0] == 'music':
                        artist_name = parts[1]
                        album_name_raw = parts[2]
                        track_name_raw = os.path.splitext(parts[3])[0]

                        # Очищаем названия от префиксов
                        album_name = re.sub(r'^(Album|EP|Demo)\.\s*', '', album_name_raw, flags=re.IGNORECASE)
                        track_name = re.sub(r'^\d{1,2}[\s.\-_]*', '', track_name_raw)

                        # Накапливаем статистику
                        stats[artist_name]['total_plays'] += plays
                        stats[artist_name]['albums'][album_name]['total_plays'] += plays
                        stats[artist_name]['albums'][album_name]['tracks'].append({'title': track_name, 'plays': plays})

                except (UnicodeDecodeError, ValueError, IndexError):
                    logging.warning(f"Could not parse record: {path_bytes}")
                    continue
            
            # Сортируем треки внутри каждого альбома
            for artist in stats.values():
                for album in artist['albums'].values():
                    album['tracks'].sort(key=lambda x: x['plays'], reverse=True)

            # --- 4. Отправка успешного ответа ---
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*') 
            self.end_headers()
            self.wfile.write(json.dumps(stats, indent=4, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            logging.exception(f"An unexpected internal error occurred in /api/stats: {e}")
            self.send_error_response(500, "An internal server error occurred.")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))
