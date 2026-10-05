"""Local HTTP server with a Python analysis API. Requires only Python 3."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from analyze import analyse


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/analyze':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 8_000_000:
                raise ValueError('Dataset too large')
            payload = json.loads(self.rfile.read(length))
            rows = [{k: float(r[src]) for k, src in (('time_s', 't'), ('x_m', 'x'), ('y_m', 'y'))} for r in payload['rows']]
            result, status = analyse(rows), 200
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            result, status = {'error': str(error)}, 400
        data = json.dumps(result, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'Open http://localhost:{args.port}/')
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
