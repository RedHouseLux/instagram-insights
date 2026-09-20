"""One-time sign-in that mints a read-only token for the Insights spreadsheet.

Run once after downloading the OAuth client JSON from Google Cloud:

    python3 tools/sheet-auth.py

It opens a browser, you approve, and the refresh token is written to .oauth-token.json
(gitignored). Nothing here is sent anywhere except Google: the loopback server below only
ever listens on 127.0.0.1, and only for the single redirect that carries the auth code.

Scope is spreadsheets.readonly — read one spreadsheet, change nothing, touch nothing else in
Drive. Revoke any time at myaccount.google.com/permissions.
"""
import http.server
import json
import os
import socket
import threading
import urllib.parse
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = os.path.join(HERE, '.oauth-client.json')
TOKEN = os.path.join(HERE, '.oauth-token.json')
SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

if not os.path.exists(CLIENT):
    raise SystemExit('Missing %s — download the OAuth client JSON from Google Cloud and save it there.' % CLIENT)

raw = json.load(open(CLIENT))
cfg = raw.get('installed') or raw.get('web')
if not cfg:
    raise SystemExit('That JSON has neither an "installed" nor a "web" section — pick "Desktop app" as the client type.')

# A Desktop-app client accepts any loopback port, so grab a free one rather than hardcoding.
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
port = sock.getsockname()[1]
sock.close()
redirect = 'http://127.0.0.1:%d' % port

captured = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        captured.update(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query))
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        ok = 'code' in captured
        page = (
            '<body style="font:16px system-ui;padding:3rem;max-width:32rem">'
            '<h2>%s</h2><p>%s</p></body>'
        ) % (
            ('Signed in.' if ok else 'Sign-in failed.'),
            ('You can close this tab and go back to the terminal.' if ok
             else 'No authorisation code came back: %s' % captured.get('error', ['unknown'])[0]),
        )
        # Formatted first, encoded second: chaining .encode() straight onto the literal binds it to the
        # tuple rather than the formatted string, which raised mid-request and printed a traceback over an
        # otherwise successful sign-in.
        self.wfile.write(page.encode('utf-8'))

    def log_message(self, *args):
        pass  # the default logger writes every request to stderr; not useful here


server = http.server.HTTPServer(('127.0.0.1', port), Handler)
threading.Thread(target=server.handle_request, daemon=True).start()

auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
    'client_id': cfg['client_id'],
    'redirect_uri': redirect,
    'response_type': 'code',
    'scope': SCOPE,
    'access_type': 'offline',
    'prompt': 'consent',  # forces a refresh token even if this client was approved before
})

print('Opening your browser to approve read-only access to your spreadsheet.')
print('If it does not open, paste this into the browser yourself:\n\n%s\n' % auth_url)
webbrowser.open(auth_url)

server.socket.settimeout(300)
for _ in range(300):
    if captured:
        break
    import time
    time.sleep(1)

if 'code' not in captured:
    raise SystemExit('No authorisation code received. Approve in the browser, then run this again.')

body = urllib.parse.urlencode({
    'code': captured['code'][0],
    'client_id': cfg['client_id'],
    'client_secret': cfg['client_secret'],
    'redirect_uri': redirect,
    'grant_type': 'authorization_code',
}).encode()
tokens = json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', body))

if 'refresh_token' not in tokens:
    raise SystemExit('Google returned no refresh token. Remove this app at myaccount.google.com/permissions '
                     'and run again, so the consent screen is shown afresh.')

with open(TOKEN, 'w') as fh:
    json.dump({'refresh_token': tokens['refresh_token'],
               'client_id': cfg['client_id'],
               'client_secret': cfg['client_secret']}, fh, indent=2)
os.chmod(TOKEN, 0o600)  # readable only by you
print('Done. Token saved to .oauth-token.json (gitignored, owner-readable only).')
