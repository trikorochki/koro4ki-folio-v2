# api/stats.py - Единый, оптимизированный эндпоинт для всей статистики
import os
import json
import logging
import re
from http.server import BaseHTTPRequestHandler
from redis import from_url, RedisError
from collections import defaultdict
from urllib.parse import urlparse

# --- Конфигурация логирования ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class handler(BaseHTTPRequestHandler):
    """
    Предоставляет комплексную статистику по прослушиваниям, аудитории
    и диагностические логи через защищенный API.
    Оптимизирован для минимизации запросов к базе данных.
    """

    def _authorize(self):
        """Проверяет токен авторизации. Возвращает True в случае успеха."""
        expected_token = os.environ.get("STATS_API_SECRET")
        if not expected_token:
            logging.error("STATS_API_SECRET не установлен на сервере.")
            self._send_error(500, "Server configuration error.")
            return False

        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer ') or auth_header.split(' ')[1] != expected_token:
            self._send_error(401, "Unauthorized.")
            return False
        
        return True

    def _get_redis_client(self):
        """Подключается к Redis."""
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            raise ConnectionError("Database configuration is missing.")
        return from_url(redis_url)

    def _send_response(self, status_code, content_type='application/json; charset=utf-8', body=None):
        """Отправляет HTTP-ответ."""
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _send_error(self, status_code, message):
        """Отправляет стандартизированный ответ с ошибкой."""
        error_payload = json.dumps({'error': message}, ensure_ascii=False).encode('utf-8')
        self._send_response(status_code, body=error_payload)

    def _fetch_all_data(self, redis_client):
        """
        Извлекает всю необходимую статистику из Redis за минимальное число запросов.
        РЕШАЕТ ПРОБЛЕМУ N+1.
        """
        pipe = redis_client.pipeline()
        
        # 1. Запрашиваем основные данные
        pipe.hgetall('v2:listen_counts')
        pipe.hgetall('v2:stats:browsers')
        pipe.hgetall('v2:stats:os')
        pipe.hgetall('v2:stats:devices')
        pipe.hgetall('v2:stats:countries')
        pipe.hgetall('v2:diagnostic_logs')
        
        # 2. Находим все ключи событий и запрашиваем их данные
        event_keys = redis_client.keys('v2:events:*')
        if event_keys:
            for key in event_keys:
                pipe.hgetall(key)
        
        results = pipe.execute()
        
        # Разбираем результаты
        data = {
            'listen_counts': {k.decode('utf-8'): int(v) for k, v in results[0].items()},
            'browsers': {k.decode('utf-8'): int(v) for k, v in results[1].items()},
            'os': {k.decode('utf-8'): int(v) for k, v in results[2].items()},
            'devices': {k.decode('utf-8'): int(v) for k, v in results[3].items()},
            'countries': {k.decode('utf-8'): int(v) for k, v in results[4].items()},
            'diagnostic_logs': sorted([json.loads(v) for v in results[5].values()], key=lambda x: x['timestamp'], reverse=True)
        }
        
        # Собираем данные по событиям в словарь для быстрого доступа
        event_data = {}
        if event_keys:
            event_results = results[6:] # Данные событий начинаются с 6-го индекса
            for i, key_bytes in enumerate(event_keys):
                key = key_bytes.decode('utf-8')
                event_data[key] = {k.decode('utf-8'): int(v) for k, v in event_results[i].items()}
        data['events'] = event_data
        
        return data

    def _process_track_stats(self, listen_counts, all_events):
        """Агрегирует статистику по трекам в структурированный формат."""
        grouped_stats = defaultdict(lambda: {'total_plays': 0, 'albums': defaultdict(lambda: {'total_plays': 0, 'tracks': []})})

        for full_url, plays in listen_counts.items():
            try:
                path = urlparse(full_url).path.lstrip('/')
                parts = path.split('/')

                if len(parts) != 4 or parts[0] != 'music':
                    logging.warning(f"Skipping malformed track URL: {full_url}")
                    continue

                artist_name, album_raw, track_file = parts[1], parts[2], parts[3]
                
                # Очистка имен
                album_name = re.sub(r'^(Album|EP|Demo)\.\s*', '', album_raw, flags=re.IGNORECASE).strip()
                track_name = re.sub(r'^\d{1,2}[\s.\-_]*', '', os.path.splitext(track_file)[0]).strip()
                
                # Получаем события из уже загруженных данных
                event_key = f'v2:events:{full_url}'
                event_details = all_events.get(event_key, {})

                # Агрегация данных
                artist_stats = grouped_stats[artist_name]
                album_stats = artist_stats['albums'][album_name]
                
                artist_stats['total_plays'] += plays
                album_stats['total_plays'] += plays
                album_stats['tracks'].append({
                    'title': track_name,
                    'plays': plays,
                    'events': event_details
                })
            except Exception as e:
                logging.error(f"Failed to process track stat for URL '{full_url}': {e}")
                continue
        
        return grouped_stats

    def do_GET(self):
        try:
            if not self._authorize():
                return
            
            redis_client = self._get_redis_client()
            all_data = self._fetch_all_data(redis_client)
            
            track_stats = self._process_track_stats(all_data['listen_counts'], all_data['events'])
            
            final_response = {
                'track_stats': track_stats,
                'audience_stats': {
                    'browsers': all_data['browsers'],
                    'os': all_data['os'],
                    'devices': all_data['devices'],
                    'countries': all_data['countries'],
                },
                'diagnostic_logs': all_data['diagnostic_logs']
            }
            
            response_body = json.dumps(final_response, indent=2, ensure_ascii=False).encode('utf-8')
            self._send_response(200, body=response_body)

        except ConnectionError as e:
            logging.critical(f"Redis connection failed: {e}")
            self._send_error(503, "Service Unavailable: Cannot connect to the database.")
        except Exception as e:
            logging.exception(f"An unexpected error occurred in stats handler: {e}")
            self._send_error(500, "An internal server error occurred.")

