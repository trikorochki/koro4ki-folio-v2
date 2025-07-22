import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Получаем геолокацию из заголовков Vercel
        country_code = self.headers.get('X-Vercel-IP-Country', 'XX')
        ip_address = self.headers.get('X-Forwarded-For', '127.0.0.1')
        
        is_russian = country_code == 'RU'
        
        response_data = {
            'isRussian': is_russian,
            'country': country_code,
            'ip': ip_address.split(',')[0] if ip_address else '127.0.0.1',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'confidence': 0.99 if country_code != 'XX' else 0.5
        }
        
        # CORS заголовки
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        self.wfile.write(json.dumps(response_data).encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
