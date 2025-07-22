from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class TestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/check-location':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'isRussian': False,
                'country': 'Test',
                'ip': '127.0.0.1',
                'timestamp': '2025-07-22T19:15:00Z',
                'confidence': 1.0
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_error(404)

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8000), TestHandler)
    print('Test server running on http://localhost:8000')
    server.serve_forever()
