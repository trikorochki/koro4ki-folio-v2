# api/stats.py - Финальная версия с корректным парсингом URL

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
            # --- 1. Проверка авторизации (без изменений) ---
            expected_token = os.environ.get("STATS_API_SECRET")
            auth_header = self.headers.get('Authorization')
            
            if not expected_token:
                self.send_error_response(500, "Server configuration error.")
                return
            
            if not auth_header or not auth_header.startswith('Bearer ') or auth_header.split(' ')[1] != expected_token:
                self.send_error_response(401, "Unauthorized")
                return
            
            # --- 2. Подключение к Redis (без изменений) ---
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                raise ConnectionError("Server configuration error: Database URL is not set.")
            
            redis_client = from_url(redis_url)
            listen_counts_bytes = redis_client.hgetall('listen_counts')
            
            # --- 3. Группировка данных с корректным парсингом URL ---
            stats = defaultdict(lambda: {'total_plays': 0, 'albums': defaultdict(lambda: {'total_plays': 0, 'tracks': []})})
            
            logging.info(f"Found {len(listen_counts_bytes)} records in Redis. Starting parsing...")

            for full_url_bytes, plays_bytes in listen_counts_bytes.items():
                try:
                    full_url = full_url_bytes.decode('utf-8')
                    plays = int(plays_bytes.decode('utf-8'))
                    
                    # ✅ ИСПРАВЛЕНИЕ: Извлекаем путь из полного URL
                    parsed_url = urlparse(full_url)
                    relative_path = parsed_url.path.lstrip('/') # Получаем 'music/artist/album/track.mp3'
                    
                    parts = relative_path.split('/')

                    # Ожидаем структуру 'music/artist/album/track' (4 части)
                    if len(parts) == 4 and parts[0] == 'music':
                        artist_name = parts[1]
                        album_name_raw = parts[2]
                        track_file = parts[3]
                        track_name_raw = os.path.splitext(track_file)[0]

                        album_name = re.sub(r'^(Album|EP|Demo)\.\s*', '', album_name_raw, flags=re.IGNORECASE).strip()
                        track_name = re.sub(r'^\d{1,2}[\s.\-_]*', '', track_name_raw).strip()

                        stats[artist_name]['total_plays'] += plays
                        stats[artist_name]['albums'][album_name]['total_plays'] += plays
                        stats[artist_name]['albums'][album_name]['tracks'].append({'title': track_name, 'plays': plays})
                    else:
                        logging.warning(f"Path '{relative_path}' from URL '{full_url}' does not match expected structure. Skipping.")

                except (UnicodeDecodeError, ValueError, IndexError) as e:
                    logging.error(f"Could not parse record for URL '{full_url_bytes.decode('utf-8', errors='ignore')}'. Error: {e}")
                    continue
            
            # --- Сортировка и отправка (без изменений) ---
            for artist in stats.values():
                for album in artist['albums'].values():
                    album['tracks'].sort(key=lambda x: x['plays'], reverse=True)

            logging.info(f"Parsing complete. Returning stats for {len(stats)} artists.")

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
